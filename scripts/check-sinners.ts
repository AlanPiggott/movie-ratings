#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

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

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL!,
  envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function checkSinners() {
  // Search for Sinners
  const { data: movies, error } = await supabase
    .from('media_items')
    .select(`
      *,
      media_genres(
        genre:genres(*)
      )
    `)
    .ilike('title', '%sinners%')
    .eq('media_type', 'MOVIE')
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  if (!movies || movies.length === 0) {
    console.log('No movies found with "Sinners" in the title')
    return
  }
  
  for (const movie of movies) {
    console.log('\n=================================')
    console.log(`Title: ${movie.title}`)
    console.log(`ID: ${movie.id}`)
    console.log(`TMDB ID: ${movie.tmdb_id}`)
    console.log(`Release Date: ${movie.release_date}`)
    console.log(`Runtime: ${movie.runtime} minutes`)
    console.log(`Popularity: ${movie.popularity}`)
    console.log(`Vote Average: ${movie.vote_average}`)
    console.log(`Also Liked %: ${movie.also_liked_percentage}`)
    console.log(`Content Rating: ${movie.content_rating}`)
    
    // Genres
    const genres = movie.media_genres?.map((mg: any) => mg.genre?.name).filter(Boolean) || []
    console.log(`Genres: ${genres.join(', ') || 'None'}`)
    
    // Watch Providers
    if (movie.watch_providers) {
      console.log('\nWhere to Watch:')
      if (movie.watch_providers.flatrate) {
        console.log('  Streaming:')
        movie.watch_providers.flatrate.forEach((p: any) => {
          console.log(`    - ${p.provider_name}${p.link ? ` (${p.link})` : ''}`)
        })
      }
      if (movie.watch_providers.rent) {
        console.log('  Rent:')
        movie.watch_providers.rent.forEach((p: any) => {
          console.log(`    - ${p.provider_name}${p.link ? ` (${p.link})` : ''}`)
        })
      }
      if (movie.watch_providers.buy) {
        console.log('  Buy:')
        movie.watch_providers.buy.forEach((p: any) => {
          console.log(`    - ${p.provider_name}${p.link ? ` (${p.link})` : ''}`)
        })
      }
    } else {
      console.log('\nWhere to Watch: No data available')
    }
    
    // Recommendations
    if (movie.recommendations && movie.recommendations.length > 0) {
      console.log('\nRecommendations:')
      movie.recommendations.slice(0, 5).forEach((r: any) => {
        console.log(`  - ${r.title} (${r.media_type})`)
      })
    }
    
    console.log('=================================')
  }
}

checkSinners()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err)
    process.exit(1)
  })