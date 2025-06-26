#!/usr/bin/env tsx

// Test the fixed reliable worker with just 5 movies to verify it works

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

import { fetchAlsoLikedWithRetries } from './fetch-also-liked-reliable'

// Test with 5 movies we know have data
const testMovies = [
  { tmdbId: 872585, title: "Oppenheimer", year: 2023, mediaType: 'MOVIE' as const },
  { tmdbId: 346698, title: "Barbie", year: 2023, mediaType: 'MOVIE' as const },
  { tmdbId: 603, title: "The Matrix", year: 1999, mediaType: 'MOVIE' as const },
  { tmdbId: 155, title: "The Dark Knight", year: 2008, mediaType: 'MOVIE' as const },
  { tmdbId: 27205, title: "Inception", year: 2010, mediaType: 'MOVIE' as const }
]

async function testFixed() {
  console.log('🧪 Testing Fixed Reliable Worker')
  console.log('================================\n')
  
  const results = []
  const startTime = Date.now()
  
  for (let i = 0; i < testMovies.length; i++) {
    const movie = testMovies[i]
    console.log(`\n[${i + 1}/5] Testing: ${movie.title} (${movie.year})`)
    console.log('─'.repeat(50))
    
    const movieStart = Date.now()
    
    try {
      const percentage = await fetchAlsoLikedWithRetries(movie)
      const elapsed = ((Date.now() - movieStart) / 1000).toFixed(1)
      
      if (percentage !== null) {
        console.log(`✅ SUCCESS: ${percentage}% liked (took ${elapsed}s)`)
        results.push({ ...movie, percentage, success: true })
      } else {
        console.log(`❌ NOT FOUND: No data (took ${elapsed}s)`)
        results.push({ ...movie, percentage: null, success: false })
      }
      
    } catch (error) {
      console.log(`❌ ERROR: ${error}`)
      results.push({ ...movie, percentage: null, success: false, error: String(error) })
    }
    
    // Rate limit
    if (i < testMovies.length - 1) {
      console.log('⏳ Rate limiting: waiting 3 seconds...')
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  }
  
  // Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  const successCount = results.filter(r => r.success).length
  
  console.log('\n\n📊 RESULTS SUMMARY')
  console.log('==================')
  console.log(`Total tested: ${results.length}`)
  console.log(`Successful: ${successCount} (${(successCount/results.length*100).toFixed(0)}%)`)
  console.log(`Total time: ${totalTime}s`)
  console.log(`Average time: ${(parseFloat(totalTime)/results.length).toFixed(1)}s per movie`)
  
  console.log('\nDetailed Results:')
  results.forEach(r => {
    const status = r.success ? `✅ ${r.percentage}%` : '❌ Not found'
    console.log(`  ${r.title}: ${status}`)
  })
  
  if (successCount === results.length) {
    console.log('\n✨ Perfect! All movies found successfully!')
  } else if (successCount >= results.length * 0.8) {
    console.log('\n👍 Good performance, but some movies need investigation')
  } else {
    console.log('\n⚠️  Low success rate - needs debugging')
  }
}

// Run test
testFixed().catch(console.error)