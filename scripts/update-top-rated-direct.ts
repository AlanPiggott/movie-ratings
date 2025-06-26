#!/usr/bin/env tsx

// Direct version that doesn't import services with env validation

// Load environment variables FIRST
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'

const envResult = dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })
if (envResult.error) {
  console.error('❌ Error loading .env.local:', envResult.error)
  process.exit(1)
}

// Check required env vars manually
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
  console.error('Make sure your .env.local file contains all required variables')
  process.exit(1)
}

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase directly
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

// Stats
const stats = {
  processed: 0,
  alreadyInDb: 0,
  newItems: 0,
  ratingsFound: 0,
  ratingsFailed: 0,
  errors: 0,
  startTime: Date.now()
}

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

// DataForSEO search using task-based approach (same as production)
async function searchGoogleForPercentage(query: string): Promise<number | null> {
  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64')
  
  try {
    // Step 1: Create task
    const createResponse = await fetch('https://api.dataforseo.com/v3/serp/google/organic/task_post', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
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
    
    const createData = await createResponse.json()
    if (createData.status_code !== 20000 || !createData.tasks?.[0]?.id) {
      throw new Error('Failed to create search task')
    }
    
    const taskId = createData.tasks[0].id
    
    // Step 2: Wait for completion
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Step 3: Fetch HTML
    const htmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + auth
      }
    })
    
    const htmlData = await htmlResponse.json()
    if (htmlData.status_code !== 20000) {
      throw new Error('Failed to fetch HTML')
    }
    
    const html = htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html
    if (!html) return null
    
    // Step 4: Extract percentage (same patterns as production)
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
              return percentage
            }
          }
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('Search error:', error)
    return null
  }
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
      log(`Fetched page ${page}/${pages}`)
      
      if (page < pages) {
        await new Promise(resolve => setTimeout(resolve, 250))
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error)
    }
  }
  
  return results
}

// Process single item
async function processItem(item: QueueItem, index: number, total: number) {
  const type = item.mediaType === 'MOVIE' ? 'movie' : 'TV show'
  log(`Processing ${index + 1}/${total}: "${item.title}" (${item.year || 'N/A'})`, '🎬')
  
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
      log(`Already in database`, '✅')
      
      // Update rating if missing
      if (!existing.also_liked_percentage) {
        // Try multiple query formats
        const queries = []
        if (item.year) {
          queries.push(`${item.title} ${item.year} ${type}`)
          queries.push(`"${item.title}" ${item.year} film`)
        }
        queries.push(`${item.title} ${type}`)
        
        let foundPercentage: number | null = null
        for (const query of queries) {
          log(`Checking rating for "${query}"`, '🔍')
          const percentage = await searchGoogleForPercentage(query)
          if (percentage !== null) {
            foundPercentage = percentage
            break
          }
        }
        
        if (foundPercentage !== null) {
          await supabase
            .from('media_items')
            .update({ also_liked_percentage: foundPercentage })
            .eq('id', existing.id)
          
          stats.ratingsFound++
          log(`Success: ${foundPercentage}% liked this ${type}`, '✅')
        } else {
          stats.ratingsFailed++
          log(`No rating found`, '❌')
        }
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
    log(`Added to database`, '➕')
    
    // Fetch rating
    const queries = []
    if (item.year) {
      queries.push(`${item.title} ${item.year} ${type}`)
      queries.push(`"${item.title}" ${item.year} film`)
    }
    queries.push(`${item.title} ${type}`)
    
    let foundPercentage: number | null = null
    for (const query of queries) {
      log(`Checking rating for "${query}"`, '🔍')
      const percentage = await searchGoogleForPercentage(query)
      if (percentage !== null) {
        foundPercentage = percentage
        break
      }
    }
    
    if (foundPercentage !== null && newItem) {
      await supabase
        .from('media_items')
        .update({ also_liked_percentage: foundPercentage })
        .eq('id', newItem.id)
      
      stats.ratingsFound++
      log(`Success: ${foundPercentage}% liked this ${type}`, '✅')
    } else {
      stats.ratingsFailed++
      log(`No rating found`, '❌')
    }
    
  } catch (error) {
    stats.errors++
    console.error(`Error:`, error)
  }
  
  stats.processed++
}

// Main
async function main() {
  log('Top-Rated Content Updater (Direct Version)', '🎬')
  log('=' .repeat(50), '')
  
  const isTest = process.env.TEST_MODE === 'true'
  const pages = isTest ? 1 : 250  // 250 pages × 20 items = 5000 each
  const limit = isTest ? 5 : 5000  // 5000 movies + 5000 TV shows = 10,000 total
  
  if (isTest) {
    log('TEST MODE: Processing only 5 movies and 5 TV shows', '🧪')
  } else {
    log('FULL MODE: Processing 10,000 items (5,000 movies + 5,000 TV shows)', '🚀')
    log('This will take several hours. You can safely stop and resume anytime.', '💡')
  }
  
  let queue = loadQueue()
  
  if (queue.length === 0) {
    log('Fetching from TMDB...', '📊')
    
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
  
  const total = queue.length
  let index = 0
  
  while (queue.length > 0) {
    const item = queue.shift()!
    await processItem(item, index++, total)
    saveQueue(queue)
    
    if (queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  // Summary
  const runtime = Math.round((Date.now() - stats.startTime) / 1000)
  console.log('\n' + '=' .repeat(50))
  log('Complete!', '✅')
  console.log('=' .repeat(50))
  log(`Processed: ${stats.processed}`)
  log(`Already in DB: ${stats.alreadyInDb}`)
  log(`New items: ${stats.newItems}`)
  log(`Ratings found: ${stats.ratingsFound}`)
  log(`No ratings: ${stats.ratingsFailed}`)
  log(`Errors: ${stats.errors}`)
  log(`Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`)
  
  const cost = (stats.ratingsFound + stats.ratingsFailed) * 0.0006
  log(`Est. cost: $${cost.toFixed(2)}`)
  
  // Time estimates
  const avgTimePerItem = runtime / stats.processed
  const remainingItems = 10000 - stats.processed
  const estimatedTimeRemaining = Math.round(avgTimePerItem * remainingItems)
  if (remainingItems > 0) {
    log(`Est. time for remaining ${remainingItems} items: ${Math.floor(estimatedTimeRemaining / 3600)}h ${Math.floor((estimatedTimeRemaining % 3600) / 60)}m`)
  }
}

// Run
main().catch(console.error)