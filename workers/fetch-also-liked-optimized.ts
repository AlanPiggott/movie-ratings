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
}

// Statistics
const stats = {
  processed: 0,
  succeeded: 0,
  failed: 0,
  notFound: 0,
  startTime: Date.now()
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

// OPTIMIZED: All proven patterns with global flags
const PERCENTAGE_PATTERNS = [
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

// OPTIMIZED: Extract percentage with proven patterns
function extractPercentageFromHTML(html: string): { percentage: number | null, context: string | null } {
  // Try each pattern
  for (const pattern of PERCENTAGE_PATTERNS) {
    const matches = html.match(pattern)
    if (matches) {
      // Check ALL matches (global flag ensures we get all)
      for (const match of matches) {
        const percentMatch = match.match(/(\d{1,3})/)
        if (percentMatch) {
          const percentage = parseInt(percentMatch[1])
          if (percentage >= 0 && percentage <= 100) {
            const context = match.replace(/\s+/g, ' ').trim()
            return { percentage, context }
          }
        }
      }
    }
  }
  
  return { percentage: null, context: null }
}

// OPTIMIZED: Build query using proven best pattern
function buildOptimizedQuery(item: QueueItem): string {
  const { title, year, mediaType } = item
  
  // Use the proven best pattern: {title} {year} movie/tv show
  const mediaTypeStr = mediaType === 'MOVIE' ? 'movie' : 'tv show'
  
  if (year) {
    return `${title} ${year} ${mediaTypeStr}`
  } else {
    return `${title} ${mediaTypeStr}`
  }
}

// OPTIMIZED: Fetch using HTML endpoint with proven approach
async function fetchAlsoLikedPercentage(item: QueueItem): Promise<number | null> {
  const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
  const query = buildOptimizedQuery(item)
  
  logProgress(`Searching: "${query}"`)
  
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
        keyword: query,
        device: 'desktop',
        os: 'windows'
      }])
    })
    
    const taskData = await taskResponse.json()
    if (taskData.status_code !== 20000 || !taskData.tasks?.[0]) {
      throw new Error('Failed to create task')
    }
    
    const taskId = taskData.tasks[0].id
    
    // Step 2: Wait for completion (8 seconds proven to be sufficient)
    await new Promise(resolve => setTimeout(resolve, 8000))
    
    // Step 3: Get HTML
    const htmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
      method: 'GET',
      headers: { 'Authorization': authHeader }
    })
    
    const htmlData = await htmlResponse.json()
    if (!htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html) {
      logProgress('No HTML returned')
      return null
    }
    
    const html = htmlData.tasks[0].result[0].items[0].html
    
    // Step 4: Extract percentage with optimized patterns
    const { percentage, context } = extractPercentageFromHTML(html)
    
    if (percentage !== null) {
      logProgress(`✅ Found: ${percentage}% - Context: "${context}"`)
      return percentage
    }
    
    // If primary query failed, try ONE fallback with parentheses
    if (!percentage && item.year) {
      const fallbackQuery = `${item.title} (${item.year}) ${mediaType === 'MOVIE' ? 'movie' : 'tv show'}`
      logProgress(`Trying fallback: "${fallbackQuery}"`)
      
      const fallbackTaskResponse = await fetch('https://api.dataforseo.com/v3/serp/google/organic/task_post', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          language_code: 'en',
          location_code: 2840,
          keyword: fallbackQuery
        }])
      })
      
      const fallbackTaskData = await fallbackTaskResponse.json()
      if (fallbackTaskData.tasks?.[0]?.id) {
        await new Promise(resolve => setTimeout(resolve, 8000))
        
        const fallbackHtmlResponse = await fetch(
          `https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${fallbackTaskData.tasks[0].id}`,
          { method: 'GET', headers: { 'Authorization': authHeader } }
        )
        
        const fallbackHtmlData = await fallbackHtmlResponse.json()
        const fallbackHtml = fallbackHtmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html || ''
        
        const fallbackResult = extractPercentageFromHTML(fallbackHtml)
        if (fallbackResult.percentage !== null) {
          logProgress(`✅ Fallback found: ${fallbackResult.percentage}%`)
          return fallbackResult.percentage
        }
      }
    }
    
    logProgress('No percentage found in Google results')
    return null
    
  } catch (error) {
    console.error(`Error fetching data for "${item.title}":`, error)
    return null
  }
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
  const maxRetries = 1 // Reduced because our primary pattern works so well
  
  logProgress(`\n🎬 Processing ${index + 1} of ${total}: "${item.title}" (${item.year || 'N/A'})`)
  
  try {
    // Fetch percentage from DataForSEO
    const percentage = await fetchAlsoLikedPercentage(item)
    
    if (percentage === null) {
      // No percentage found
      logProgress(`📊 No percentage data available for "${item.title}"`)
      
      // Update database to mark as "not found"
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
    if (retries < maxRetries) {
      item.retries = retries + 1
      logProgress(`Will retry "${item.title}" (attempt ${item.retries + 1}/${maxRetries + 1})`)
      return false // Keep in queue for retry
    } else {
      logProgress(`Failed after ${maxRetries + 1} attempts: "${item.title}"`)
      stats.failed++
      
      // Add to failed items
      const failedItems = loadFailedItems()
      failedItems.push({ ...item, retries: maxRetries + 1 })
      saveFailedItems(failedItems)
      
      return true // Remove from queue
    }
  }
}

// Main processing function
async function processQueue() {
  logProgress('🎬 Optimized Also-Liked Background Worker')
  logProgress('========================================')
  
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
  
  if (stats.failed > 0) {
    logProgress(`\n⚠️  ${stats.failed} items failed and were saved to: ${FAILED_FILE}`)
  }
  
  if (stats.notFound > 0) {
    logProgress(`\n📄 ${stats.notFound} items had no percentage data available`)
  }
  
  // Cost summary
  const estimatedCost = (stats.processed * 2 * 0.0006).toFixed(2) // Max 2 attempts per item
  logProgress(`\n💰 Estimated DataForSEO cost: ~$${estimatedCost}`)
}

// If running directly (not imported)
if (require.main === module) {
  processQueue()
    .then(() => {
      logProgress('Worker finished successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Worker error:', error)
      process.exit(1)
    })
}

// Export for testing
export { fetchAlsoLikedPercentage, extractPercentageFromHTML, buildOptimizedQuery }