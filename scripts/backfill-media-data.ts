#!/usr/bin/env tsx

// Load environment variables
import dotenv from 'dotenv'
import path from 'path'

// Load .env.local file
dotenv.config({ path: path.join(__dirname, '../.env.local') })

import { supabaseAdmin } from '../lib/supabase'
import { tmdbService } from '../services/tmdb.service'
import { mediaService } from '../services/database/media.service'
import { processWatchProviders } from '../lib/utils/watch-providers'

interface BackfillStats {
  total: number
  processed: number
  updated: number
  failed: number
  errors: string[]
}

async function backfillMediaData() {
  console.log('🔄 Starting media data backfill...')
  
  const stats: BackfillStats = {
    total: 0,
    processed: 0,
    updated: 0,
    failed: 0,
    errors: []
  }

  try {
    // Get all media items without genres or that haven't been updated recently
    const { data: mediaItems, error } = await supabaseAdmin
      .from('media_items')
      .select('id, tmdb_id, media_type, title, release_date')
      .order('popularity', { ascending: false })
    
    if (error) {
      console.error('Failed to fetch media items:', error)
      return
    }

    stats.total = mediaItems?.length || 0
    console.log(`📊 Found ${stats.total} media items to process`)

    // Process in batches to avoid rate limits
    const batchSize = 10
    const delayBetweenBatches = 2000 // 2 seconds

    for (let i = 0; i < mediaItems.length; i += batchSize) {
      const batch = mediaItems.slice(i, i + batchSize)
      
      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(mediaItems.length / batchSize)}`)
      
      await Promise.all(
        batch.map(async (item) => {
          try {
            stats.processed++
            
            console.log(`  ⏳ Processing: ${item.title} (${item.media_type})`)
            
            // Fetch complete details from TMDB
            const tmdbDetails = item.media_type === 'MOVIE' 
              ? await tmdbService.getMovieDetails(item.tmdb_id)
              : await tmdbService.getTVDetails(item.tmdb_id)
            
            // Extract genres
            const genres = tmdbDetails.genres?.map((g: any) => ({
              tmdbId: g.id,
              name: g.name
            })) || []
            
            // Process watch providers for direct links
            let watchProviders = null
            if (tmdbDetails['watch/providers']?.results?.US) {
              const mediaInfo = {
                title: item.title,
                year: item.release_date ? new Date(item.release_date).getFullYear() : undefined,
                mediaType: item.media_type === 'MOVIE' ? 'movie' as const : 'tv' as const,
                tmdbId: item.tmdb_id
              }
              watchProviders = processWatchProviders(
                tmdbDetails['watch/providers'].results.US,
                mediaInfo
              )
            }
            
            // Extract recommendations
            const recommendations = tmdbDetails.recommendations?.results?.slice(0, 10).map((r: any) => ({
              tmdbId: r.id,
              mediaType: r.media_type === 'movie' ? 'MOVIE' : 'TV_SHOW',
              title: r.title || r.name,
              posterPath: r.poster_path,
              voteAverage: r.vote_average
            })) || []
            
            // Update media item with genres
            await mediaService.createOrUpdateMedia({
              tmdbId: item.tmdb_id,
              mediaType: item.media_type,
              title: tmdbDetails.title || tmdbDetails.name || item.title,
              releaseDate: tmdbDetails.release_date || tmdbDetails.first_air_date,
              posterPath: tmdbDetails.poster_path,
              overview: tmdbDetails.overview,
              originalTitle: tmdbDetails.original_title || tmdbDetails.original_name,
              backdropPath: tmdbDetails.backdrop_path,
              popularity: tmdbDetails.popularity,
              voteAverage: tmdbDetails.vote_average,
              voteCount: tmdbDetails.vote_count,
              runtime: tmdbDetails.runtime,
              status: tmdbDetails.status,
              genres
            })
            
            // Store additional data (watch providers, recommendations) separately
            // You might want to create new tables for these or store as JSON
            const { error: updateError } = await supabaseAdmin
              .from('media_items')
              .update({
                watch_providers: watchProviders,
                recommendations,
                content_rating: tmdbDetails.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'US')?.release_dates?.[0]?.certification || 
                               tmdbDetails.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'US')?.rating,
                updated_at: new Date().toISOString()
              })
              .eq('id', item.id)
            
            if (updateError) {
              throw updateError
            }
            
            stats.updated++
            console.log(`  ✅ Updated: ${item.title} with ${genres.length} genres`)
            
          } catch (error) {
            stats.failed++
            const errorMsg = `Failed to process ${item.title}: ${error instanceof Error ? error.message : 'Unknown error'}`
            stats.errors.push(errorMsg)
            console.error(`  ❌ ${errorMsg}`)
          }
        })
      )
      
      // Wait between batches to respect rate limits
      if (i + batchSize < mediaItems.length) {
        console.log(`  ⏸️  Waiting ${delayBetweenBatches / 1000}s before next batch...`)
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
      }
    }
    
    // Print summary
    console.log('\n📊 Backfill Summary:')
    console.log(`  Total items: ${stats.total}`)
    console.log(`  Processed: ${stats.processed}`)
    console.log(`  Updated: ${stats.updated}`)
    console.log(`  Failed: ${stats.failed}`)
    
    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:')
      stats.errors.slice(0, 10).forEach(error => console.log(`  - ${error}`))
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more errors`)
      }
    }
    
  } catch (error) {
    console.error('Backfill failed:', error)
  }
}

// Run the backfill
backfillMediaData()
  .then(() => {
    console.log('\n✨ Backfill complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Backfill failed:', error)
    process.exit(1)
  })