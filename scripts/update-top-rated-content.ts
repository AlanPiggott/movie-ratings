#!/usr/bin/env tsx

// Load environment variables from .env.local BEFORE any other imports
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'

// Load env vars first
const envResult = dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })
if (envResult.error && !process.env.TEST_MODE) {
  console.error('❌ Error loading .env.local:', envResult.error)
  process.exit(1)
}

// Now safe to import other modules
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

// We'll use direct TMDB API calls to avoid the env validation in services
// import { tmdbService } from '../services/tmdb.service'
// import { mediaService } from '../services/database'
import type { MediaType } from '../services/database/media.service'

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
  moviesProcessed: 0,
  tvShowsProcessed: 0,
  alreadyInDb: 0,
  newItemsAdded: 0,
  ratingsFound: 0,
  ratingsFailed: 0,
  errors: 0,
  startTime: Date.now()
}

// File paths
const QUEUE_FILE = join(process.cwd(), 'data', 'top-rated-queue.json')
const FAILED_FILE = join(process.cwd(), 'data', 'top-rated-failed.json')
const PROGRESS_FILE = join(process.cwd(), 'data', 'top-rated-progress.json')

// Progress logging
function logProgress(message: string, emoji: string = '') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  console.log(`[${timestamp}] ${emoji} ${message}`.trim())
}

// Load queue from file
function loadQueue(): QueueItem[] {
  if (!existsSync(QUEUE_FILE)) {
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

// Save progress
function saveProgress() {
  const dataDir = join(process.cwd(), 'data')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  
  writeFileSync(PROGRESS_FILE, JSON.stringify(stats, null, 2))
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

// Fetch top-rated movies from TMDB
async function fetchTopRatedMovies(pages: number = 50): Promise<any[]> {
  // Test mode override
  if (process.env.TEST_MODE === 'true') {
    pages = parseInt(process.env.TEST_PAGES || '1', 10)
  }
  
  logProgress(`Fetching top-rated movies (${pages} pages)...`, '🎬')
  const allMovies: any[] = []
  
  for (let page = 1; page <= pages; page++) {
    try {
      const params = new URLSearchParams({
        api_key: process.env.TMDB_API_KEY!,
        language: 'en-US',
        page: page.toString(),
        region: 'US'
      })
      
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/top_rated?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          }
        }
      )
      
      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`)
      }
      
      const data = await response.json()
      allMovies.push(...data.results)
      
      logProgress(`Fetched movie page ${page}/${pages} (${data.results.length} items)`)
      
      // Rate limiting
      if (page < pages) {
        await new Promise(resolve => setTimeout(resolve, 250))
      }
    } catch (error) {
      console.error(`Error fetching movie page ${page}:`, error)
    }
  }
  
  return allMovies
}

// Fetch top-rated TV shows from TMDB
async function fetchTopRatedTVShows(pages: number = 50): Promise<any[]> {
  // Test mode override
  if (process.env.TEST_MODE === 'true') {
    pages = parseInt(process.env.TEST_PAGES || '1', 10)
  }
  
  logProgress(`Fetching top-rated TV shows (${pages} pages)...`, '📺')
  const allShows: any[] = []
  
  for (let page = 1; page <= pages; page++) {
    try {
      const params = new URLSearchParams({
        api_key: process.env.TMDB_API_KEY!,
        language: 'en-US',
        page: page.toString()
      })
      
      const response = await fetch(
        `https://api.themoviedb.org/3/tv/top_rated?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.TMDB_READ_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          }
        }
      )
      
      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.statusText}`)
      }
      
      const data = await response.json()
      allShows.push(...data.results)
      
      logProgress(`Fetched TV page ${page}/${pages} (${data.results.length} items)`)
      
      // Rate limiting
      if (page < pages) {
        await new Promise(resolve => setTimeout(resolve, 250))
      }
    } catch (error) {
      console.error(`Error fetching TV page ${page}:`, error)
    }
  }
  
  return allShows
}

// Extract percentage from search results
function extractPercentageFromText(text: string): number | null {
  if (!text) return null
  
  const patterns = [
    /(\d{1,3})%\s*liked\s*this/i,
    /(\d{1,3})%\s*of\s*(?:Google\s*)?(?:users|people|viewers)\s*liked/i,
    /liked.*?(\d{1,3})%/i,
    /audience\s*score[:\s]*(\d{1,3})%/i,
    /user\s*score[:\s]*(\d{1,3})%/i,
    /(\d{1,3})%\s*(?:audience|user)/i,
    /google\s*users[:\s]*(\d{1,3})%/i,
    /(\d{1,3})%\s*google\s*users/i,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const percentage = parseInt(match[1], 10)
      if (percentage >= 0 && percentage <= 100) {
        return percentage
      }
    }
  }
  
  return null
}

// Fetch rating from DataForSEO
async function fetchRatingFromDataForSEO(item: QueueItem): Promise<number | null> {
  const mediaTypeStr = item.mediaType === 'MOVIE' ? 'movie' : 'tv show'
  const searchQuery = item.year ? `${item.title} ${item.year} ${mediaTypeStr}` : `${item.title} ${mediaTypeStr}`
  
  logProgress(`Checking rating for "${searchQuery}"`, '🔍')
  
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
      return null
    }
    
    const items = data.tasks[0].result[0].items || []
    
    // Check knowledge graph first
    const knowledgeGraph = items.find((item: any) => item.type === 'knowledge_graph')
    if (knowledgeGraph) {
      const kgText = JSON.stringify(knowledgeGraph)
      const percentage = extractPercentageFromText(kgText)
      if (percentage !== null) {
        return percentage
      }
    }
    
    // Check organic results
    for (const resultItem of items) {
      if (resultItem.type === 'organic') {
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
            return percentage
          }
        }
      }
    }
    
    return null
  } catch (error) {
    console.error(`Error fetching rating:`, error)
    return null
  }
}

// Process a single item
async function processItem(item: QueueItem, index: number, total: number): Promise<void> {
  const itemType = item.mediaType === 'MOVIE' ? 'movie' : 'TV show'
  logProgress(`Processing ${index + 1}/${total}: "${item.title}" (${item.year || 'N/A'})`, '🎬')
  
  try {
    // Check if already exists in database
    const { data: existing } = await supabase
      .from('media_items')
      .select('id, also_liked_percentage')
      .eq('tmdb_id', item.tmdbId)
      .eq('media_type', item.mediaType)
      .single()
    
    if (existing) {
      stats.alreadyInDb++
      logProgress(`Already in database, skipping`, '✅')
      
      // Update rating if missing
      if (!existing.also_liked_percentage) {
        const rating = await fetchRatingFromDataForSEO(item)
        
        if (rating !== null) {
          await supabase
            .from('media_items')
            .update({ also_liked_percentage: rating })
            .eq('id', existing.id)
          
          stats.ratingsFound++
          logProgress(`Success: ${rating}% liked this ${itemType}`, '✅')
        } else {
          stats.ratingsFailed++
          logProgress(`No rating found`, '❌')
        }
      }
      
      return
    }
    
    // Fetch full details from TMDB
    const details = item.mediaType === 'MOVIE' 
      ? await tmdbService.getMovieDetails(item.tmdbId)
      : await tmdbService.getTVDetails(item.tmdbId)
    
    // Prepare genres
    const genres = (details.genres || []).map(g => ({
      tmdbId: g.id,
      name: g.name
    }))
    
    // Create media item
    await mediaService.createOrUpdateMedia({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      title: item.title,
      releaseDate: item.mediaType === 'MOVIE' ? details.release_date : (details as any).first_air_date,
      posterPath: details.poster_path,
      overview: details.overview,
      originalTitle: item.mediaType === 'MOVIE' ? details.original_title : (details as any).original_name,
      popularity: details.popularity,
      voteAverage: details.vote_average,
      voteCount: details.vote_count,
      runtime: item.mediaType === 'MOVIE' ? details.runtime : ((details as any).episode_run_time?.[0] || null),
      status: details.status,
      genres
    })
    
    stats.newItemsAdded++
    logProgress(`Added to database`, '➕')
    
    // Fetch rating
    const rating = await fetchRatingFromDataForSEO(item)
    
    if (rating !== null) {
      await supabase
        .from('media_items')
        .update({ also_liked_percentage: rating })
        .eq('tmdb_id', item.tmdbId)
        .eq('media_type', item.mediaType)
      
      stats.ratingsFound++
      logProgress(`Success: ${rating}% liked this ${itemType}`, '✅')
    } else {
      stats.ratingsFailed++
      logProgress(`No rating found`, '❌')
    }
    
  } catch (error) {
    stats.errors++
    console.error(`Error processing "${item.title}":`, error)
    
    // Add to failed items
    const failedItems = loadFailedItems()
    failedItems.push(item)
    saveFailedItems(failedItems)
  }
  
  // Update statistics
  if (item.mediaType === 'MOVIE') {
    stats.moviesProcessed++
  } else {
    stats.tvShowsProcessed++
  }
  
  saveProgress()
}

// Main function
async function main() {
  logProgress('Top-Rated Content Updater', '🎬')
  logProgress('===============================', '')
  
  // Check if there's an existing queue
  let queue = loadQueue()
  
  if (queue.length === 0) {
    logProgress('No existing queue found. Fetching from TMDB...', '📊')
    
    // Fetch top-rated content
    const [movies, tvShows] = await Promise.all([
      fetchTopRatedMovies(50), // 50 pages × 20 = 1000 movies
      fetchTopRatedTVShows(50)  // 50 pages × 20 = 1000 TV shows
    ])
    
    // Transform to queue items
    let movieItems = movies.map(m => ({
      tmdbId: m.id,
      title: m.title,
      year: m.release_date ? new Date(m.release_date).getFullYear() : null,
      mediaType: 'MOVIE' as MediaType
    }))
    
    let tvItems = tvShows.map(t => ({
      tmdbId: t.id,
      title: t.name,
      year: t.first_air_date ? new Date(t.first_air_date).getFullYear() : null,
      mediaType: 'TV_SHOW' as MediaType
    }))
    
    // Test mode: limit items
    if (process.env.TEST_MODE === 'true') {
      const limit = parseInt(process.env.TEST_LIMIT || '5', 10)
      movieItems = movieItems.slice(0, limit)
      tvItems = tvItems.slice(0, limit)
      logProgress(`Test mode: Limited to ${limit} movies and ${limit} TV shows`, '🧪')
    }
    
    queue = [...movieItems, ...tvItems]
    
    saveQueue(queue)
    logProgress(`Created queue with ${queue.length} items`, '✅')
  } else {
    logProgress(`Resuming from existing queue (${queue.length} items remaining)`, '🔄')
  }
  
  const totalItems = queue.length
  let currentIndex = 0
  
  // Process items one by one
  while (queue.length > 0) {
    const item = queue.shift()!
    await processItem(item, currentIndex, totalItems)
    currentIndex++
    
    // Save updated queue
    saveQueue(queue)
    
    // Rate limiting - wait 2 seconds between DataForSEO requests
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
  logProgress(`Movies processed: ${stats.moviesProcessed}`, '🎬')
  logProgress(`TV shows processed: ${stats.tvShowsProcessed}`, '📺')
  logProgress(`Already in database: ${stats.alreadyInDb}`, '📊')
  logProgress(`New items added: ${stats.newItemsAdded}`, '➕')
  logProgress(`Ratings found: ${stats.ratingsFound}`, '✅')
  logProgress(`Ratings not found: ${stats.ratingsFailed}`, '❌')
  logProgress(`Errors: ${stats.errors}`, '⚠️')
  logProgress(`Runtime: ${minutes}m ${seconds}s`, '⏱️')
  
  if (stats.errors > 0) {
    logProgress(`Failed items saved to: ${FAILED_FILE}`, '📁')
  }
  
  // Cost summary
  const totalApiCalls = stats.ratingsFound + stats.ratingsFailed
  const totalCost = (totalApiCalls * 0.003).toFixed(2)
  logProgress(`Estimated DataForSEO cost: $${totalCost}`, '💰')
}

// Run the script
main()
  .then(() => {
    logProgress('Script completed successfully', '🎉')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script error:', error)
    process.exit(1)
  })