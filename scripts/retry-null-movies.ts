#!/usr/bin/env tsx

// Script to retry all movies with NULL also_liked_percentage

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Get all movies with NULL percentage
async function getNullMovies() {
  console.log('📊 Fetching movies with NULL also_liked_percentage...')
  
  const { data, error } = await supabase
    .from('media_items')
    .select('tmdb_id, title, release_date, media_type')
    .is('also_liked_percentage', null)
    .order('popularity', { ascending: false })
  
  if (error) {
    console.error('Error fetching movies:', error)
    return []
  }
  
  return data || []
}

// Convert to queue format
function createQueueFromMovies(movies: any[]): any[] {
  return movies.map(movie => {
    // Extract year from release_date
    let year = null
    if (movie.release_date) {
      year = new Date(movie.release_date).getFullYear()
    }
    
    return {
      tmdbId: movie.tmdb_id,
      title: movie.title,
      year: year,
      mediaType: movie.media_type
    }
  })
}

async function main() {
  console.log('🔄 Retry NULL Movies Script')
  console.log('===========================\n')
  
  // Get all movies with NULL
  const nullMovies = await getNullMovies()
  console.log(`Found ${nullMovies.length} movies with NULL also_liked_percentage\n`)
  
  if (nullMovies.length === 0) {
    console.log('✅ No movies to retry!')
    return
  }
  
  // Show sample of movies
  console.log('Sample movies to retry:')
  nullMovies.slice(0, 10).forEach(movie => {
    const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'
    console.log(`  - ${movie.title} (${year})`)
  })
  
  if (nullMovies.length > 10) {
    console.log(`  ... and ${nullMovies.length - 10} more\n`)
  }
  
  // Create queue file
  const queue = createQueueFromMovies(nullMovies)
  const queuePath = pathJoin(process.cwd(), 'data', 'also-liked-queue.json')
  
  writeFileSync(queuePath, JSON.stringify(queue, null, 2))
  console.log(`\n✅ Created queue file with ${queue.length} movies`)
  console.log(`📁 Queue saved to: ${queuePath}`)
  
  console.log('\n🚀 Next steps:')
  console.log('1. Run the fast worker to process these movies:')
  console.log('   npm run worker:also-liked-fast')
  console.log('\n2. Or run the reliable worker:')
  console.log('   npm run worker:also-liked')
  console.log('\nThe worker will now use improved query strategies to find more matches!')
  
  // Show statistics
  const { data: stats } = await supabase
    .from('media_items')
    .select('also_liked_percentage')
  
  if (stats) {
    const withData = stats.filter(m => m.also_liked_percentage !== null).length
    const total = stats.length
    console.log(`\n📈 Current Coverage: ${withData}/${total} (${((withData/total)*100).toFixed(1)}%)`)
    console.log(`   After this run, you could reach: ${((withData + nullMovies.length*0.5)/total*100).toFixed(1)}% coverage`)
    console.log(`   (Assuming ~50% of NULL movies actually have data)`)
  }
}

main().catch(console.error)