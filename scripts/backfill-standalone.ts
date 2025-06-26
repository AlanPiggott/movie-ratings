#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Load .env.local file
const envPath = path.join(__dirname, '../.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('='))
    .filter(([key]) => key)
    .map(([key, value]) => [key.trim(), value?.trim()?.replace(/^["']|["']$/g, '') || ''])
)

// Initialize clients directly
const supabaseAdmin = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL!,
  envVars.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

const TMDB_API_KEY = envVars.TMDB_API_KEY!

interface BackfillStats {
  total: number
  processed: number
  updated: number
  failed: number
  errors: string[]
}

// Simple watch provider link generator
function generateWatchProviderLink(provider: any, title: string, year?: number, mediaType: string = 'movie') {
  const searchQuery = `${title} ${year || ''}`.trim()
  const encodedQuery = encodeURIComponent(searchQuery)
  
  const providerUrls: Record<number, string> = {
    8: `https://www.netflix.com/search?q=${encodedQuery}`,
    9: `https://www.amazon.com/s?k=${encodedQuery}`,
    337: `https://www.disneyplus.com/search/${encodedQuery}`,
    384: `https://www.max.com/search?q=${encodedQuery}`,
    15: `https://www.hulu.com/search?q=${encodedQuery}`,
    386: `https://www.peacocktv.com/search?q=${encodedQuery}`,
    531: `https://www.paramountplus.com/search?q=${encodedQuery}`,
    2: `https://tv.apple.com/search?term=${encodedQuery}&type=${mediaType}`,
    3: `https://play.google.com/store/search?q=${encodedQuery}&c=${mediaType === 'movie' ? 'movies' : 'tv'}`,
    192: `https://www.youtube.com/results?search_query=${encodedQuery}`,
    10: `https://www.amazon.com/s?k=${encodedQuery}`,
    7: `https://www.vudu.com/search?searchString=${encodedQuery}`
  }
  
  return {
    ...provider,
    link: providerUrls[provider.provider_id] || null
  }
}

async function fetchTMDBDetails(tmdbId: number, mediaType: string) {
  const endpoint = mediaType === 'MOVIE' ? 'movie' : 'tv'
  const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,recommendations,watch/providers`
  
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.statusText}`)
  }
  
  return response.json()
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
    // Get all media items
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

    // Process in batches
    const batchSize = 5
    const delayBetweenBatches = 2000

    for (let i = 0; i < mediaItems.length; i += batchSize) {
      const batch = mediaItems.slice(i, i + batchSize)
      
      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(mediaItems.length / batchSize)}`)
      
      await Promise.all(
        batch.map(async (item) => {
          try {
            stats.processed++
            
            console.log(`  ⏳ Processing: ${item.title} (${item.media_type})`)
            
            // Fetch complete details from TMDB
            const tmdbDetails = await fetchTMDBDetails(item.tmdb_id, item.media_type)
            
            // Extract genres
            const genres = tmdbDetails.genres?.map((g: any) => ({
              tmdb_id: g.id,
              name: g.name
            })) || []
            
            // Ensure genres exist in database
            for (const genre of genres) {
              await supabaseAdmin
                .from('genres')
                .upsert({
                  tmdb_id: genre.tmdb_id,
                  name: genre.name
                }, {
                  onConflict: 'tmdb_id'
                })
            }
            
            // Get genre IDs
            const { data: genreRecords } = await supabaseAdmin
              .from('genres')
              .select('id, tmdb_id')
              .in('tmdb_id', genres.map(g => g.tmdb_id))
            
            if (genreRecords && genreRecords.length > 0) {
              // Delete existing genre associations
              await supabaseAdmin
                .from('media_genres')
                .delete()
                .eq('media_item_id', item.id)
              
              // Create new associations
              const genreAssociations = genreRecords.map(genre => ({
                media_item_id: item.id,
                genre_id: genre.id
              }))
              
              await supabaseAdmin
                .from('media_genres')
                .insert(genreAssociations)
            }
            
            // Process watch providers
            let watchProviders = null
            if (tmdbDetails['watch/providers']?.results?.US) {
              const providers = tmdbDetails['watch/providers'].results.US
              watchProviders = {}
              
              if (providers.flatrate) {
                watchProviders.flatrate = providers.flatrate.map((p: any) => 
                  generateWatchProviderLink(p, item.title, 
                    item.release_date ? new Date(item.release_date).getFullYear() : undefined,
                    item.media_type === 'MOVIE' ? 'movie' : 'tv'
                  )
                )
              }
              
              if (providers.rent) {
                watchProviders.rent = providers.rent.map((p: any) => 
                  generateWatchProviderLink(p, item.title,
                    item.release_date ? new Date(item.release_date).getFullYear() : undefined,
                    item.media_type === 'MOVIE' ? 'movie' : 'tv'
                  )
                )
              }
              
              if (providers.buy) {
                watchProviders.buy = providers.buy.map((p: any) => 
                  generateWatchProviderLink(p, item.title,
                    item.release_date ? new Date(item.release_date).getFullYear() : undefined,
                    item.media_type === 'MOVIE' ? 'movie' : 'tv'
                  )
                )
              }
            }
            
            // Extract recommendations
            const recommendations = tmdbDetails.recommendations?.results?.slice(0, 10).map((r: any) => ({
              tmdb_id: r.id,
              media_type: r.media_type === 'movie' ? 'MOVIE' : 'TV_SHOW',
              title: r.title || r.name,
              poster_path: r.poster_path,
              vote_average: r.vote_average
            })) || []
            
            // Get content rating
            let contentRating = null
            if (item.media_type === 'MOVIE' && tmdbDetails.release_dates?.results) {
              const usRelease = tmdbDetails.release_dates.results.find((r: any) => r.iso_3166_1 === 'US')
              contentRating = usRelease?.release_dates?.[0]?.certification
            } else if (item.media_type === 'TV_SHOW' && tmdbDetails.content_ratings?.results) {
              const usRating = tmdbDetails.content_ratings.results.find((r: any) => r.iso_3166_1 === 'US')
              contentRating = usRating?.rating
            }
            
            // Update media item
            const { error: updateError } = await supabaseAdmin
              .from('media_items')
              .update({
                watch_providers: watchProviders,
                recommendations,
                content_rating: contentRating,
                runtime: tmdbDetails.runtime,
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
      
      // Wait between batches
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
console.log('🚀 Starting backfill process...')
backfillMediaData()
  .then(() => {
    console.log('\n✨ Backfill complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Backfill failed:', error)
    process.exit(1)
  })