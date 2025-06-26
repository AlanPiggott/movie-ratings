#!/usr/bin/env tsx

// Test the speed-optimized worker with timing comparisons

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

// Test movies
const testMovies = [
  { tmdbId: 872585, title: "Oppenheimer", year: 2023, mediaType: 'MOVIE' as const },
  { tmdbId: 346698, title: "Barbie", year: 2023, mediaType: 'MOVIE' as const },
  { tmdbId: 603, title: "The Matrix", year: 1999, mediaType: 'MOVIE' as const },
  { tmdbId: 155, title: "The Dark Knight", year: 2008, mediaType: 'MOVIE' as const },
  { tmdbId: 27205, title: "Inception", year: 2010, mediaType: 'MOVIE' as const },
  { tmdbId: 76600, title: "Avatar: The Way of Water", year: 2022, mediaType: 'MOVIE' as const }
]

async function testSpeedOptimization() {
  console.log('⚡ Speed Optimization Test')
  console.log('=========================\n')
  
  // Import optimized functions
  const { 
    fetchAlsoLikedWithRetriesOptimized,
    waitForTaskOptimized
  } = await import('./fetch-also-liked-optimized-speed')
  
  console.log('Testing parallel processing of 6 movies...\n')
  
  const startTime = Date.now()
  const results = []
  
  // Process all movies in parallel (simulating batch processing)
  const promises = testMovies.map(async (movie, index) => {
    const movieStart = Date.now()
    console.log(`[${index + 1}/6] Starting: ${movie.title}`)
    
    try {
      const percentage = await fetchAlsoLikedWithRetriesOptimized(movie)
      const elapsed = ((Date.now() - movieStart) / 1000).toFixed(1)
      
      if (percentage !== null) {
        console.log(`✅ [${index + 1}/6] ${movie.title}: ${percentage}% (${elapsed}s)`)
        return { ...movie, percentage, time: parseFloat(elapsed), success: true }
      } else {
        console.log(`❌ [${index + 1}/6] ${movie.title}: No data (${elapsed}s)`)
        return { ...movie, percentage: null, time: parseFloat(elapsed), success: false }
      }
    } catch (error) {
      const elapsed = ((Date.now() - movieStart) / 1000).toFixed(1)
      console.log(`❌ [${index + 1}/6] ${movie.title}: Error (${elapsed}s)`)
      return { ...movie, percentage: null, time: parseFloat(elapsed), success: false, error: String(error) }
    }
  })
  
  // Wait for all to complete
  const processedResults = await Promise.all(promises)
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  
  // Display results
  console.log('\n\n📊 SPEED TEST RESULTS')
  console.log('====================')
  
  console.log('\nIndividual Times:')
  processedResults
    .sort((a, b) => a.time - b.time)
    .forEach(r => {
      const status = r.success ? `✅ ${r.percentage}%` : '❌ Failed'
      console.log(`  ${r.title.padEnd(30)} ${r.time.toFixed(1)}s  ${status}`)
    })
  
  const successCount = processedResults.filter(r => r.success).length
  const avgTime = processedResults.reduce((sum, r) => sum + r.time, 0) / processedResults.length
  
  console.log('\n📈 Performance Metrics:')
  console.log(`  Total time: ${totalTime}s`)
  console.log(`  Average time per movie: ${avgTime.toFixed(1)}s`)
  console.log(`  Success rate: ${successCount}/${processedResults.length} (${(successCount/processedResults.length*100).toFixed(0)}%)`)
  console.log(`  Parallel speedup: ~${(avgTime * processedResults.length / parseFloat(totalTime)).toFixed(1)}x`)
  
  // Compare to sequential estimate
  const sequentialEstimate = avgTime * processedResults.length
  const timeSaved = sequentialEstimate - parseFloat(totalTime)
  console.log(`\n⏱️ Time Comparison:`)
  console.log(`  Sequential estimate: ${sequentialEstimate.toFixed(1)}s`)
  console.log(`  Parallel actual: ${totalTime}s`)
  console.log(`  Time saved: ${timeSaved.toFixed(1)}s (${(timeSaved/sequentialEstimate*100).toFixed(0)}% faster)`)
  
  if (avgTime <= 20) {
    console.log('\n✨ SUCCESS! Target of <20s average achieved!')
  } else {
    console.log(`\n⚠️ Average time ${avgTime.toFixed(1)}s is above 20s target`)
  }
}

// Run test
testSpeedOptimization().catch(console.error)