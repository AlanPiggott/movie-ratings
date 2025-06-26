#!/usr/bin/env tsx

// Uses the production DataForSEO service for consistency with live site

// Load environment variables FIRST
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'

const envResult = dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })
if (envResult.error) {
  console.error('❌ Error loading .env.local:', envResult.error)
  process.exit(1)
}

// Now import dependencies
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { dataForSeoService } from '../services/dataforseo'
import { mediaService } from '../services/database'
import type { MediaType } from '../services/database/media.service'

// Types
interface QueueItem {
  tmdbId: number
  title: string
  year: number | null
  mediaType: MediaType
  retries?: number
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
const FAILED_FILE = join(process.cwd(), 'data', 'top-rated-failed.json')
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

// Load/save failed items
function loadFailedItems(): QueueItem[] {
  if (!existsSync(FAILED_FILE)) return []
  try {
    return JSON.parse(readFileSync(FAILED_FILE, 'utf-8'))
  } catch {
    return []
  }
}

function saveFailedItems(items: QueueItem[]) {
  writeFileSync(FAILED_FILE, JSON.stringify(items, null, 2))
}

// Save progress
function saveProgress() {
  writeFileSync(PROGRESS_FILE, JSON.stringify(stats, null, 2))
}

// Fetch top-rated movies from TMDB
async function fetchTopRatedMovies(pages: number = 1): Promise<any[]> {
  log(`Fetching top-rated movies (${pages} pages)...`, '🎬')
  const results: any[] = []
  
  for (let page = 1; page <= pages; page++) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/top_rated?api_key=${process.env.TMDB_API_KEY}&language=en-US&page=${page}`
      )
      
      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`)
      }
      
      const data = await response.json()
      results.push(...data.results)
      log(`Fetched movie page ${page}/${pages} (${data.results.length} items)`)
      
      if (page < pages) {
        await new Promise(resolve => setTimeout(resolve, 250))
      }
    } catch (error) {
      console.error(`Error fetching movies page ${page}:`, error)
    }
  }
  
  return results
}

// Fetch top-rated TV shows from TMDB
async function fetchTopRatedTVShows(pages: number = 1): Promise<any[]> {
  log(`Fetching top-rated TV shows (${pages} pages)...`, '📺')
  const results: any[] = []
  
  for (let page = 1; page <= pages; page++) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/tv/top_rated?api_key=${process.env.TMDB_API_KEY}&language=en-US&page=${page}`
      )
      
      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`)
      }
      
      const data = await response.json()
      results.push(...data.results)
      log(`Fetched TV page ${page}/${pages} (${data.results.length} items)`)
      
      if (page < pages) {
        await new Promise(resolve => setTimeout(resolve, 250))
      }
    } catch (error) {
      console.error(`Error fetching TV page ${page}:`, error)
    }
  }
  
  return results
}

// Process single item using production service
async function processItem(item: QueueItem, index: number, total: number) {
  const type = item.mediaType === 'MOVIE' ? 'movie' : 'TV show'
  log(`Processing ${index + 1}/${total}: "${item.title}" (${item.year || 'N/A'})`, '🎬')
  
  try {
    // Check if already exists
    const existingItems = await mediaService.searchMedia('', {
      tmdbId: item.tmdbId,
      mediaType: item.mediaType
    }, { limit: 1 })
    
    if (existingItems.total > 0) {
      const existing = existingItems.items[0]
      stats.alreadyInDb++
      log(`Already in database`, '✅')
      
      // Update rating if missing
      if (!existing.also_liked_percentage) {
        // Build search queries like the API does
        const mediaTypeStr = item.mediaType === 'TV_SHOW' ? 'tv show' : 'movie'
        const queries: string[] = []
        
        if (item.year) {
          queries.push(`${item.title} ${item.year} ${mediaTypeStr}`)
          
          // For titles with colons, try without subtitle
          if (item.title.includes(':')) {
            const mainTitle = item.title.split(':')[0].trim()
            queries.push(`${mainTitle} ${item.year} ${mediaTypeStr}`)
          }
          
          queries.push(`"${item.title}" ${item.year} film`)
          queries.push(`${item.title} (${item.year}) ${mediaTypeStr}`)
        }
        
        queries.push(`${item.title} ${mediaTypeStr}`)
        
        // Try each query
        let foundPercentage: number | null = null
        for (const query of queries) {
          log(`Checking rating for "${query}"`, '🔍')
          const result = await dataForSeoService.searchGoogleKnowledge(query)
          
          if (result.percentage !== null) {
            foundPercentage = result.percentage
            break
          }
        }
        
        if (foundPercentage !== null) {
          await mediaService.createOrUpdateMedia({
            tmdbId: existing.tmdb_id,
            mediaType: existing.media_type,
            title: existing.title,
            alsoLikedPercentage: foundPercentage
          })
          
          stats.ratingsFound++
          log(`Success: ${foundPercentage}% liked this ${type}`, '✅')
        } else {
          stats.ratingsFailed++
          log(`No rating found`, '❌')
        }
      }
      
      return
    }
    
    // Fetch full details from TMDB
    const endpoint = item.mediaType === 'MOVIE'
      ? `https://api.themoviedb.org/3/movie/${item.tmdbId}`
      : `https://api.themoviedb.org/3/tv/${item.tmdbId}`
    
    const detailsRes = await fetch(
      `${endpoint}?api_key=${process.env.TMDB_API_KEY}&language=en-US&append_to_response=genres`
    )
    
    if (!detailsRes.ok) {
      throw new Error(`TMDB details fetch failed: ${detailsRes.statusText}`)
    }
    
    const details = await detailsRes.json()
    
    // Create media item with genres
    const genres = (details.genres || []).map((g: any) => ({
      tmdbId: g.id,
      name: g.name
    }))
    
    await mediaService.createOrUpdateMedia({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      title: item.title,
      releaseDate: item.mediaType === 'MOVIE' ? details.release_date : details.first_air_date,
      posterPath: details.poster_path,
      overview: details.overview,
      originalTitle: item.mediaType === 'MOVIE' ? details.original_title : details.original_name,
      popularity: details.popularity,
      voteAverage: details.vote_average,
      voteCount: details.vote_count,
      runtime: item.mediaType === 'MOVIE' ? details.runtime : (details.episode_run_time?.[0] || null),
      status: details.status,
      genres
    })
    
    stats.newItems++
    log(`Added to database`, '➕')
    
    // Fetch rating using production service
    const mediaTypeStr = item.mediaType === 'TV_SHOW' ? 'tv show' : 'movie'
    const queries: string[] = []
    
    if (item.year) {
      queries.push(`${item.title} ${item.year} ${mediaTypeStr}`)
      
      if (item.title.includes(':')) {
        const mainTitle = item.title.split(':')[0].trim()
        queries.push(`${mainTitle} ${item.year} ${mediaTypeStr}`)
      }
      
      queries.push(`"${item.title}" ${item.year} film`)
      queries.push(`${item.title} (${item.year}) ${mediaTypeStr}`)
    }
    
    queries.push(`${item.title} ${mediaTypeStr}`)
    
    let foundPercentage: number | null = null
    for (const query of queries) {
      log(`Checking rating for "${query}"`, '🔍')
      const result = await dataForSeoService.searchGoogleKnowledge(query)
      
      if (result.percentage !== null) {
        foundPercentage = result.percentage
        break
      }
    }
    
    if (foundPercentage !== null) {
      await mediaService.createOrUpdateMedia({
        tmdbId: item.tmdbId,
        mediaType: item.mediaType,
        title: item.title,
        alsoLikedPercentage: foundPercentage
      })
      
      stats.ratingsFound++
      log(`Success: ${foundPercentage}% liked this ${type}`, '✅')
    } else {
      stats.ratingsFailed++
      log(`No rating found`, '❌')
    }
    
  } catch (error) {
    stats.errors++
    console.error(`Error:`, error)
    
    // Add to failed items
    const failedItems = loadFailedItems()
    failedItems.push(item)
    saveFailedItems(failedItems)
  }
  
  stats.processed++
  saveProgress()
}

// Main
async function main() {
  log('Top-Rated Content Updater (Using Production Service)', '🎬')
  log('=' .repeat(60), '')
  
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
    
    // Rate limiting - DataForSEO service has built-in delays
    // but we add extra to be safe
    if (queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
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
  log(`Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`)
  
  // Get cost from service
  try {
    const cost = await dataForSeoService.getTotalCosts(new Date(stats.startTime))
    log(`Actual cost: $${cost.toFixed(2)}`)
  } catch {
    const estCost = (stats.ratingsFound + stats.ratingsFailed) * 0.0006
    log(`Est. cost: $${estCost.toFixed(2)}`)
  }
}

// Run
main().catch(console.error)