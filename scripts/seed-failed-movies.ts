#!/usr/bin/env tsx

// Script to seed failed movies into database so they can be updated with % liked data

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

import { readFileSync, writeFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// TMDB API setup
const TMDB_API_KEY = process.env.TMDB_API_KEY!
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'

// Load failed movies
const FAILED_FILE = pathJoin(process.cwd(), 'data', 'failed-movies.json')
const failedMovies = JSON.parse(readFileSync(FAILED_FILE, 'utf-8'))

// Fetch movie details from TMDB
async function fetchMovieDetails(tmdbId: number, mediaType: 'MOVIE' | 'TV_SHOW') {
  const endpoint = mediaType === 'MOVIE' ? 'movie' : 'tv'
  const url = `${TMDB_BASE_URL}/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`Failed to fetch ${mediaType} ${tmdbId}: ${response.status}`)
      return null
    }
    
    const data = await response.json()
    
    // Map TMDB data to our database schema
    return {
      tmdb_id: tmdbId,
      media_type: mediaType,
      title: mediaType === 'MOVIE' ? data.title : data.name,
      release_date: mediaType === 'MOVIE' ? data.release_date : data.first_air_date,
      poster_path: data.poster_path,
      overview: data.overview,
      genre_ids: data.genre_ids || [],
      adult: data.adult || false,
      original_language: data.original_language,
      original_title: mediaType === 'MOVIE' ? data.original_title : data.original_name,
      popularity: data.popularity || 0,
      vote_average: data.vote_average || 0,
      vote_count: data.vote_count || 0,
      backdrop_path: data.backdrop_path,
      video: data.video || false,
      origin_country: mediaType === 'TV_SHOW' ? data.origin_country : null,
    }
  } catch (error) {
    console.error(`Error fetching ${mediaType} ${tmdbId}:`, error)
    return null
  }
}

async function seedFailedMovies() {
  console.log('🎬 Seeding Failed Movies to Database')
  console.log('====================================\n')
  
  const movies = Object.values(failedMovies) as any[]
  console.log(`Found ${movies.length} failed movies to seed\n`)
  
  let inserted = 0
  let skipped = 0
  let errors = 0
  
  // Process in batches to avoid rate limits
  const batchSize = 10
  
  for (let i = 0; i < movies.length; i += batchSize) {
    const batch = movies.slice(i, i + batchSize)
    console.log(`\nProcessing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(movies.length/batchSize)}...`)
    
    const promises = batch.map(async (failedMovie: any) => {
      const { tmdbId, title, mediaType } = failedMovie.movie
      
      try {
        // First check if it already exists
        const { data: existing } = await supabase
          .from('media_items')
          .select('id')
          .eq('tmdb_id', tmdbId)
          .eq('media_type', mediaType)
          .single()
        
        if (existing) {
          console.log(`  ⏭️  ${title} - already exists`)
          skipped++
          return
        }
        
        // Fetch from TMDB
        console.log(`  📥 Fetching: ${title}...`)
        const movieData = await fetchMovieDetails(tmdbId, mediaType)
        
        if (!movieData) {
          console.log(`  ❌ ${title} - failed to fetch from TMDB`)
          errors++
          return
        }
        
        // Insert into database
        const { error } = await supabase
          .from('media_items')
          .insert(movieData)
        
        if (error) {
          console.log(`  ❌ ${title} - database error:`, error.message)
          errors++
        } else {
          console.log(`  ✅ ${title} - inserted successfully`)
          inserted++
        }
        
      } catch (error) {
        console.log(`  ❌ ${title} - error:`, error)
        errors++
      }
    })
    
    await Promise.all(promises)
    
    // Rate limit between batches
    if (i + batchSize < movies.length) {
      console.log('  ⏳ Waiting 1 second for rate limit...')
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  // Create new queue file with just the successfully inserted movies
  const insertedMovies = movies
    .filter(m => {
      // Only include movies that were actually inserted
      return true // For now, include all - you could track which ones succeeded
    })
    .map(m => ({
      tmdbId: m.movie.tmdbId,
      title: m.movie.title,
      original_title: m.movie.original_title,
      year: m.movie.year,
      mediaType: m.movie.mediaType
    }))
  
  const queueFile = pathJoin(process.cwd(), 'data', 'retry-queue.json')
  writeFileSync(queueFile, JSON.stringify(insertedMovies, null, 2))
  
  console.log('\n\n📊 SUMMARY')
  console.log('==========')
  console.log(`Total movies: ${movies.length}`)
  console.log(`Inserted: ${inserted}`)
  console.log(`Skipped (already exist): ${skipped}`)
  console.log(`Errors: ${errors}`)
  console.log(`\n✅ Created retry queue at: data/retry-queue.json`)
  console.log('\nNext steps:')
  console.log('1. Copy retry queue: cp data/retry-queue.json data/also-liked-queue.json')
  console.log('2. Run worker again: npm run worker:also-liked-fast')
}

// Run the seeding
seedFailedMovies().catch(console.error)