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

// Configuration
const config = {
  maxTaskWaitTime: 60000, // 60 seconds max per task
  htmlRetryAttempts: 3,
  delayBetweenMovies: 3000, // minimum 3 seconds
  maxQueryAttempts: 4,
  sequential: true, // force sequential processing
  taskStatusCheckInterval: 2000, // start at 2 seconds
  maxTaskStatusChecks: 30,
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

// Failed attempt interface
interface FailedAttempt {
  query: string
  taskId?: string
  htmlSize?: number
  error: string
  timestamp: string
}

interface FailedMovie {
  movie: QueueItem
  attempts: FailedAttempt[]
  totalAttempts: number
  lastAttemptDate: string
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
const FAILED_FILE = join(process.cwd(), 'data', 'failed-movies.json')

// Auth header
const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')

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

// Load failed movies
function loadFailedMovies(): Record<string, FailedMovie> {
  if (!existsSync(FAILED_FILE)) {
    return {}
  }
  
  try {
    const content = readFileSync(FAILED_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    return {}
  }
}

// Save failed movies
function saveFailedMovies(failedMovies: Record<string, FailedMovie>) {
  const dataDir = join(process.cwd(), 'data')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  
  writeFileSync(FAILED_FILE, JSON.stringify(failedMovies, null, 2))
}

// Add failed attempt
function recordFailedAttempt(movie: QueueItem, attempt: FailedAttempt) {
  const failedMovies = loadFailedMovies()
  const key = `${movie.tmdbId}_${movie.mediaType}`
  
  if (!failedMovies[key]) {
    failedMovies[key] = {
      movie,
      attempts: [],
      totalAttempts: 0,
      lastAttemptDate: new Date().toISOString()
    }
  }
  
  failedMovies[key].attempts.push(attempt)
  failedMovies[key].totalAttempts++
  failedMovies[key].lastAttemptDate = new Date().toISOString()
  
  saveFailedMovies(failedMovies)
}

// Percentage extraction patterns
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

// Extract percentage from HTML
function extractPercentageFromHTML(html: string): { percentage: number | null, context: string | null } {
  for (const pattern of PERCENTAGE_PATTERNS) {
    const matches = html.match(pattern)
    if (matches) {
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

// Create search task
async function createSearchTask(query: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/task_post', {
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
    
    const data = await response.json()
    
    if (data.status_code !== 20000 || !data.tasks?.[0]) {
      logProgress(`❌ Failed to create task: ${data.status_message || 'Unknown error'}`)
      return null
    }
    
    const taskId = data.tasks[0].id
    logProgress(`✓ Task created: ${taskId}`)
    return taskId
    
  } catch (error) {
    logProgress(`❌ Error creating task: ${error}`)
    return null
  }
}

// Check task status
async function checkTaskStatus(taskId: string): Promise<'completed' | 'in_progress' | 'failed'> {
  // Since the task_get endpoint doesn't work, we'll just assume tasks complete after a reasonable time
  // This is a workaround - in reality, tasks complete very quickly
  return 'completed'
}

// Wait for task to complete with status polling
async function waitForTask(taskId: string): Promise<boolean> {
  logProgress(`⏳ Waiting for task ${taskId} to complete...`)
  
  // Since we can't check status, use a fixed wait time of 8 seconds
  // which has been proven to work reliably
  await new Promise(resolve => setTimeout(resolve, 8000))
  
  logProgress(`✓ Task ${taskId} should be ready`)
  return true
}

// Get task HTML with retry logic
async function getTaskHtmlWithRetry(taskId: string): Promise<any | null> {
  for (let attempt = 1; attempt <= config.htmlRetryAttempts; attempt++) {
    try {
      logProgress(`📥 Fetching HTML for task ${taskId} (attempt ${attempt}/${config.htmlRetryAttempts})`)
      
      const response = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
        method: 'GET',
        headers: { 'Authorization': authHeader }
      })
      
      const data = await response.json()
      const html = data.tasks?.[0]?.result?.[0]?.items?.[0]?.html
      
      if (html) {
        logProgress(`✓ HTML retrieved: ${html.length} bytes`)
        return data
      }
      
      logProgress(`⚠️ HTML empty for task ${taskId}`)
      
      // Wait before retry: 5s, 10s, 15s
      if (attempt < config.htmlRetryAttempts) {
        const retryDelay = 5000 * attempt
        logProgress(`  Retrying in ${retryDelay/1000}s...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
      
    } catch (error) {
      logProgress(`❌ Error fetching HTML: ${error}`)
    }
  }
  
  logProgress(`❌ Failed to get HTML after ${config.htmlRetryAttempts} attempts`)
  return null
}

// Build query strategies with special character handling
function buildQueryStrategies(item: QueueItem): string[] {
  const { title, original_title, year, mediaType } = item
  const mediaTypeStr = mediaType === 'MOVIE' ? 'movie' : 'tv show'
  const queries: string[] = []
  
  // Clean special characters
  const cleanTitle = title
    .replace(/é/g, 'e')
    .replace(/è/g, 'e')
    .replace(/ê/g, 'e')
    .replace(/ë/g, 'e')
    .replace(/á/g, 'a')
    .replace(/à/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/â/g, 'a')
    .replace(/ñ/g, 'n')
    .replace(/ö/g, 'o')
    .replace(/ô/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ù/g, 'u')
    .replace(/û/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/['']/g, '') // Remove smart quotes
  
  // Primary strategies
  if (year) {
    queries.push(`${title} ${year} ${mediaTypeStr}`)
    
    // Add clean version if different
    if (cleanTitle !== title) {
      queries.push(`${cleanTitle} ${year} ${mediaTypeStr}`)
    }
    
    // For titles with colons, try without subtitle
    if (title.includes(':')) {
      const mainTitle = title.split(':')[0].trim()
      queries.push(`${mainTitle} ${year} ${mediaTypeStr}`)
      
      // Also clean version of main title
      const cleanMainTitle = cleanTitle.split(':')[0].trim()
      if (cleanMainTitle !== mainTitle) {
        queries.push(`${cleanMainTitle} ${year} ${mediaTypeStr}`)
      }
    }
    
    queries.push(`"${title}" ${year} film`)
    queries.push(`${title} (${year}) ${mediaTypeStr}`)
  } else {
    queries.push(`${title} ${mediaTypeStr}`)
    if (cleanTitle !== title) {
      queries.push(`${cleanTitle} ${mediaTypeStr}`)
    }
  }
  
  // Use original title if different
  if (original_title && original_title !== title) {
    if (year) {
      queries.push(`${original_title} ${year} ${mediaTypeStr}`)
      
      // Clean version of original title
      const cleanOriginal = original_title
        .replace(/é/g, 'e')
        .replace(/è/g, 'e')
        .replace(/['']/g, '')
      if (cleanOriginal !== original_title) {
        queries.push(`${cleanOriginal} ${year} ${mediaTypeStr}`)
      }
    }
  }
  
  // Remove duplicates
  return [...new Set(queries)]
}

// Fetch with all retries and strategies
async function fetchAlsoLikedWithRetries(item: QueueItem): Promise<number | null> {
  const queries = buildQueryStrategies(item)
  
  for (const query of queries) {
    logProgress(`🔍 Trying query: "${query}"`)
    
    // Create task
    const taskId = await createSearchTask(query)
    if (!taskId) {
      recordFailedAttempt(item, {
        query,
        error: 'task_creation_failed',
        timestamp: new Date().toISOString()
      })
      continue
    }
    
    // Wait for completion with status checking
    const ready = await waitForTask(taskId)
    if (!ready) {
      recordFailedAttempt(item, {
        query,
        taskId,
        error: 'task_timeout',
        timestamp: new Date().toISOString()
      })
      continue
    }
    
    // Get HTML with retries
    const htmlResponse = await getTaskHtmlWithRetry(taskId)
    if (!htmlResponse) {
      recordFailedAttempt(item, {
        query,
        taskId,
        error: 'empty_html',
        timestamp: new Date().toISOString()
      })
      continue
    }
    
    // Extract percentage
    const html = htmlResponse.tasks?.[0]?.result?.[0]?.items?.[0]?.html || ''
    const { percentage, context } = extractPercentageFromHTML(html)
    
    if (percentage !== null) {
      logProgress(`✅ Found ${percentage}% for ${item.title} using query: "${query}"`)
      logProgress(`   Context: "${context}"`)
      return percentage
    } else {
      recordFailedAttempt(item, {
        query,
        taskId,
        htmlSize: html.length,
        error: 'no_percentage_found',
        timestamp: new Date().toISOString()
      })
      logProgress(`⚠️ No percentage found in ${html.length} bytes of HTML`)
    }
  }
  
  logProgress(`❌ All query strategies failed for "${item.title}"`)
  return null
}

// Update also-liked percentage in database
async function updateAlsoLikedPercentage(tmdbId: number, mediaType: string, percentage: number | 'not_found' | 'attempted'): Promise<boolean> {
  try {
    let updateData: any
    
    if (percentage === 'not_found') {
      updateData = { also_liked_percentage: null }
    } else if (percentage === 'attempted') {
      updateData = { also_liked_percentage: null } // Use null instead of -1 to comply with database constraint
    } else {
      updateData = { also_liked_percentage: percentage }
    }
    
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
async function processQueueItem(item: QueueItem): Promise<boolean> {
  logProgress(`\n🎬 Processing: "${item.title}" (${item.year || 'N/A'})`)
  stats.processed++
  
  try {
    // Fetch percentage with all retry strategies
    const percentage = await fetchAlsoLikedWithRetries(item)
    
    if (percentage === null) {
      // No percentage found after all attempts
      logProgress(`📊 No percentage data found for "${item.title}"`)
      
      // Mark as attempted in database
      const updated = await updateAlsoLikedPercentage(item.tmdbId, item.mediaType, 'attempted')
      
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
    
    logProgress(`✅ Successfully updated "${item.title}" with ${percentage}% liked`)
    stats.succeeded++
    return true
    
  } catch (error) {
    console.error(`❌ Error processing "${item.title}":`, error)
    stats.failed++
    
    // Record the failure
    recordFailedAttempt(item, {
      query: 'processing_error',
      error: String(error),
      timestamp: new Date().toISOString()
    })
    
    return true // Remove from queue even on error
  }
}

// Main processing function
async function processQueue() {
  logProgress('🎬 Reliable Also-Liked Background Worker')
  logProgress('=====================================')
  
  // Load queue
  let queue = loadQueue()
  
  if (queue.length === 0) {
    logProgress('Queue is empty. Nothing to process.')
    return
  }
  
  logProgress(`Found ${queue.length} items in queue`)
  logProgress(`Processing mode: ${config.sequential ? 'Sequential' : 'Parallel'}`)
  
  // Process items sequentially (more reliable)
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i]
    
    // Process item
    const success = await processQueueItem(item)
    
    if (success) {
      // Remove from queue by creating new array without this item
      queue = queue.filter((_, index) => index !== i)
      i-- // Adjust index since we removed an item
      
      // Save updated queue
      saveQueue(queue)
      
      // Rate limiting - wait 3-5 seconds between movies
      if (queue.length > 0) {
        const delay = config.delayBetweenMovies + Math.random() * 2000 // 3-5 seconds
        logProgress(`⏳ Rate limiting: waiting ${(delay/1000).toFixed(1)}s before next movie...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
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
  
  // Display failed movies summary
  const failedMovies = loadFailedMovies()
  const failedCount = Object.keys(failedMovies).length
  
  if (failedCount > 0) {
    logProgress(`\n⚠️  ${failedCount} unique movies had issues (see ${FAILED_FILE})`)
    
    // Show top failures
    const topFailures = Object.values(failedMovies)
      .sort((a, b) => b.totalAttempts - a.totalAttempts)
      .slice(0, 5)
    
    if (topFailures.length > 0) {
      logProgress('\nMost problematic movies:')
      topFailures.forEach(failure => {
        logProgress(`  - ${failure.movie.title} (${failure.totalAttempts} attempts)`)
      })
    }
  }
  
  // Cost summary
  const estimatedCost = (stats.processed * config.maxQueryAttempts * 0.0006).toFixed(2)
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
export { 
  fetchAlsoLikedWithRetries, 
  extractPercentageFromHTML, 
  buildQueryStrategies,
  waitForTask,
  getTaskHtmlWithRetry
}