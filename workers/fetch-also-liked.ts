#!/usr/bin/env tsx

// Load environment variables from .env.local
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// DataForSEO credentials
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD

if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
  console.error('❌ Missing DataForSEO credentials')
  console.error('Required: DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD')
  process.exit(1)
}

// Queue item interface
interface QueueItem {
  tmdbId: number
  title: string
  original_title?: string
  year: number | null
  mediaType: 'MOVIE' | 'TV_SHOW'
  retries?: number
  failedQueries?: string[]
}

// Statistics
const stats = {
  processed: 0,
  succeeded: 0,
  failed: 0,
  notFound: 0,
  startTime: Date.now(),
  successfulQueries: {} as Record<string, number>
}

// File paths
const QUEUE_FILE = join(process.cwd(), 'data', 'also-liked-queue.json')
const FAILED_FILE = join(process.cwd(), 'data', 'also-liked-failed.json')

// Progress logging
function logProgress(message: string) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  console.log(`[${timestamp}] ${message}`)
}

// Load queue from file
function loadQueue(): QueueItem[] {
  if (!existsSync(QUEUE_FILE)) {
    logProgress('No queue file found at ' + QUEUE_FILE)
    return []
  }
  
  try {
    const content = readFileSync(QUEUE_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('Error loading queue file:', error)
    return []
  }
}

// Save queue to file
function saveQueue(queue: QueueItem[]) {
  const dataDir = join(process.cwd(), 'data')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  
  writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2))
}

// Load failed items
function loadFailedItems(): QueueItem[] {
  if (!existsSync(FAILED_FILE)) {
    return []
  }
  
  try {
    const content = readFileSync(FAILED_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    return []
  }
}

// Save failed items
function saveFailedItems(items: QueueItem[]) {
  const dataDir = join(process.cwd(), 'data')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  
  writeFileSync(FAILED_FILE, JSON.stringify(items, null, 2))
}

// Patterns to match various Google Knowledge Panel formats
const PERCENTAGE_PATTERNS = [
  // Direct percentage patterns
  /(\d{1,3})%\s*liked\s*this\s*(film|movie|show|series|tv\s*show)/i,
  /(\d{1,3})%\s*of\s*(people|users|viewers|Google\s*users)\s*liked\s*this/i,
  /(\d{1,3})%\s*liked\s*it/i,
  /(\d{1,3})%\s*liked/i,
  
  // Rating patterns that might appear
  /audience\s*score[:\s]*(\d{1,3})%/i,
  /liked\s*by\s*(\d{1,3})%/i,
  /(\d{1,3})%\s*positive/i,
  
  // Variations with different formatting
  /(\d{1,3})\s*%\s*liked/i,
  /(\d{1,3})\s*percent\s*liked/i,
  
  // Google specific patterns
  /google\s*users[:\s]*(\d{1,3})%\s*liked/i,
  /(\d{1,3})%\s*of\s*google\s*users/i,
  
  // Knowledge panel specific patterns from working examples
  />\s*(\d{1,3})%\s*liked\s*this\s*(movie|film)/i,
  /class="[^"]*srBp4[^"]*"[^>]*>\s*(\d{1,3})%/i
]

// Clean HTML by removing script tags, style tags, and other noise
function cleanHTML(html: string): string {
  // Remove script and style content
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
    .replace(/<[^>]+>/g, ' ') // Remove HTML tags
    .replace(/&[a-z]+;/gi, ' ') // Remove HTML entities
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
  
  return cleaned
}

// Parse HTML to extract sentiment percentage
function parseGoogleKnowledgePanel(html: string): number | null {
  if (!html || typeof html !== 'string') {
    return null
  }

  // Clean the HTML first
  const cleanedHTML = cleanHTML(html)
  
  // Try each pattern in order
  for (const pattern of PERCENTAGE_PATTERNS) {
    const match = cleanedHTML.match(pattern)
    if (match) {
      // Find the first numeric group in the match
      for (let i = 1; i < match.length; i++) {
        const value = match[i]
        if (value && /^\d{1,3}$/.test(value)) {
          const percentage = parseInt(value, 10)
          // Validate percentage is in valid range
          if (percentage >= 0 && percentage <= 100) {
            logProgress(`Matched pattern: ${pattern.source}`)
            return percentage
          }
        }
      }
    }
  }

  // Try to find any percentage near "liked" keyword as fallback
  const fallbackPattern = /(\d{1,3})%[^0-9]{0,50}liked|liked[^0-9]{0,50}(\d{1,3})%/i
  const fallbackMatch = cleanedHTML.match(fallbackPattern)
  if (fallbackMatch) {
    // Find the first numeric group in the match
    for (let i = 1; i < fallbackMatch.length; i++) {
      const value = fallbackMatch[i]
      if (value && /^\d{1,3}$/.test(value)) {
        const percentage = parseInt(value, 10)
        if (percentage >= 0 && percentage <= 100) {
          logProgress(`Matched fallback pattern`)
          return percentage
        }
      }
    }
  }

  return null
}

// Check if HTML likely contains a Google Knowledge Panel
function hasKnowledgePanel(html: string): boolean {
  const indicators = [
    /knowledge[^a-z]*panel/i,
    /kp-wholepage/i,
    /kno-result/i,
    /knowledge-panel/i,
    /g-blk/i,
    // Common knowledge panel class names
    /class="[^"]*kp[^"]*"/i,
    /id="[^"]*knowledge[^"]*"/i,
  ]
  
  return indicators.some(pattern => pattern.test(html))
}

// Build search query with year disambiguation
function buildSearchQuery(item: QueueItem, strategy: number = 0): string {
  const { title, original_title, year, mediaType } = item
  const mediaTypeStr = mediaType === 'MOVIE' ? 'movie' : 'tv series'
  
  // Check if title already contains year
  const titleHasYear = /\b(19|20)\d{2}\b/.test(title)
  
  // Different query strategies
  switch (strategy) {
    case 0:
      // Primary strategy: title with year and media type
      if (year && !titleHasYear) {
        return `${title} ${year} ${mediaType === 'MOVIE' ? 'movie' : 'tv series'}`
      }
      return `${title} ${mediaTypeStr}`
      
    case 1:
      // Try with original title if different
      if (original_title && original_title !== title) {
        return year && !titleHasYear 
          ? `${original_title} ${year} film` 
          : `${original_title} ${mediaType === 'MOVIE' ? 'film' : 'series'}`
      }
      // Fallback to title with parentheses around year
      return year ? `${title} (${year}) ${mediaTypeStr}` : `${title} ${mediaTypeStr}`
      
    case 2:
      // Try without subtitle (if title has colon)
      if (title.includes(':')) {
        const mainTitle = title.split(':')[0].trim()
        return year ? `${mainTitle} ${year} ${mediaTypeStr}` : `${mainTitle} ${mediaTypeStr}`
      }
      // Try with "film" instead of "movie"
      return year && mediaType === 'MOVIE' 
        ? `${title} ${year} film` 
        : `${title} ${mediaTypeStr}`
        
    case 3:
      // Just title and year, no media type
      return year ? `${title} ${year}` : title
      
    default:
      // Fallback: just the title
      return title
  }
}

// Fetch percentage using the new HTML endpoint approach
async function fetchWithHTMLEndpoint(searchQuery: string): Promise<{ percentage: number | null, html: string | null }> {
  const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
  
  try {
    // Step 1: Create task
    const taskResponse = await fetch('https://api.dataforseo.com/v3/serp/google/organic/task_post', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        language_code: 'en',
        location_code: 2840, // United States
        keyword: searchQuery,
        device: 'desktop',
        os: 'windows'
      }])
    })
    
    const taskData = await taskResponse.json()
    if (taskData.status_code !== 20000 || !taskData.tasks?.[0]) {
      throw new Error('Failed to create task')
    }
    
    const taskId = taskData.tasks[0].id
    
    // Step 2: Wait for completion
    await new Promise(resolve => setTimeout(resolve, 8000))
    
    // Step 3: Get HTML
    const htmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
      method: 'GET',
      headers: { 'Authorization': authHeader }
    })
    
    const htmlData = await htmlResponse.json()
    if (!htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html) {
      return { percentage: null, html: null }
    }
    
    const html = htmlData.tasks[0].result[0].items[0].html
    const percentage = parseGoogleKnowledgePanel(html)
    
    return { percentage, html }
    
  } catch (error) {
    console.error('HTML endpoint error:', error)
    return { percentage: null, html: null }
  }
}

// Fetch also-liked percentage from DataForSEO with multiple strategies
async function fetchAlsoLikedPercentage(item: QueueItem): Promise<number | null> {
  const maxStrategies = 4
  item.failedQueries = item.failedQueries || []
  
  // Try different search strategies
  for (let strategy = 0; strategy < maxStrategies; strategy++) {
    const searchQuery = buildSearchQuery(item, strategy)
    
    // Skip if we've already tried this query
    if (item.failedQueries.includes(searchQuery)) {
      continue
    }
    
    logProgress(`Attempt ${strategy + 1}/${maxStrategies}: "${searchQuery}"`)
    
    try {
      // Use the HTML endpoint approach that works
      const { percentage, html } = await fetchWithHTMLEndpoint(searchQuery)
      
      if (percentage !== null) {
        logProgress(`✅ Found percentage: ${percentage}% (strategy: ${strategy})`)
        
        // Track successful query patterns
        const queryPattern = strategy === 0 ? 'title_year_type' : 
                           strategy === 1 ? 'original_or_parentheses' :
                           strategy === 2 ? 'no_subtitle_or_film' : 
                           'title_only'
        stats.successfulQueries[queryPattern] = (stats.successfulQueries[queryPattern] || 0) + 1
        
        return percentage
      }
      
      // Track failed query
      item.failedQueries.push(searchQuery)
      
      // Check if HTML contains knowledge panel but no percentage
      if (html && hasKnowledgePanel(html)) {
        logProgress('Knowledge panel found but no percentage data')
      }
      
    } catch (error) {
      console.error(`Error with query "${searchQuery}":`, error)
      item.failedQueries.push(searchQuery)
    }
    
    // Wait between attempts
    if (strategy < maxStrategies - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  logProgress(`No percentage found after ${maxStrategies} attempts`)
  return null
}

// Update also-liked percentage in database
async function updateAlsoLikedPercentage(tmdbId: number, mediaType: string, percentage: number | 'not_found'): Promise<boolean> {
  try {
    const updateData = percentage === 'not_found' 
      ? { also_liked_percentage: null }
      : { also_liked_percentage: percentage }
      
    const { error } = await supabase
      .from('media_items')
      .update(updateData)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType)
    
    if (error) {
      console.error('Database update error:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Error updating database:', error)
    return false
  }
}

// Process a single queue item
async function processQueueItem(item: QueueItem, index: number, total: number): Promise<boolean> {
  const retries = item.retries || 0
  const maxRetries = 2 // Reduced since we already try multiple strategies per attempt
  
  logProgress(`\n📽️  Processing ${index + 1} of ${total}: "${item.title}" (${item.year || 'N/A'})`)
  if (item.original_title && item.original_title !== item.title) {
    logProgress(`    Original title: "${item.original_title}"`)
  }
  
  try {
    // Fetch percentage from DataForSEO
    const percentage = await fetchAlsoLikedPercentage(item)
    
    if (percentage === null) {
      // No percentage found after all attempts
      logProgress(`📊 No percentage data found for "${item.title}" - marking as not found`)
      
      // Update database to mark as "not found" rather than leaving it null
      const updated = await updateAlsoLikedPercentage(item.tmdbId, item.mediaType, 'not_found')
      
      if (!updated) {
        throw new Error('Failed to update database')
      }
      
      stats.notFound++
      return true // Remove from queue
    }
    
    // Update database with percentage
    const updated = await updateAlsoLikedPercentage(item.tmdbId, item.mediaType, percentage)
    
    if (!updated) {
      throw new Error('Failed to update database')
    }
    
    logProgress(`✅ Updated "${item.title}" with ${percentage}% liked`)
    stats.succeeded++
    return true
    
  } catch (error) {
    console.error(`❌ Error processing "${item.title}":`, error)
    
    // Check if we should retry
    if (retries < maxRetries - 1) {
      item.retries = retries + 1
      logProgress(`Will retry "${item.title}" (attempt ${item.retries + 1}/${maxRetries})`)
      return false // Keep in queue for retry
    } else {
      logProgress(`Failed after ${maxRetries} attempts: "${item.title}"`)
      stats.failed++
      
      // Add to failed items
      const failedItems = loadFailedItems()
      failedItems.push({ ...item, retries: maxRetries })
      saveFailedItems(failedItems)
      
      return true // Remove from queue
    }
  }
}

// Main processing function
async function processQueue() {
  logProgress('🎬 Also-Liked Background Worker')
  logProgress('===============================')
  
  // Load queue
  let queue = loadQueue()
  
  if (queue.length === 0) {
    logProgress('Queue is empty. Nothing to process.')
    return
  }
  
  logProgress(`Found ${queue.length} items in queue`)
  
  const totalItems = queue.length
  let currentIndex = 0
  
  // Process items one by one
  while (queue.length > 0) {
    const item = queue[0]
    stats.processed++
    
    // Process item
    const shouldRemove = await processQueueItem(item, currentIndex, totalItems)
    
    if (shouldRemove) {
      // Remove from queue
      queue.shift()
      currentIndex++
      
      // Save updated queue
      saveQueue(queue)
    } else {
      // Move failed item to end of queue for retry later
      queue.push(queue.shift()!)
      
      // Save updated queue
      saveQueue(queue)
    }
    
    // Rate limiting - wait 2 seconds between requests
    if (queue.length > 0) {
      logProgress('Waiting 2 seconds (rate limiting)...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  // Calculate runtime
  const runtime = Math.round((Date.now() - stats.startTime) / 1000)
  const minutes = Math.floor(runtime / 60)
  const seconds = runtime % 60
  
  // Display summary
  logProgress('\n✅ Processing Complete!')
  logProgress('=====================')
  logProgress(`Total items processed: ${stats.processed}`)
  logProgress(`Successfully updated: ${stats.succeeded}`)
  logProgress(`Not found (no data): ${stats.notFound}`)
  logProgress(`Failed items: ${stats.failed}`)
  logProgress(`Runtime: ${minutes}m ${seconds}s`)
  
  // Query pattern analysis
  if (Object.keys(stats.successfulQueries).length > 0) {
    logProgress('\n📈 Successful Query Patterns:')
    for (const [pattern, count] of Object.entries(stats.successfulQueries)) {
      logProgress(`  ${pattern}: ${count} successes`)
    }
  }
  
  if (stats.failed > 0) {
    logProgress(`\n⚠️  ${stats.failed} items failed and were saved to: ${FAILED_FILE}`)
  }
  
  if (stats.notFound > 0) {
    logProgress(`\n📄 ${stats.notFound} items had no percentage data available`)
  }
  
  // Cost summary (using new HTML endpoint which may have different pricing)
  const estimatedCost = (stats.processed * 4 * 0.0006).toFixed(2) // 4 attempts max per item
  logProgress(`\n💰 Estimated DataForSEO cost: ~$${estimatedCost}`)
}

// Production note
console.log(`
📝 Production Note:
==================
For production deployment, consider using:
- Supabase Edge Functions for serverless processing
- External queue service (Redis, RabbitMQ, AWS SQS)
- Proper job scheduling (cron, Temporal, etc.)
- Distributed locking for concurrent workers
- Better error tracking and monitoring

This implementation is suitable for development and small-scale use.
`)

// Run the worker
processQueue()
  .then(() => {
    logProgress('Worker finished successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Worker error:', error)
    process.exit(1)
  })