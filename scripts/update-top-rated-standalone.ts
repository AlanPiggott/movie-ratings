#!/usr/bin/env tsx

// Standalone version with minimal dependencies

// Load environment variables FIRST
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'

const envResult = dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })
if (envResult.error) {
  console.error('❌ Error loading .env.local:', envResult.error)
  console.error('Make sure you have a .env.local file with your environment variables')
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

// Fetch top-rated movies
async function fetchTopRatedMovies(pages: number = 1): Promise<any[]> {
  log(`Fetching top-rated movies (${pages} pages)...`, '🎬')
  const results: any[] = []
  
  for (let page = 1; page <= pages; page++) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/top_rated?api_key=${process.env.TMDB_API_KEY}&page=${page}`
      )
      const data = await response.json()
      results.push(...data.results)
      log(`Fetched movie page ${page}/${pages}`)
      
      if (page < pages) {
        await new Promise(resolve => setTimeout(resolve, 250))
      }
    } catch (error) {
      console.error(`Error fetching movies page ${page}:`, error)
    }
  }
  
  return results
}

// Fetch top-rated TV shows
async function fetchTopRatedTVShows(pages: number = 1): Promise<any[]> {
  log(`Fetching top-rated TV shows (${pages} pages)...`, '📺')
  const results: any[] = []
  
  for (let page = 1; page <= pages; page++) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/tv/top_rated?api_key=${process.env.TMDB_API_KEY}&page=${page}`
      )
      const data = await response.json()
      results.push(...data.results)
      log(`Fetched TV page ${page}/${pages}`)
      
      if (page < pages) {
        await new Promise(resolve => setTimeout(resolve, 250))
      }
    } catch (error) {
      console.error(`Error fetching TV page ${page}:`, error)
    }
  }
  
  return results
}

// Extract percentage from text
function extractPercentage(text: string): number | null {
  const patterns = [
    /(\d{1,3})%\s*liked/i,
    /(\d{1,3})%\s*of\s*(?:users|people)/i,
    /audience.*?(\d{1,3})%/i
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      const pct = parseInt(match[1], 10)
      if (pct >= 0 && pct <= 100) return pct
    }
  }
  
  return null
}

// Fetch rating from DataForSEO
async function fetchRating(item: QueueItem): Promise<number | null> {
  const type = item.mediaType === 'MOVIE' ? 'movie' : 'tv show'
  const query = item.year ? `${item.title} ${item.year} ${type}` : `${item.title} ${type}`
  
  log(`Checking rating for "${query}"`, '🔍')
  
  try {
    const auth = Buffer.from(
      `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
    ).toString('base64')
    
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        language_code: 'en',
        location_code: 2840,
        keyword: query
      }])
    })
    
    const data = await response.json()
    
    if (data.tasks?.[0]?.result?.[0]?.items) {
      for (const item of data.tasks[0].result[0].items) {
        const text = JSON.stringify(item)
        const pct = extractPercentage(text)
        if (pct !== null) return pct
      }
    }
  } catch (error) {
    console.error('Rating fetch error:', error)
  }
  
  return null
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
      log(`Already in database, skipping`, '✅')
      
      // Update rating if missing
      if (!existing.also_liked_percentage) {
        const rating = await fetchRating(item)
        if (rating !== null) {
          await supabase
            .from('media_items')
            .update({ also_liked_percentage: rating })
            .eq('id', existing.id)
          
          stats.ratingsFound++
          log(`Success: ${rating}% liked this ${type}`, '✅')
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
    const rating = await fetchRating(item)
    if (rating !== null) {
      await supabase
        .from('media_items')
        .update({ also_liked_percentage: rating })
        .eq('id', newItem.id)
      
      stats.ratingsFound++
      log(`Success: ${rating}% liked this ${type}`, '✅')
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
  log('Top-Rated Content Updater', '🎬')
  log('=' .repeat(50), '')
  
  // Test mode
  const isTest = process.env.TEST_MODE === 'true'
  const pages = isTest ? 1 : 50
  const limit = isTest ? 5 : 1000
  
  if (isTest) {
    log('TEST MODE: Processing only 5 movies and 5 TV shows', '🧪')
  }
  
  let queue = loadQueue()
  
  if (queue.length === 0) {
    log('Fetching from TMDB...', '📊')
    
    const [movies, tvShows] = await Promise.all([
      fetchTopRatedMovies(pages),
      fetchTopRatedTVShows(pages)
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
      await new Promise(resolve => setTimeout(resolve, 2000))
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
  
  const cost = (stats.ratingsFound + stats.ratingsFailed) * 0.003
  log(`Est. cost: $${cost.toFixed(2)}`)
}

// Run
main().catch(console.error)