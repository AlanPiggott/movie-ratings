#!/usr/bin/env npx tsx

// Fetch new releases and trending content from TMDB and get their Google ratings
// Supports multiple modes: new-releases, trending, backfill, all

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'

// Load environment variables
const envResult = dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })
if (envResult.error) {
  console.error('❌ Error loading .env.local:', envResult.error)
  process.exit(1)
}

import { createClient } from '@supabase/supabase-js'
import { tmdbService } from '@/services/tmdb.service'
import { config } from '@/lib/config'

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Configuration
const CONFIG = {
  DAILY_LIMIT: 200,
  POPULARITY_THRESHOLD: {
    NEW_RELEASES: 5,
    TRENDING: 20,
    BACKFILL: 30
  },
  RATE_LIMIT_DELAY: 100, // ms between TMDB requests
  DRY_RUN: process.argv.includes('--dry-run'),
  MODE: process.argv.find(arg => ['new-releases', 'trending', 'backfill', 'all'].includes(arg)) || 'all'
}

// Stats tracking
const stats = {
  fetched: 0,
  alreadyInDb: 0,
  saved: 0,
  ratingsFetched: 0,
  ratingsFound: 0,
  ratingsFailed: 0,
  errors: 0,
  apiCalls: 0,
  cost: 0,
  startTime: Date.now()
}

// Track processed items to avoid duplicates within same run
const processedItems = new Set<string>()

// Genre cache
let genreCache: { movies: Map<number, string>, tv: Map<number, string> } | null = null

// Rate limiting for DataForSEO
const requestTimestamps: number[] = []
const RATE_LIMIT_PER_SEC = 18

async function checkRateLimit() {
  const now = Date.now()
  const oneSecondAgo = now - 1000
  
  // Remove old timestamps
  while (requestTimestamps.length > 0 && requestTimestamps[0] < oneSecondAgo) {
    requestTimestamps.shift()
  }
  
  // If we're at the limit, wait
  if (requestTimestamps.length >= RATE_LIMIT_PER_SEC) {
    const oldestTimestamp = requestTimestamps[0]
    const waitTime = Math.max(0, 1000 - (now - oldestTimestamp))
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
  
  requestTimestamps.push(Date.now())
}

// Clean title for special characters
function cleanTitle(title: string): string {
  return title
    .replace(/['']/g, '')
    .replace(/[éèêë]/g, 'e')
    .replace(/[áàäâ]/g, 'a')
    .replace(/[ñ]/g, 'n')
    .replace(/[öô]/g, 'o')
    .replace(/[üùû]/g, 'u')
    .replace(/[ç]/g, 'c')
}

// Fetch from TMDB API using the raw API endpoints we need
async function fetchFromTMDB(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${config.tmdb.baseUrl}${endpoint}`)
  url.searchParams.append('api_key', config.tmdb.apiKey)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value)
  })

  await new Promise(resolve => setTimeout(resolve, CONFIG.RATE_LIMIT_DELAY))

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${config.tmdb.readAccessToken}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(3000)
  })
  
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// Load genre mappings
async function loadGenres() {
  if (genreCache) return genreCache

  const genres = await tmdbService.getGenres()
  
  genreCache = {
    movies: new Map(genres.movies.map(g => [g.id, g.name])),
    tv: new Map(genres.tv.map(g => [g.id, g.name]))
  }

  return genreCache
}

// Search for rating using DataForSEO
async function searchGoogleForPercentage(item: any): Promise<number | null> {
  if (CONFIG.DRY_RUN) {
    stats.apiCalls += 2
    return Math.floor(Math.random() * 30) + 70 // Random 70-100%
  }
  
  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64')
  
  // Build queries
  const queries: string[] = []
  const cleanedTitle = cleanTitle(item.title)
  const year = item.release_date ? new Date(item.release_date).getFullYear() : null
  
  if (item.media_type === 'TV_SHOW') {
    if (year) {
      queries.push(`${item.title} ${year} tv show`)
      queries.push(`${item.title} (${year}) tv show`)
      if (cleanedTitle !== item.title) {
        queries.push(`${cleanedTitle} ${year} tv show`)
      }
    }
    queries.push(`${item.title} tv show`)
  } else {
    if (year) {
      queries.push(`${item.title} ${year} movie`)
      queries.push(`${item.title} (${year}) movie`)
      if (cleanedTitle !== item.title) {
        queries.push(`${cleanedTitle} ${year} movie`)
      }
    }
    queries.push(`${item.title} movie`)
  }
  
  // Try queries until we find a result
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
        await new Promise(resolve => setTimeout(resolve, 5000))
        continue
      }
      
      const createData = await createResponse.json()
      if (createData.status_code !== 20000 || !createData.tasks?.[0]?.id) {
        continue
      }
      
      const taskId = createData.tasks[0].id
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 5000))
      
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
        await new Promise(resolve => setTimeout(resolve, 5000))
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
        /(\d{1,3})%\s*liked/gi
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
      
    } catch (error) {
      // Continue to next query
    }
  }
  
  return null
}

// Transform TMDB item to our database format
function transformTMDBItem(item: any, mediaType: 'MOVIE' | 'TV_SHOW'): any {
  const genres = genreCache!
  const genreMap = mediaType === 'MOVIE' ? genres.movies : genres.tv
  
  return {
    tmdbId: item.id,
    mediaType,
    title: mediaType === 'MOVIE' ? item.title : item.name,
    releaseDate: mediaType === 'MOVIE' ? item.release_date : item.first_air_date,
    posterPath: item.poster_path,
    overview: item.overview,
    originalTitle: mediaType === 'MOVIE' ? item.original_title : item.original_name,
    popularity: item.popularity,
    voteAverage: item.vote_average,
    voteCount: item.vote_count,
    genres: (item.genre_ids || [])
      .map((id: number) => ({
        tmdbId: id,
        name: genreMap.get(id) || 'Unknown'
      }))
      .filter((g: any) => g.name !== 'Unknown')
  }
}

// Process a single item
async function processItem(tmdbItem: any, mediaType: 'MOVIE' | 'TV_SHOW', source: string) {
  try {
    const transformed = transformTMDBItem(tmdbItem, mediaType)
    
    // Skip items without poster or below popularity threshold
    if (!transformed.posterPath) {
      console.log(`  ⏭️  Skipping ${transformed.title} - no poster`)
      return
    }
    
    // Skip if already processed in this run
    const itemKey = `${mediaType}-${transformed.tmdbId}`
    if (processedItems.has(itemKey)) {
      console.log(`  ⏭️  Skipping ${transformed.title} - already processed in this run`)
      return
    }
    processedItems.add(itemKey)
    
    // Check if already in database
    const { data: existing } = await supabase
      .from('media_items')
      .select('id, title, also_liked_percentage, rating_last_updated, created_at')
      .eq('tmdb_id', transformed.tmdbId)
      .eq('media_type', mediaType)
      .single()
    
    if (existing) {
      stats.alreadyInDb++
      
      // Check if rating is recent (less than 7 days old)
      if (existing.also_liked_percentage !== null && existing.rating_last_updated) {
        const daysSinceUpdate = (Date.now() - new Date(existing.rating_last_updated).getTime()) / (1000 * 60 * 60 * 24)
        if (daysSinceUpdate < 7) {
          console.log(`  ✓ ${transformed.title} - already has recent rating (${existing.also_liked_percentage}%)`)
          return
        }
      }
      
      // Skip if item was created very recently (within 24 hours) to avoid duplicate processing
      if (existing.created_at) {
        const hoursSinceCreation = (Date.now() - new Date(existing.created_at).getTime()) / (1000 * 60 * 60)
        if (hoursSinceCreation < 24 && existing.also_liked_percentage === null) {
          console.log(`  ⏭️  ${transformed.title} - recently added, skipping to avoid duplication`)
          return
        }
      }
      
      // Fetch rating if missing or old
      if (existing.also_liked_percentage === null || !existing.rating_last_updated) {
        console.log(`  🔄 ${transformed.title} - fetching missing rating...`)
        stats.ratingsFetched++
        
        const rating = await searchGoogleForPercentage({ ...existing, media_type: mediaType })
        if (rating !== null) {
          stats.ratingsFound++
          
          if (!CONFIG.DRY_RUN) {
            await supabase.rpc('record_rating_update', {
              p_media_id: existing.id,
              p_new_rating: rating,
              p_previous_rating: existing.also_liked_percentage
            })
          }
          
          console.log(`    → Found: ${rating}%`)
        } else {
          stats.ratingsFailed++
          console.log(`    → No rating found`)
        }
      }
      
      return
    }
    
    // Save new item
    if (!CONFIG.DRY_RUN) {
      const { data: savedItem, error } = await supabase
        .from('media_items')
        .insert({
          tmdb_id: transformed.tmdbId,
          media_type: mediaType,
          title: transformed.title,
          release_date: transformed.releaseDate,
          poster_path: transformed.posterPath,
          overview: transformed.overview,
          original_title: transformed.originalTitle,
          popularity: transformed.popularity,
          vote_average: transformed.voteAverage,
          vote_count: transformed.voteCount,
          content_source: source,
          rating_update_tier: 1 // New releases start at tier 1
        })
        .select()
        .single()
      
      if (error) {
        console.error(`  ❌ Error saving ${transformed.title}:`, error)
        stats.errors++
        return
      }
      
      // Save genres
      if (transformed.genres.length > 0) {
        await supabase
          .from('media_genres')
          .insert(
            transformed.genres.map((g: any) => ({
              media_id: savedItem.id,
              tmdb_genre_id: g.tmdbId,
              name: g.name
            }))
          )
      }
      
      stats.saved++
      console.log(`  💾 Saved ${transformed.title}`)
      
      // Immediately fetch rating
      stats.ratingsFetched++
      const rating = await searchGoogleForPercentage({ ...savedItem, media_type: mediaType })
      
      if (rating !== null) {
        stats.ratingsFound++
        
        await supabase.rpc('record_rating_update', {
          p_media_id: savedItem.id,
          p_new_rating: rating,
          p_previous_rating: null
        })
        
        console.log(`    → Rating: ${rating}%`)
      } else {
        stats.ratingsFailed++
        console.log(`    → No rating found`)
      }
    } else {
      stats.saved++
      console.log(`  [DRY RUN] Would save ${transformed.title}`)
    }
    
  } catch (error) {
    console.error(`  ❌ Error processing item:`, error)
    stats.errors++
  }
}

// Fetch new releases
async function fetchNewReleases() {
  console.log('\n🎬 Fetching New Releases\n')
  
  // Get current date and date ranges
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  // Fetch now playing movies
  console.log('📽️  Now Playing Movies:')
  const nowPlaying = await fetchFromTMDB('/movie/now_playing', { page: '1' })
  stats.fetched += nowPlaying.results.length
  
  for (const movie of nowPlaying.results) {
    if (movie.popularity >= CONFIG.POPULARITY_THRESHOLD.NEW_RELEASES) {
      await processItem(movie, 'MOVIE', 'now_playing')
    }
  }
  
  // Removed upcoming movies - they don't have ratings yet!
  
  // Fetch on the air TV shows
  console.log('\n📺 On The Air TV Shows:')
  const onTheAir = await fetchFromTMDB('/tv/on_the_air', { page: '1' })
  stats.fetched += onTheAir.results.length
  
  for (const show of onTheAir.results) {
    if (show.popularity >= CONFIG.POPULARITY_THRESHOLD.NEW_RELEASES) {
      await processItem(show, 'TV_SHOW', 'on_the_air')
    }
  }
  
  // Fetch TV shows airing today
  console.log('\n📺 Airing Today:')
  const airingToday = await fetchFromTMDB('/tv/airing_today', { page: '1' })
  stats.fetched += airingToday.results.length
  
  for (const show of airingToday.results) {
    if (show.popularity >= CONFIG.POPULARITY_THRESHOLD.NEW_RELEASES) {
      await processItem(show, 'TV_SHOW', 'airing_today')
    }
  }
}

// Fetch trending content
async function fetchTrending() {
  console.log('\n🔥 Fetching Trending Content\n')
  
  // Fetch trending all (movies and TV)
  console.log('📈 Trending This Week:')
  const trending = await fetchFromTMDB('/trending/all/week', { page: '1' })
  stats.fetched += trending.results.length
  
  for (const item of trending.results) {
    if (item.media_type === 'person') continue // Skip person results
    
    if (item.popularity >= CONFIG.POPULARITY_THRESHOLD.TRENDING) {
      const mediaType = item.media_type === 'movie' ? 'MOVIE' : 'TV_SHOW'
      await processItem(item, mediaType, 'trending')
    }
  }
  
  // Also fetch page 2 for more coverage
  const trendingPage2 = await fetchFromTMDB('/trending/all/week', { page: '2' })
  stats.fetched += trendingPage2.results.length
  
  for (const item of trendingPage2.results) {
    if (item.media_type === 'person') continue
    
    if (item.popularity >= CONFIG.POPULARITY_THRESHOLD.TRENDING) {
      const mediaType = item.media_type === 'movie' ? 'MOVIE' : 'TV_SHOW'
      await processItem(item, mediaType, 'trending')
    }
  }
}

// Fetch popular content without ratings
async function fetchBackfill() {
  console.log('\n🔄 Backfilling Popular Content\n')
  
  // Get items without ratings, ordered by popularity
  const { data: itemsWithoutRatings, error } = await supabase
    .from('media_items')
    .select('id, tmdb_id, title, media_type, release_date')
    .is('also_liked_percentage', null)
    .order('popularity', { ascending: false })
    .order('search_count', { ascending: false })
    .limit(200)
  
  if (error) {
    console.error('Error fetching items without ratings:', error)
    return
  }
  
  console.log(`Found ${itemsWithoutRatings.length} popular items without ratings`)
  
  for (const item of itemsWithoutRatings) {
    console.log(`  🔍 ${item.title}`)
    stats.ratingsFetched++
    
    const rating = await searchGoogleForPercentage(item)
    
    if (rating !== null) {
      stats.ratingsFound++
      
      if (!CONFIG.DRY_RUN) {
        await supabase.rpc('record_rating_update', {
          p_media_id: item.id,
          p_new_rating: rating,
          p_previous_rating: null
        })
      }
      
      console.log(`    → Found: ${rating}%`)
    } else {
      stats.ratingsFailed++
      console.log(`    → No rating found`)
    }
    
    // Check daily limit
    if (stats.ratingsFetched >= CONFIG.DAILY_LIMIT) {
      console.log('\n⚠️  Daily limit reached')
      break
    }
  }
}

// Main function
async function main() {
  console.log('🎬 New & Trending Content Fetcher')
  console.log('==================================\n')
  console.log(`Mode: ${CONFIG.MODE}`)
  console.log(`Dry Run: ${CONFIG.DRY_RUN}\n`)
  
  try {
    // Load genres first
    await loadGenres()
    
    // Execute based on mode
    if (CONFIG.MODE === 'new-releases' || CONFIG.MODE === 'all') {
      await fetchNewReleases()
    }
    
    if (CONFIG.MODE === 'trending' || CONFIG.MODE === 'all') {
      await fetchTrending()
    }
    
    if (CONFIG.MODE === 'backfill' || CONFIG.MODE === 'all') {
      await fetchBackfill()
    }
    
    // Calculate final stats
    stats.cost = stats.apiCalls * 0.0006
    const runtime = Math.round((Date.now() - stats.startTime) / 1000)
    
    // Display summary
    console.log('\n' + '='.repeat(50))
    console.log('✅ Fetch Complete!')
    console.log('='.repeat(50))
    console.log(`Items fetched from TMDB: ${stats.fetched}`)
    console.log(`Already in database: ${stats.alreadyInDb}`)
    console.log(`New items saved: ${stats.saved}`)
    console.log(`Ratings fetched: ${stats.ratingsFetched}`)
    console.log(`Ratings found: ${stats.ratingsFound}`)
    console.log(`Ratings failed: ${stats.ratingsFailed}`)
    console.log(`Errors: ${stats.errors}`)
    console.log(`API calls: ${stats.apiCalls}`)
    console.log(`Cost: $${stats.cost.toFixed(4)}`)
    console.log(`Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`)
    
    // Log to database
    if (!CONFIG.DRY_RUN) {
      await supabase
        .from('rating_update_logs')
        .insert({
          run_date: new Date().toISOString().split('T')[0],
          items_updated: stats.ratingsFound,
          items_failed: stats.ratingsFailed,
          api_calls_made: stats.apiCalls,
          total_cost: stats.cost,
          runtime_seconds: runtime,
          update_source: `fetch-${CONFIG.MODE}`,
          new_items_added: stats.saved
        })
    }
    
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

// Run the script
main().catch(console.error)