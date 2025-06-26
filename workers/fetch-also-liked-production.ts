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
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// DataForSEO credentials
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD

if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
  console.error('❌ Missing DataForSEO credentials')
  process.exit(1)
}

// Queue item interface
interface QueueItem {
  tmdbId: number
  title: string
  year: number | null
  mediaType: 'MOVIE' | 'TV_SHOW'
  retries?: number
}

// Statistics
const stats = {
  processed: 0,
  succeeded: 0,
  failed: 0,
  skipped: 0,
  startTime: Date.now()
}

// File paths
const QUEUE_FILE = join(process.cwd(), 'data', 'also-liked-queue.json')
const FAILED_FILE = join(process.cwd(), 'data', 'also-liked-failed.json')
const SKIPPED_FILE = join(process.cwd(), 'data', 'also-liked-skipped.json')

// Progress logging
function logProgress(message: string, emoji: string = '') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  console.log(`[${timestamp}] ${emoji} ${message}`.trim())
}

// Load queue from file
function loadQueue(): QueueItem[] {
  if (!existsSync(QUEUE_FILE)) {
    logProgress('No queue file found at ' + QUEUE_FILE, '❌')
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

// Load items from file
function loadItemsFromFile(filePath: string): QueueItem[] {
  if (!existsSync(filePath)) {
    return []
  }
  
  try {
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    return []
  }
}

// Save items to file
function saveItemsToFile(items: QueueItem[], filePath: string) {
  const dataDir = join(process.cwd(), 'data')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  
  writeFileSync(filePath, JSON.stringify(items, null, 2))
}

// Comprehensive patterns for percentage extraction
const PERCENTAGE_PATTERNS = [
  // Direct percentage patterns
  /(\d{1,3})%\s*liked\s*this/i,
  /(\d{1,3})%\s*of\s*(?:Google\s*)?(?:users|people|viewers)\s*liked/i,
  /liked.*?(\d{1,3})%/i,
  
  // Audience/user score patterns
  /audience\s*score[:\s]*(\d{1,3})%/i,
  /user\s*score[:\s]*(\d{1,3})%/i,
  /(\d{1,3})%\s*(?:audience|user)/i,
  
  // Google specific
  /google\s*users[:\s]*(\d{1,3})%/i,
  /(\d{1,3})%\s*google\s*users/i,
  
  // General approval
  /(\d{1,3})%\s*(?:positive|approval|fresh)/i
]

// Extract percentage from text
function extractPercentageFromText(text: string): number | null {
  if (!text) return null
  
  for (const pattern of PERCENTAGE_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      for (let i = 1; i < match.length; i++) {
        if (match[i] && /^\d{1,3}$/.test(match[i])) {
          const percentage = parseInt(match[i], 10)
          if (percentage >= 0 && percentage <= 100) {
            return percentage
          }
        }
      }
    }
  }
  
  return null
}

// Convert rating to percentage
function convertRatingToPercentage(rating: any): number | null {
  if (!rating || !rating.value) return null
  
  const value = parseFloat(rating.value)
  const scale = parseFloat(rating.rating_max || rating.scale || 5)
  
  if (isNaN(value) || isNaN(scale) || scale === 0) return null
  
  // Convert to percentage and round
  return Math.round((value / scale) * 100)
}

// Fetch also-liked percentage from DataForSEO
async function fetchAlsoLikedPercentage(item: QueueItem): Promise<{ percentage: number | null, source: string }> {
  const mediaTypeStr = item.mediaType === 'MOVIE' ? 'movie' : 'tv show'
  const searchQuery = item.year ? `${item.title} ${item.year} ${mediaTypeStr}` : `${item.title} ${mediaTypeStr}`
  
  logProgress(`Searching: "${searchQuery}"`, '🔍')
  
  try {
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        language_code: 'en',
        location_code: 2840, // United States
        keyword: searchQuery
      }])
    })
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.status_code !== 20000 || !data.tasks?.[0]?.result?.[0]?.items) {
      throw new Error('No results returned')
    }
    
    const items = data.tasks[0].result[0].items || []
    
    // First, check knowledge graph for any percentage data
    const knowledgeGraph = items.find((item: any) => item.type === 'knowledge_graph')
    if (knowledgeGraph) {
      const kgText = JSON.stringify(knowledgeGraph)
      const percentage = extractPercentageFromText(kgText)
      if (percentage !== null) {
        logProgress(`Found in knowledge graph: ${percentage}%`, '📊')
        return { percentage, source: 'knowledge_graph' }
      }
    }
    
    // Check all organic results for percentage data
    for (const resultItem of items) {
      if (resultItem.type === 'organic') {
        // Check all text fields
        const fieldsToCheck = [
          resultItem.title,
          resultItem.snippet,
          resultItem.description,
          resultItem.extended_snippet
        ]
        
        for (const field of fieldsToCheck) {
          if (!field) continue
          
          const percentage = extractPercentageFromText(field)
          if (percentage !== null) {
            logProgress(`Found in ${resultItem.type}: ${percentage}%`, '✨')
            return { percentage, source: 'organic_result' }
          }
        }
        
        // If this is an IMDb or Rotten Tomatoes result with rating, convert it
        if (resultItem.rating && 
            (resultItem.url?.includes('imdb.com') || 
             resultItem.url?.includes('rottentomatoes.com'))) {
          const percentage = convertRatingToPercentage(resultItem.rating)
          if (percentage !== null) {
            logProgress(`Converted rating from ${resultItem.url}: ${percentage}%`, '⭐')
            return { percentage, source: 'rating_conversion' }
          }
        }
      }
    }
    
    // No percentage found
    return { percentage: null, source: 'not_found' }
    
  } catch (error) {
    console.error(`Error fetching data:`, error)
    throw error
  }
}

// Update also-liked percentage in database
async function updateAlsoLikedPercentage(tmdbId: number, mediaType: string, percentage: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('media_items')
      .update({ 
        also_liked_percentage: percentage
      })
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
async function processQueueItem(item: QueueItem, index: number, total: number): Promise<'success' | 'failed' | 'skipped'> {
  const retries = item.retries || 0
  const maxRetries = 3
  
  logProgress(`Processing ${index + 1} of ${total}: "${item.title}" (${item.year || 'N/A'})`, '🎬')
  
  try {
    // Fetch percentage from DataForSEO
    const result = await fetchAlsoLikedPercentage(item)
    
    if (result.percentage === null) {
      // No percentage found - skip this item
      logProgress(`No data available for "${item.title}" - skipping`, '⏭️')
      stats.skipped++
      
      // Add to skipped items
      const skippedItems = loadItemsFromFile(SKIPPED_FILE)
      skippedItems.push(item)
      saveItemsToFile(skippedItems, SKIPPED_FILE)
      
      return 'skipped'
    }
    
    // Update database
    const updated = await updateAlsoLikedPercentage(item.tmdbId, item.mediaType, result.percentage)
    
    if (!updated) {
      throw new Error('Failed to update database')
    }
    
    logProgress(`Updated "${item.title}" with ${result.percentage}% (source: ${result.source})`, '✅')
    stats.succeeded++
    return 'success'
    
  } catch (error) {
    console.error(`Error processing "${item.title}":`, error)
    
    // Check if we should retry
    if (retries < maxRetries - 1) {
      item.retries = retries + 1
      logProgress(`Will retry "${item.title}" (attempt ${item.retries + 1}/${maxRetries})`, '🔄')
      return 'failed' // Will retry
    } else {
      logProgress(`Failed after ${maxRetries} attempts: "${item.title}"`, '❌')
      stats.failed++
      
      // Add to failed items
      const failedItems = loadItemsFromFile(FAILED_FILE)
      failedItems.push({ ...item, retries: maxRetries })
      saveItemsToFile(failedItems, FAILED_FILE)
      
      return 'failed'
    }
  }
}

// Main processing function
async function processQueue() {
  logProgress('Also-Liked Background Worker (Production)', '🎬')
  logProgress('==========================================', '')
  
  // Load queue
  let queue = loadQueue()
  
  if (queue.length === 0) {
    logProgress('Queue is empty. Nothing to process.', '📭')
    return
  }
  
  logProgress(`Found ${queue.length} items in queue`, '📋')
  
  const totalItems = queue.length
  let currentIndex = 0
  
  // Process items one by one
  while (queue.length > 0) {
    const item = queue[0]
    stats.processed++
    
    // Process item
    const result = await processQueueItem(item, currentIndex, totalItems)
    
    if (result === 'success' || result === 'skipped') {
      // Remove from queue
      queue.shift()
      currentIndex++
    } else {
      // Move failed item to end of queue for retry later
      queue.push(queue.shift()!)
    }
    
    // Save updated queue after each item
    saveQueue(queue)
    
    // Rate limiting - wait 2 seconds between requests
    if (queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  // Calculate runtime
  const runtime = Math.round((Date.now() - stats.startTime) / 1000)
  const minutes = Math.floor(runtime / 60)
  const seconds = runtime % 60
  
  // Display summary
  console.log('\n' + '='.repeat(50))
  logProgress('Processing Complete!', '✅')
  console.log('='.repeat(50))
  logProgress(`Total items processed: ${stats.processed}`, '📊')
  logProgress(`Successfully updated: ${stats.succeeded}`, '✅')
  logProgress(`Skipped (no data): ${stats.skipped}`, '⏭️')
  logProgress(`Failed items: ${stats.failed}`, '❌')
  logProgress(`Runtime: ${minutes}m ${seconds}s`, '⏱️')
  
  if (stats.failed > 0) {
    logProgress(`Failed items saved to: ${FAILED_FILE}`, '📁')
  }
  
  if (stats.skipped > 0) {
    logProgress(`Skipped items saved to: ${SKIPPED_FILE}`, '📁')
  }
  
  // Cost summary
  const totalCost = (stats.processed * 0.003).toFixed(2)
  logProgress(`Estimated DataForSEO cost: $${totalCost}`, '💰')
}

// Production notes
console.log(`
📝 Production Notes:
===================
This worker processes the also-liked queue with the following features:

1. Attempts to find Google's "% liked" data from search results
2. Falls back to converting ratings (e.g., 4/5 stars = 80%)
3. Skips items with no available data
4. Retries failed items up to 3 times
5. Saves progress after each item

Files created:
- ${FAILED_FILE} - Items that failed after retries
- ${SKIPPED_FILE} - Items with no sentiment data available

For production deployment, consider:
- Running this as a scheduled job (e.g., daily)
- Using a proper queue service for better reliability
- Implementing monitoring and alerting
`)

// Run the worker
processQueue()
  .then(() => {
    logProgress('Worker finished successfully', '🎉')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Worker error:', error)
    process.exit(1)
  })