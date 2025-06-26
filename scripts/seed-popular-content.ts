#!/usr/bin/env tsx

// Load environment variables from .env.local
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'

// Load .env.local file
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { config } from '../lib/config'
import { mediaService } from '../services/database'
import { tmdbService } from '../services/tmdb.service'
import type { MediaType } from '../services/database/media.service'

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
  year: number | null
  mediaType: 'MOVIE' | 'TV_SHOW'
}> = []

// Progress logging
function logProgress(message: string) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  console.log(`[${timestamp}] ${message}`)
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
  mediaType: MediaType
): Promise<void> {
  stats.totalProcessed++
  
  try {
    // Transform TMDB data
    const transformed = tmdbService.transformSearchResult({
      ...tmdbData,
      media_type: mediaType === 'MOVIE' ? 'movie' : 'tv'
    })
    
    // Check if already exists in database
    const existingItems = await mediaService.searchMedia('', {
      tmdbId: transformed.tmdbId,
      mediaType: mediaType
    }, { limit: 1 })
    
    if (existingItems.total > 0) {
      stats.existingItems++
      
      // Add to queue if no also-liked percentage
      const existing = existingItems.items[0]
      if (!existing.also_liked_percentage) {
        alsoLikedQueue.push({
          tmdbId: transformed.tmdbId,
          title: transformed.title,
          year: transformed.releaseDate ? new Date(transformed.releaseDate).getFullYear() : null,
          mediaType: mediaType
        })
      }
      return
    }
    
    // Add new item to database
    if (!isDryRun) {
      // Fetch genres for this media type
      const genreMap = mediaType === 'MOVIE' 
        ? await getMovieGenreMap() 
        : await getTvGenreMap()
      
      const genres = (transformed.genreIds || [])
        .map(id => ({
          tmdbId: id,
          name: genreMap.get(id) || 'Unknown'
        }))
        .filter(g => g.name !== 'Unknown')
      
      await mediaService.createOrUpdateMedia({
        tmdbId: transformed.tmdbId,
        mediaType: mediaType,
        title: transformed.title,
        releaseDate: transformed.releaseDate,
        posterPath: transformed.posterPath,
        backdropPath: transformed.backdropPath,
        overview: transformed.overview,
        originalTitle: transformed.originalTitle,
        popularity: transformed.popularity,
        voteAverage: transformed.voteAverage,
        voteCount: transformed.voteCount,
        genres
      })
    }
    
    stats.newItemsAdded++
    
    // Add to also-liked queue
    alsoLikedQueue.push({
      tmdbId: transformed.tmdbId,
      title: transformed.title,
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
    const genres = await tmdbService.getGenres()
    movieGenreMap = new Map(genres.movies.map(g => [g.id, g.name]))
  }
  return movieGenreMap
}

async function getTvGenreMap() {
  if (!tvGenreMap) {
    const genres = await tmdbService.getGenres()
    tvGenreMap = new Map(genres.tv.map(g => [g.id, g.name]))
  }
  return tvGenreMap
}

// Fetch popular movies
async function fetchPopularMovies(totalPages: number = 38): Promise<any[]> {
  logProgress(`Fetching popular movies (${totalPages} pages)...`)
  const allMovies: any[] = []
  
  for (let page = 1; page <= totalPages; page++) {
    try {
      const response = await tmdbService.discoverMovies({
        sort_by: 'popularity.desc',
        page: page.toString(),
        'vote_count.gte': '100' // Only movies with at least 100 votes
      })
      
      allMovies.push(...response.results)
      logProgress(`Fetched movie page ${page}/${totalPages} (${response.results.length} items)`)
      
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
      const response = await tmdbService.discoverTvShows({
        sort_by: 'popularity.desc',
        page: page.toString(),
        'vote_count.gte': '100' // Only shows with at least 100 votes
      })
      
      allShows.push(...response.results)
      logProgress(`Fetched TV page ${page}/${totalPages} (${response.results.length} items)`)
      
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
      const estimatedCost = (alsoLikedQueue.length * 0.003).toFixed(2)
      console.log(`\n💰 Estimated DataForSEO cost: $${estimatedCost}`)
      console.log('   Run sentiment analysis with: npm run sentiment:process')
    }
    
  } catch (error) {
    console.error('\n❌ Error during seeding:', error)
    process.exit(1)
  }
}

// Run the script
main().catch(console.error)