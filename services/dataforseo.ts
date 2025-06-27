import { config } from '@/lib/config'
import { parseGoogleKnowledgePanel, hasKnowledgePanel } from '@/lib/parsers/google-knowledge-panel'

interface DataForSEOResponse {
  version: string
  status_code: number
  status_message: string
  time: string
  cost: number
  tasks_count: number
  tasks_error: number
  tasks?: Array<{
    id: string
    status_code: number
    status_message: string
    time: string
    cost: number
    result_count: number
    path: string[]
    data: any
    result?: Array<{
      type: string
      rank_group: number
      rank_absolute: number
      position: string
      xpath: string
      title?: string
      url?: string
      breadcrumb?: string
      is_paid?: boolean
      description?: string
      pre_snippet?: string
      extended_snippet?: string
      images?: any[]
      timestamp?: string
      rectangle?: any
    }>
  }>
}

interface SearchResult {
  percentage: number | null
  cost: number
  responseTime: number
  error?: string
  rawHtml?: string
}

export class DataForSEOService {
  private baseUrl = config.dataForSeo.baseUrl
  private authHeader: string
  private maxRetries = 1 // Reduced from 3 to avoid duplicate logs
  private retryDelay = 1000 // 1 second

  constructor() {
    // Create base64 encoded auth header
    const credentials = `${config.dataForSeo.login}:${config.dataForSeo.password}`
    this.authHeader = `Basic ${Buffer.from(credentials).toString('base64')}`
  }

  /**
   * Search Google Knowledge Panel for sentiment percentage
   */
  async searchGoogleKnowledge(query: string): Promise<SearchResult> {
    const startTime = Date.now()
    let lastError: Error | undefined
    let totalCost = 0

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.performSearch(query)
        const responseTime = Date.now() - startTime
        
        // Log successful API call
        await this.logApiCall({
          endpoint: '/serp/google/organic/live/regular',
          method: 'POST',
          statusCode: 200,
          responseTime,
          cost: result.cost,
          metadata: {
            query,
            percentage: result.percentage,
            attempt,
          },
        })

        return {
          percentage: result.percentage,
          cost: result.cost,
          responseTime,
          rawHtml: result.rawHtml,
        }
      } catch (error) {
        lastError = error as Error
        totalCost += 0.0006 // Minimum cost even for failed requests
        
        // Log failed attempt
        await this.logApiCall({
          endpoint: '/serp/google/organic/live/regular',
          method: 'POST',
          statusCode: error instanceof DataForSEOError ? error.statusCode : 500,
          responseTime: Date.now() - startTime,
          cost: totalCost,
          errorMessage: lastError.message,
          metadata: {
            query,
            attempt,
            willRetry: attempt < this.maxRetries,
          },
        })

        // Wait before retrying (exponential backoff)
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt)
        }
      }
    }

    // All retries failed
    return {
      percentage: null,
      cost: totalCost,
      responseTime: Date.now() - startTime,
      error: lastError?.message || 'Unknown error',
    }
  }

  /**
   * Create a search task
   */
  private async createSearchTask(query: string): Promise<string | null> {
    const payload = [{
      language_code: 'en',
      location_code: 2840, // United States
      keyword: query,
      device: 'desktop',
      os: 'windows'
    }]

    const response = await fetch(`${this.baseUrl}/serp/google/organic/task_post`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new DataForSEOError(
        `Task creation failed: ${response.statusText}`,
        response.status
      )
    }

    const data = await response.json()
    
    if (data.status_code !== 20000 || !data.tasks?.[0]) {
      throw new DataForSEOError(
        data.status_message || 'Failed to create task',
        data.status_code
      )
    }
    
    return data.tasks[0].id
  }

  /**
   * Fetch HTML for a completed task
   */
  private async fetchTaskHtml(taskId: string): Promise<{ html: string | null; cost: number }> {
    const response = await fetch(`${this.baseUrl}/serp/google/organic/task_get/html/${taskId}`, {
      method: 'GET',
      headers: {
        Authorization: this.authHeader,
      },
    })

    if (!response.ok) {
      throw new DataForSEOError(
        `HTML fetch failed: ${response.statusText}`,
        response.status
      )
    }

    const data = await response.json()
    const cost = data.cost || 0.0006

    if (data.status_code !== 20000) {
      throw new DataForSEOError(
        data.status_message || 'Failed to fetch HTML',
        data.status_code
      )
    }

    const html = data.tasks?.[0]?.result?.[0]?.items?.[0]?.html || null
    return { html, cost }
  }

  /**
   * Extract percentage from HTML using proven patterns
   */
  private extractPercentageFromHtml(html: string): number | null {
    const patterns = [
      // Primary pattern - catches most results
      /(\d{1,3})%\s*liked\s*this\s*(movie|film|show|series)/gi,
      
      // Secondary patterns
      /(\d{1,3})%\s*of\s*(?:Google\s*)?users\s*liked/gi,
      />(\d{1,3})%\s*liked\s*this/gi,
      /class="[^"]*srBp4[^"]*"[^>]*>\s*(\d{1,3})%/gi,
      
      // General fallbacks
      /(\d{1,3})%\s*liked/gi,
      /liked\s*by\s*(\d{1,3})%/gi,
      /audience\s*score[:\s]*(\d{1,3})%/gi,
      /(\d{1,3})%\s*positive/gi
    ]

    for (const pattern of patterns) {
      const matches = html.match(pattern)
      if (matches) {
        for (const match of matches) {
          const percentMatch = match.match(/(\d{1,3})/)
          if (percentMatch) {
            const percentage = parseInt(percentMatch[1])
            if (percentage >= 0 && percentage <= 100) {
              return percentage
            }
          }
        }
      }
    }
    
    return null
  }

  /**
   * Perform the actual search request using task-based approach
   */
  private async performSearch(query: string): Promise<{ percentage: number | null; cost: number; rawHtml?: string }> {
    let totalCost = 0
    
    try {
      // Step 1: Create task
      const taskId = await this.createSearchTask(query)
      if (!taskId) {
        throw new DataForSEOError('Failed to create search task', 500)
      }
      
      // Step 2: Wait for task completion (reduced from 8s for better UX)
      await this.delay(5000)
      
      // Step 3: Fetch HTML with retries
      let html: string | null = null
      let fetchCost = 0
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const result = await this.fetchTaskHtml(taskId)
          html = result.html
          fetchCost = result.cost
          totalCost += fetchCost
          
          if (html && html.length > 0) {
            break
          }
          
          // Wait before retry: 5s, 10s, 15s
          if (attempt < 3) {
            await this.delay(5000 * attempt)
          }
        } catch (error) {
          if (attempt === 3) throw error
        }
      }
      
      if (!html) {
        return {
          percentage: null,
          cost: totalCost,
          rawHtml: undefined
        }
      }
      
      // Step 4: Extract percentage
      const percentage = this.extractPercentageFromHtml(html)
      
      return {
        percentage,
        cost: totalCost,
        rawHtml: html
      }
      
    } catch (error) {
      console.error('Search task error:', error)
      return {
        percentage: null,
        cost: totalCost,
        rawHtml: undefined
      }
    }
  }


  /**
   * Log API call for tracking and debugging
   * Currently disabled to avoid database connection issues
   */
  private async logApiCall(data: {
    endpoint: string
    method: string
    statusCode: number
    responseTime: number
    cost: number
    errorMessage?: string
    metadata?: any
  }) {
    // Logging disabled - was causing database connection errors
    // If logging is needed, implement using Supabase instead
    if (data.errorMessage) {
      console.error(`API Error: ${data.endpoint} - ${data.errorMessage}`)
    }
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get total API costs for a time period
   * Currently disabled due to database connection issues
   */
  async getTotalCosts(since: Date): Promise<number> {
    // Disabled - was causing database connection errors
    // TODO: Implement using Supabase if needed
    return 0
  }

  /**
   * Get API usage statistics
   * Currently disabled due to database connection issues
   */
  async getUsageStats(since: Date) {
    // Disabled - was causing database connection errors
    // TODO: Implement using Supabase if needed
    return {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalCost: 0,
      avgResponseTime: 0,
      successRate: 0,
    }
  }
}

/**
 * Custom error class for DataForSEO API errors
 */
class DataForSEOError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message)
    this.name = 'DataForSEOError'
  }
}

// Export singleton instance
export const dataForSeoService = new DataForSEOService()