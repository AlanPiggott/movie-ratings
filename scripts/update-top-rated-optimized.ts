#!/usr/bin/env tsx

// Optimized version with concurrent processing and smart query ordering

// Load environment variables FIRST
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'

const envResult = dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })
if (envResult.error) {
  console.error('❌ Error loading .env.local:', envResult.error)
  process.exit(1)
}

// Check required env vars
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_KEY', 
  'TMDB_API_KEY',
  'DATAFORSEO_LOGIN',
  'DATAFORSEO_PASSWORD'
]

const missingEnvVars = requiredEnvVars.filter(key => !process.env[key])
if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars)
  process.exit(1)
}

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Types
type MediaType = 'MOVIE' | 'TV_SHOW'

interface QueueItem {
  tmdbId: number
  title: string
  year: number | null
  mediaType: MediaType
}

// Configuration
const CONFIG = {
  CONCURRENT_ITEMS: 12,        // Process 12 items at once
  RATE_LIMIT_PER_SEC: 18,     // Stay under 20/sec limit
  INITIAL_BACKOFF_MS: 1000,   // Start with 1 second backoff
  MAX_BACKOFF_MS: 60000,      // Max 1 minute backoff
  TASK_COMPLETION_WAIT: 5000, // Wait 5 seconds for task completion
}

// Stats
const stats = {
  processed: 0,
  alreadyInDb: 0,
  newItems: 0,
  ratingsFound: 0,
  ratingsFailed: 0,
  errors: 0,
  apiCalls: 0,
  startTime: Date.now(),
  lastProgressUpdate: Date.now()
}

// Rate limiting
const requestTimestamps: number[] = []
let currentBackoff = 0

// File paths
const QUEUE_FILE = join(process.cwd(), 'data', 'top-rated-queue.json')
const PROGRESS_FILE = join(process.cwd(), 'data', 'top-rated-progress.json')

// Ensure data directory exists
const dataDir = join(process.cwd(), 'data')
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true })
}

// Progress logging
function log(message: string, emoji: string = '') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  console.log(`[${timestamp}] ${emoji} ${message}`.trim())
}

// Progress bar
function showProgress() {
  const now = Date.now()
  const elapsed = (now - stats.startTime) / 1000
  const itemsPerSec = stats.processed / elapsed
  const progress = ((stats.processed / 10000) * 100).toFixed(1)
  
  // Only update every 5 seconds to avoid console spam
  if (now - stats.lastProgressUpdate > 5000) {
    console.log(`\n📊 Progress: ${progress}% | ${stats.processed}/10000 | ${itemsPerSec.toFixed(1)} items/sec | API calls: ${stats.apiCalls}`)
    stats.lastProgressUpdate = now
  }
}

// Load/save queue
function loadQueue(): QueueItem[] {
  if (!existsSync(QUEUE_FILE)) return []
  try {
    return JSON.parse(readFileSync(QUEUE_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function saveQueue(queue: QueueItem[]) {
  writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2))
}

// Rate limiting check
async function checkRateLimit() {
  const now = Date.now()
  const oneSecondAgo = now - 1000
  
  // Remove old timestamps
  while (requestTimestamps.length > 0 && requestTimestamps[0] < oneSecondAgo) {
    requestTimestamps.shift()
  }
  
  // If we're at the limit, wait
  if (requestTimestamps.length >= CONFIG.RATE_LIMIT_PER_SEC) {
    const oldestTimestamp = requestTimestamps[0]
    const waitTime = Math.max(0, 1000 - (now - oldestTimestamp))
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
  
  // Add current timestamp
  requestTimestamps.push(Date.now())
}

// Exponential backoff
async function handleRateLimit(attempt: number) {
  currentBackoff = Math.min(
    CONFIG.INITIAL_BACKOFF_MS * Math.pow(2, attempt),
    CONFIG.MAX_BACKOFF_MS
  )
  log(`Rate limited. Waiting ${currentBackoff/1000}s...`, '⏳')
  await new Promise(resolve => setTimeout(resolve, currentBackoff))
}

// Clean title for special characters
function cleanTitle(title: string): string {
  return title
    .replace(/['']/g, '') // Remove smart quotes
    .replace(/[éèêë]/g, 'e')
    .replace(/[áàäâ]/g, 'a')
    .replace(/[ñ]/g, 'n')
    .replace(/[öô]/g, 'o')
    .replace(/[üùû]/g, 'u')
    .replace(/[ç]/g, 'c')
}

// DataForSEO search with smart query ordering
async function searchGoogleForPercentage(item: QueueItem): Promise<number | null> {
  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64')
  
  // Build queries based on media type
  const queries: string[] = []
  const mediaTypeStr = item.mediaType === 'TV_SHOW' ? 'tv show' : 'movie'
  const cleanedTitle = cleanTitle(item.title)
  
  if (item.mediaType === 'TV_SHOW') {
    // TV shows - prioritize "tv show" queries
    if (item.year) {
      queries.push(`${item.title} ${item.year} tv show`)
      queries.push(`${item.title} (${item.year}) tv show`)
      
      // Add clean version if different
      if (cleanedTitle !== item.title) {
        queries.push(`${cleanedTitle} ${item.year} tv show`)
      }
      
      // For titles with colons, try without subtitle
      if (item.title.includes(':')) {
        const mainTitle = item.title.split(':')[0].trim()
        queries.push(`${mainTitle} ${item.year} tv show`)
      }
    }
    queries.push(`${item.title} tv show`)
    queries.push(`${item.title} series`)
  } else {
    // Movies - prioritize "movie" queries
    if (item.year) {
      queries.push(`${item.title} ${item.year} movie`)
      queries.push(`${item.title} (${item.year}) movie`)
      queries.push(`"${item.title}" ${item.year} film`)
      
      // Add clean version if different
      if (cleanedTitle !== item.title) {
        queries.push(`${cleanedTitle} ${item.year} movie`)
      }
      
      // For titles with colons, try without subtitle
      if (item.title.includes(':')) {
        const mainTitle = item.title.split(':')[0].trim()
        queries.push(`${mainTitle} ${item.year} movie`)
      }
      
      queries.push(`${item.title} ${item.year} film`)
    }
    queries.push(`${item.title} movie`)
  }
  
  // Try each query until we find a result
  for (const query of queries) {
    await checkRateLimit()
    stats.apiCalls++
    
    try {
      // Create task
      const createResponse = await fetch('https://api.dataforseo.com/v3/serp/google/organic/task_post', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + auth,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          language_code: 'en',
          location_code: 2840,
          keyword: query,
          device: 'desktop',
          os: 'windows'
        }])
      })
      
      if (createResponse.status === 429) {
        await handleRateLimit(0)
        continue
      }
      
      const createData = await createResponse.json()
      if (createData.status_code !== 20000 || !createData.tasks?.[0]?.id) {
        continue
      }
      
      const taskId = createData.tasks[0].id
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, CONFIG.TASK_COMPLETION_WAIT))
      
      // Fetch HTML
      await checkRateLimit()
      stats.apiCalls++
      
      const htmlResponse = await fetch(
        `https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`,
        {
          method: 'GET',
          headers: { 'Authorization': 'Basic ' + auth }
        }
      )
      
      if (htmlResponse.status === 429) {
        await handleRateLimit(0)
        continue
      }
      
      const htmlData = await htmlResponse.json()
      if (htmlData.status_code !== 20000) continue
      
      const html = htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html
      if (!html) continue
      
      // Extract percentage
      const patterns = [
        /(\d{1,3})%\s*liked\s*this\s*(movie|film|show|series)/gi,
        /(\d{1,3})%\s*of\s*(?:Google\s*)?users\s*liked/gi,
        />(\d{1,3})%\s*liked\s*this/gi,
        /class="[^"]*srBp4[^"]*"[^>]*>\s*(\d{1,3})%/gi,
        /(\d{1,3})%\s*liked/gi,
        /audience\s*score[:\s]*(\d{1,3})%/gi
      ]
      
      for (const pattern of patterns) {
        const matches = html.match(pattern)
        if (matches) {
          for (const match of matches) {
            const percentMatch = match.match(/(\d{1,3})/)
            if (percentMatch) {
              const percentage = parseInt(percentMatch[1])
              if (percentage >= 0 && percentage <= 100) {
                // Debug: show which query worked
                if (process.env.DEBUG_QUERIES === 'true') {
                  log(`✓ Found with query: "${query}"`, '🔍')
                }
                return percentage // Found it! Stop searching
              }
            }
          }
        }
      }
      
    } catch (error) {
      // Log error but continue to next query
      if (error instanceof Error && error.message.includes('429')) {
        await handleRateLimit(0)
      }
    }
  }
  
  return null
}

// Fetch top-rated content from TMDB
async function fetchTopRated(type: 'movie' | 'tv', pages: number): Promise<any[]> {
  const label = type === 'movie' ? 'movies' : 'TV shows'
  log(`Fetching top-rated ${label} (${pages} pages)...`, type === 'movie' ? '🎬' : '📺')
  const results: any[] = []
  
  for (let page = 1; page <= pages; page++) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/${type}/top_rated?api_key=${process.env.TMDB_API_KEY}&language=en-US&page=${page}`
      )
      const data = await response.json()
      results.push(...data.results)
      
      if (page % 10 === 0) {
        log(`Fetched ${type} pages ${page}/${pages}`)
      }
      
      if (page < pages) {
        await new Promise(resolve => setTimeout(resolve, 100)) // Faster TMDB fetching
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error)
    }
  }
  
  return results
}

// Process single item
async function processItem(item: QueueItem): Promise<void> {
  const emoji = item.mediaType === 'MOVIE' ? '🎬' : '📺'
  const yearStr = item.year ? ` (${item.year})` : ''
  
  try {
    // Check if exists
    const { data: existing } = await supabase
      .from('media_items')
      .select('id, also_liked_percentage')
      .eq('tmdb_id', item.tmdbId)
      .eq('media_type', item.mediaType)
      .single()
    
    if (existing) {
      stats.alreadyInDb++
      
      // Update rating if missing
      if (!existing.also_liked_percentage) {
        const percentage = await searchGoogleForPercentage(item)
        
        if (percentage !== null) {
          await supabase
            .from('media_items')
            .update({ also_liked_percentage: percentage })
            .eq('id', existing.id)
          
          stats.ratingsFound++
          log(`${emoji} ${item.title}${yearStr} → ${percentage}% liked ✅`)
        } else {
          stats.ratingsFailed++
          log(`${emoji} ${item.title}${yearStr} → No rating found ❌`)
        }
      } else {
        // Already has rating, just log it
        log(`${emoji} ${item.title}${yearStr} → Already has ${existing.also_liked_percentage}% ✓`)
      }
      return
    }
    
    // Fetch details from TMDB
    const endpoint = item.mediaType === 'MOVIE'
      ? `https://api.themoviedb.org/3/movie/${item.tmdbId}`
      : `https://api.themoviedb.org/3/tv/${item.tmdbId}`
    
    const detailsRes = await fetch(`${endpoint}?api_key=${process.env.TMDB_API_KEY}`)
    const details = await detailsRes.json()
    
    // Insert to database
    const { data: newItem } = await supabase
      .from('media_items')
      .insert({
        tmdb_id: item.tmdbId,
        media_type: item.mediaType,
        title: item.title,
        release_date: item.mediaType === 'MOVIE' ? details.release_date : details.first_air_date,
        poster_path: details.poster_path,
        overview: details.overview,
        popularity: details.popularity,
        vote_average: details.vote_average,
        vote_count: details.vote_count
      })
      .select()
      .single()
    
    stats.newItems++
    
    // Fetch rating
    const percentage = await searchGoogleForPercentage(item)
    
    if (percentage !== null && newItem) {
      await supabase
        .from('media_items')
        .update({ also_liked_percentage: percentage })
        .eq('id', newItem.id)
      
      stats.ratingsFound++
      log(`${emoji} ${item.title}${yearStr} → ${percentage}% liked ✅`)
    } else {
      stats.ratingsFailed++
      log(`${emoji} ${item.title}${yearStr} → No rating found ❌`)
    }
    
  } catch (error) {
    stats.errors++
    log(`${emoji} ${item.title}${yearStr} → Error: ${error instanceof Error ? error.message : 'Unknown'} ⚠️`)
  } finally {
    stats.processed++
    showProgress()
  }
}

// Process queue with concurrency
async function processQueueConcurrently(queue: QueueItem[]) {
  const processing = new Set<Promise<void>>()
  
  for (const item of queue) {
    // Wait if we're at concurrency limit
    while (processing.size >= CONFIG.CONCURRENT_ITEMS) {
      await Promise.race(processing)
    }
    
    // Start processing item
    const promise = processItem(item).then(() => {
      processing.delete(promise)
    })
    
    processing.add(promise)
  }
  
  // Wait for remaining items
  await Promise.all(processing)
}

// Main
async function main() {
  log('Top-Rated Content Updater (Optimized Version)', '🚀')
  log('=' .repeat(60), '')
  
  const isTest = process.env.TEST_MODE === 'true'
  const pages = isTest ? 1 : 250
  const limit = isTest ? 5 : 5000
  
  if (isTest) {
    log('TEST MODE: Processing only 5 movies and 5 TV shows', '🧪')
  } else {
    log(`OPTIMIZED MODE: ${CONFIG.CONCURRENT_ITEMS}x concurrent processing`, '⚡')
    log('Processing 10,000 items (5,000 movies + 5,000 TV shows)', '🎬')
    console.log('\n💡 Showing ratings as they are found:')
    console.log('=' .repeat(60))
  }
  
  let queue = loadQueue()
  
  if (queue.length === 0) {
    console.log('\n📊 Fetching from TMDB...')
    
    const [movies, tvShows] = await Promise.all([
      fetchTopRated('movie', pages),
      fetchTopRated('tv', pages)
    ])
    
    queue = [
      ...movies.slice(0, limit).map(m => ({
        tmdbId: m.id,
        title: m.title,
        year: m.release_date ? new Date(m.release_date).getFullYear() : null,
        mediaType: 'MOVIE' as MediaType
      })),
      ...tvShows.slice(0, limit).map(t => ({
        tmdbId: t.id,
        title: t.name,
        year: t.first_air_date ? new Date(t.first_air_date).getFullYear() : null,
        mediaType: 'TV_SHOW' as MediaType
      }))
    ]
    
    saveQueue(queue)
    log(`Created queue with ${queue.length} items`, '✅')
  } else {
    log(`Resuming queue (${queue.length} items)`, '🔄')
  }
  
  // Process with concurrency
  await processQueueConcurrently(queue)
  
  // Clear queue when done
  saveQueue([])
  
  // Summary
  const runtime = Math.round((Date.now() - stats.startTime) / 1000)
  console.log('\n' + '=' .repeat(60))
  log('Complete!', '✅')
  console.log('=' .repeat(60))
  log(`Processed: ${stats.processed}`)
  log(`Already in DB: ${stats.alreadyInDb}`)
  log(`New items: ${stats.newItems}`)
  log(`Ratings found: ${stats.ratingsFound}`)
  log(`No ratings: ${stats.ratingsFailed}`)
  log(`Errors: ${stats.errors}`)
  log(`Total API calls: ${stats.apiCalls}`)
  log(`Runtime: ${Math.floor(runtime / 3600)}h ${Math.floor((runtime % 3600) / 60)}m ${runtime % 60}s`)
  
  const cost = stats.apiCalls * 0.0006
  log(`Actual cost: $${cost.toFixed(2)}`)
  
  const avgTimePerItem = runtime / stats.processed
  const itemsPerSec = stats.processed / runtime
  log(`Performance: ${itemsPerSec.toFixed(1)} items/sec, ${avgTimePerItem.toFixed(1)}s per item`)
}

// Run
main().catch(console.error)