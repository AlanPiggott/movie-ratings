#!/usr/bin/env tsx

// Load environment variables from .env.local FIRST
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

// Now we can import other modules
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// Initialize Supabase client directly
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Parse command line arguments
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')

// Statistics tracking
const stats = {
  totalProcessed: 0,
  newItemsAdded: 0,
  existingItems: 0,
  errors: 0,
  startTime: Date.now()
}

// Queue for also-liked processing
const alsoLikedQueue: Array<{
  tmdbId: number
  title: string
  original_title?: string
  year: number | null
  mediaType: 'MOVIE' | 'TV_SHOW'
}> = []

// Progress logging
function logProgress(message: string) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  console.log(`[${timestamp}] ${message}`)
}

// TMDB API configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

if (!TMDB_API_KEY) {
  console.error('❌ Missing TMDB_API_KEY environment variable')
  process.exit(1)
}

// Transform TMDB result
function transformSearchResult(result: any) {
  const isMovie = result.media_type === 'movie' || result.release_date !== undefined
  
  return {
    tmdbId: result.id,
    mediaType: isMovie ? 'MOVIE' : 'TV_SHOW',
    title: result.title || result.name,
    originalTitle: result.original_title || result.original_name,
    releaseDate: result.release_date || result.first_air_date,
    posterPath: result.poster_path,
    backdropPath: result.backdrop_path,
    overview: result.overview,
    popularity: result.popularity,
    voteAverage: result.vote_average,
    voteCount: result.vote_count,
    genreIds: result.genre_ids || []
  }
}

// Batch processing with rate limiting
async function processBatch<T>(
  items: T[],
  batchSize: number,
  delayMs: number,
  processor: (item: T) => Promise<void>,
  progressPrefix: string
) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    
    // Process batch in parallel
    await Promise.all(batch.map(processor))
    
    // Log progress
    const processed = Math.min(i + batchSize, items.length)
    logProgress(`${progressPrefix}: ${processed}/${items.length}...`)
    
    // Rate limit delay (except for last batch)
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
}

// Process a single media item
async function processMediaItem(
  tmdbData: any,
  mediaType: 'MOVIE' | 'TV_SHOW'
): Promise<void> {
  stats.totalProcessed++
  
  try {
    // Transform TMDB data
    const transformed = transformSearchResult({
      ...tmdbData,
      media_type: mediaType === 'MOVIE' ? 'movie' : 'tv'
    })
    
    // Check if already exists in database
    const { data: existingItems } = await supabase
      .from('media_items')
      .select('id, also_liked_percentage')
      .eq('tmdb_id', transformed.tmdbId)
      .eq('media_type', mediaType)
      .limit(1)
    
    if (existingItems && existingItems.length > 0) {
      stats.existingItems++
      
      // Add to queue if no also-liked percentage
      const existing = existingItems[0]
      if (!existing.also_liked_percentage) {
        alsoLikedQueue.push({
          tmdbId: transformed.tmdbId,
          title: transformed.title,
          original_title: transformed.originalTitle !== transformed.title ? transformed.originalTitle : undefined,
          year: transformed.releaseDate ? new Date(transformed.releaseDate).getFullYear() : null,
          mediaType: mediaType
        })
      }
      return
    }
    
    // Add new item to database
    if (!isDryRun) {
      // Get genres
      const genreMap = mediaType === 'MOVIE' 
        ? await getMovieGenreMap() 
        : await getTvGenreMap()
      
      // Insert media item
      const { data: mediaItem, error: mediaError } = await supabase
        .from('media_items')
        .insert({
          tmdb_id: transformed.tmdbId,
          media_type: mediaType,
          title: transformed.title,
          original_title: transformed.originalTitle,
          release_date: transformed.releaseDate,
          poster_path: transformed.posterPath,
          backdrop_path: transformed.backdropPath,
          overview: transformed.overview,
          popularity: transformed.popularity,
          vote_average: transformed.voteAverage,
          vote_count: transformed.voteCount
        })
        .select()
        .single()
      
      if (mediaError) {
        throw mediaError
      }
      
      // Insert genres
      if (mediaItem && transformed.genreIds.length > 0) {
        const genreInserts = transformed.genreIds
          .map(genreId => {
            const genreName = genreMap.get(genreId)
            if (!genreName) return null
            
            return {
              media_item_id: mediaItem.id,
              genre_id: genreId,
              genre_name: genreName
            }
          })
          .filter(Boolean)
        
        if (genreInserts.length > 0) {
          await supabase.from('media_item_genres').insert(genreInserts)
        }
      }
    }
    
    stats.newItemsAdded++
    
    // Add to also-liked queue
    alsoLikedQueue.push({
      tmdbId: transformed.tmdbId,
      title: transformed.title,
      original_title: transformed.originalTitle !== transformed.title ? transformed.originalTitle : undefined,
      year: transformed.releaseDate ? new Date(transformed.releaseDate).getFullYear() : null,
      mediaType: mediaType
    })
    
  } catch (error) {
    stats.errors++
    console.error(`Error processing ${mediaType} ${tmdbData.id}:`, error)
  }
}

// Genre caching
let movieGenreMap: Map<number, string> | null = null
let tvGenreMap: Map<number, string> | null = null

async function getMovieGenreMap() {
  if (!movieGenreMap) {
    const response = await fetch(`${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}`)
    const data = await response.json()
    movieGenreMap = new Map(data.genres.map((g: any) => [g.id, g.name]))
  }
  return movieGenreMap
}

async function getTvGenreMap() {
  if (!tvGenreMap) {
    const response = await fetch(`${TMDB_BASE_URL}/genre/tv/list?api_key=${TMDB_API_KEY}`)
    const data = await response.json()
    tvGenreMap = new Map(data.genres.map((g: any) => [g.id, g.name]))
  }
  return tvGenreMap
}

// Fetch popular movies
async function fetchPopularMovies(totalPages: number = 38): Promise<any[]> {
  logProgress(`Fetching popular movies (${totalPages} pages)...`)
  const allMovies: any[] = []
  
  for (let page = 1; page <= totalPages; page++) {
    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&page=${page}&vote_count.gte=100`
      )
      const data = await response.json()
      
      allMovies.push(...data.results)
      logProgress(`Fetched movie page ${page}/${totalPages} (${data.results.length} items)`)
      
      // Small delay between API calls
      if (page < totalPages) {
        await new Promise(resolve => setTimeout(resolve, 250))
      }
    } catch (error) {
      console.error(`Error fetching movie page ${page}:`, error)
    }
  }
  
  return allMovies
}

// Fetch popular TV shows
async function fetchPopularTvShows(totalPages: number = 13): Promise<any[]> {
  logProgress(`Fetching popular TV shows (${totalPages} pages)...`)
  const allShows: any[] = []
  
  for (let page = 1; page <= totalPages; page++) {
    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&page=${page}&vote_count.gte=100`
      )
      const data = await response.json()
      
      allShows.push(...data.results)
      logProgress(`Fetched TV page ${page}/${totalPages} (${data.results.length} items)`)
      
      // Small delay between API calls
      if (page < totalPages) {
        await new Promise(resolve => setTimeout(resolve, 250))
      }
    } catch (error) {
      console.error(`Error fetching TV page ${page}:`, error)
    }
  }
  
  return allShows
}

// Save queue to file
function saveQueueToFile() {
  const dataDir = join(process.cwd(), 'data')
  const filePath = join(dataDir, 'also-liked-queue.json')
  
  // Ensure data directory exists
  mkdirSync(dataDir, { recursive: true })
  
  // Sort queue by popularity (approximated by year descending, newer content first)
  const sortedQueue = [...alsoLikedQueue].sort((a, b) => {
    const yearA = a.year || 0
    const yearB = b.year || 0
    return yearB - yearA
  })
  
  // Save to file
  writeFileSync(filePath, JSON.stringify(sortedQueue, null, 2))
  
  return filePath
}

// Main execution
async function main() {
  console.log('🎬 Movie Score Database Seeder')
  console.log('=============================')
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}\n`)
  
  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE: No data will be saved to the database\n')
  }
  
  try {
    // Fetch all content from TMDB
    const [movies, tvShows] = await Promise.all([
      fetchPopularMovies(38), // ~750 movies
      fetchPopularTvShows(13)  // ~250 TV shows
    ])
    
    console.log(`\n📊 Fetched ${movies.length} movies and ${tvShows.length} TV shows\n`)
    
    // Process movies in batches
    console.log('🎬 Processing movies...')
    await processBatch(
      movies,
      10, // batch size
      3000, // 3 second delay between batches
      (movie) => processMediaItem(movie, 'MOVIE'),
      'Processing movies'
    )
    
    console.log('\n📺 Processing TV shows...')
    await processBatch(
      tvShows,
      10, // batch size
      3000, // 3 second delay between batches
      (show) => processMediaItem(show, 'TV_SHOW'),
      'Processing TV shows'
    )
    
    // Save queue file
    const queuePath = isDryRun ? '[DRY RUN - NOT SAVED]' : saveQueueToFile()
    
    // Calculate runtime
    const runtime = Math.round((Date.now() - stats.startTime) / 1000)
    const minutes = Math.floor(runtime / 60)
    const seconds = runtime % 60
    
    // Display summary
    console.log('\n✅ Seeding Complete!')
    console.log('===================')
    console.log(`Total items processed: ${stats.totalProcessed}`)
    console.log(`New items added: ${stats.newItemsAdded}`)
    console.log(`Items already in database: ${stats.existingItems}`)
    console.log(`Errors encountered: ${stats.errors}`)
    console.log(`Queue items for sentiment analysis: ${alsoLikedQueue.length}`)
    console.log(`Queue file: ${queuePath}`)
    console.log(`Runtime: ${minutes}m ${seconds}s`)
    
    if (alsoLikedQueue.length > 0 && !isDryRun) {
      const estimatedCost = (alsoLikedQueue.length * 4 * 0.0006).toFixed(2) // Up to 4 attempts per item
      console.log(`\n💰 Estimated DataForSEO cost: ~$${estimatedCost}`)
      console.log('   Run sentiment analysis with: npm run worker:also-liked')
    }
    
  } catch (error) {
    console.error('\n❌ Error during seeding:', error)
    process.exit(1)
  }
}

// Run the script
main().catch(console.error)