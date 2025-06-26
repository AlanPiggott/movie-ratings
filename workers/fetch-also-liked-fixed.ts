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
  year: number | null
  mediaType: 'MOVIE' | 'TV_SHOW'
  retries?: number
}

// Statistics
const stats = {
  processed: 0,
  succeeded: 0,
  failed: 0,
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

// Comprehensive patterns for percentage extraction
const PERCENTAGE_PATTERNS = [
  // Direct percentage patterns
  /(\d{1,3})%\s*liked\s*this\s*(film|movie|show|series|tv\s*show)/i,
  /(\d{1,3})%\s*of\s*(?:Google\s*)?(?:users|people|viewers)\s*liked\s*this/i,
  /(\d{1,3})%\s*liked/i,
  /liked.*?(\d{1,3})%/i,
  
  // Audience score patterns
  /audience\s*score[:\s]*(\d{1,3})%/i,
  /audience[:\s]*(\d{1,3})%/i,
  /(\d{1,3})%\s*audience/i,
  
  // User score patterns
  /user\s*score[:\s]*(\d{1,3})%/i,
  /users[:\s]*(\d{1,3})%/i,
  
  // General positive sentiment
  /(\d{1,3})%\s*positive/i,
  /(\d{1,3})%\s*approval/i,
  
  // Google specific
  /google\s*users[:\s]*(\d{1,3})%/i,
  /(\d{1,3})%\s*google\s*users/i
]

// Extract percentage from text
function extractPercentageFromText(text: string): number | null {
  if (!text) return null
  
  for (const pattern of PERCENTAGE_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      // Find the numeric group
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

// Fetch also-liked percentage from DataForSEO
async function fetchAlsoLikedPercentage(item: QueueItem): Promise<number | null> {
  try {
    // Try multiple query variations
    const queries = []
    
    // Query 1: Simple title + type
    const mediaTypeStr = item.mediaType === 'MOVIE' ? 'movie' : 'tv show'
    queries.push(`${item.title} ${mediaTypeStr}`)
    
    // Query 2: With year
    if (item.year) {
      queries.push(`${item.title} ${item.year} ${mediaTypeStr}`)
    }
    
    // Query 3: With "google users liked"
    queries.push(`${item.title} ${mediaTypeStr} google users liked`)
    
    // Try each query
    for (const searchQuery of queries) {
      logProgress(`Trying query: "${searchQuery}"`)
      
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
        logProgress(`API error: ${response.status}`)
        continue
      }
      
      const data = await response.json()
      
      if (data.status_code !== 20000 || !data.tasks || data.tasks.length === 0) {
        continue
      }
      
      const task = data.tasks[0]
      if (task.status_code !== 20000 || !task.result || task.result.length === 0) {
        continue
      }
      
      // Check all items in results
      const items = task.result[0].items || []
      for (const resultItem of items) {
        // Check all text fields
        const fieldsToCheck = [
          resultItem.title,
          resultItem.snippet,
          resultItem.description,
          resultItem.extended_snippet,
          resultItem.breadcrumb
        ]
        
        for (const field of fieldsToCheck) {
          if (!field) continue
          
          const percentage = extractPercentageFromText(field)
          if (percentage !== null) {
            logProgress(`Found percentage: ${percentage}% in ${resultItem.type}`)
            return percentage
          }
        }
        
        // Check extra data if available
        if (resultItem.extra) {
          const extraStr = JSON.stringify(resultItem.extra)
          const percentage = extractPercentageFromText(extraStr)
          if (percentage !== null) {
            logProgress(`Found percentage: ${percentage}% in extra data`)
            return percentage
          }
        }
        
        // Check rating widget
        if (resultItem.rating) {
          // Convert rating to percentage if it's not already
          if (resultItem.rating.value && resultItem.rating.scale) {
            const rating = parseFloat(resultItem.rating.value)
            const scale = parseFloat(resultItem.rating.scale)
            const percentage = Math.round((rating / scale) * 100)
            logProgress(`Found rating: ${rating}/${scale} = ${percentage}%`)
            return percentage
          }
        }
      }
      
      // Check people_also_ask section
      if (task.result[0].people_also_ask) {
        for (const paa of task.result[0].people_also_ask) {
          const percentage = extractPercentageFromText(paa.title || '')
          if (percentage !== null) {
            logProgress(`Found percentage: ${percentage}% in people_also_ask`)
            return percentage
          }
        }
      }
    }
    
    logProgress('No percentage found after trying all queries')
    return null
    
  } catch (error) {
    console.error(`Error fetching also-liked for "${item.title}":`, error)
    throw error
  }
}

// Update also-liked percentage in database
async function updateAlsoLikedPercentage(tmdbId: number, mediaType: string, percentage: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('media_items')
      .update({ 
        also_liked_percentage: percentage,
        also_liked_updated_at: new Date().toISOString()
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
async function processQueueItem(item: QueueItem, index: number, total: number): Promise<boolean> {
  const retries = item.retries || 0
  const maxRetries = 3
  
  logProgress(`\nProcessing ${index + 1} of ${total}: "${item.title}" (${item.year || 'N/A'})`)
  
  try {
    // Fetch percentage from DataForSEO
    const percentage = await fetchAlsoLikedPercentage(item)
    
    if (percentage === null) {
      // No percentage found, but not an error
      logProgress(`No percentage data available for "${item.title}"`)
      return true // Remove from queue
    }
    
    // Update database
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
  logProgress('🎬 Also-Liked Background Worker (Fixed)')
  logProgress('======================================')
  
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
  logProgress(`Failed items: ${stats.failed}`)
  logProgress(`Runtime: ${minutes}m ${seconds}s`)
  
  if (stats.failed > 0) {
    logProgress(`\n⚠️  ${stats.failed} items failed and were saved to: ${FAILED_FILE}`)
  }
  
  // Cost summary
  const totalCost = (stats.processed * 0.003).toFixed(2)
  logProgress(`\n💰 DataForSEO cost: ~$${totalCost}`)
}

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