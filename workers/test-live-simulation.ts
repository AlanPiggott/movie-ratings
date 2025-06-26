#!/usr/bin/env tsx

// Simulate exactly how the reliable worker will process movies on the live site

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

import { writeFileSync, mkdirSync, existsSync } from 'fs'

// 20 movies for comprehensive testing - mix of easy and challenging titles
const testMovies = [
  // Previously problematic movies
  { tmdbId: 603, title: "The Matrix", year: 1999, mediaType: 'MOVIE' as const },
  { tmdbId: 76600, title: "Avatar: The Way of Water", year: 2022, mediaType: 'MOVIE' as const },
  { tmdbId: 1124, title: "The Prestige", year: 2006, mediaType: 'MOVIE' as const },
  
  // Recent blockbusters
  { tmdbId: 872585, title: "Oppenheimer", year: 2023, mediaType: 'MOVIE' as const },
  { tmdbId: 346698, title: "Barbie", year: 2023, mediaType: 'MOVIE' as const },
  { tmdbId: 569094, title: "Spider-Man: Across the Spider-Verse", year: 2023, mediaType: 'MOVIE' as const },
  { tmdbId: 361743, title: "Top Gun: Maverick", year: 2022, mediaType: 'MOVIE' as const },
  
  // Classic films
  { tmdbId: 13, title: "Forrest Gump", year: 1994, mediaType: 'MOVIE' as const },
  { tmdbId: 424, title: "Schindler's List", year: 1993, mediaType: 'MOVIE' as const },
  { tmdbId: 238, title: "The Godfather", year: 1972, mediaType: 'MOVIE' as const },
  
  // Franchise films (ambiguous titles)
  { tmdbId: 11, title: "Star Wars", original_title: "Star Wars", year: 1977, mediaType: 'MOVIE' as const },
  { tmdbId: 157336, title: "Interstellar", year: 2014, mediaType: 'MOVIE' as const },
  { tmdbId: 27205, title: "Inception", year: 2010, mediaType: 'MOVIE' as const },
  
  // Foreign/artistic films
  { tmdbId: 496243, title: "Parasite", original_title: "기생충", year: 2019, mediaType: 'MOVIE' as const },
  { tmdbId: 545611, title: "Everything Everywhere All at Once", year: 2022, mediaType: 'MOVIE' as const },
  
  // Animated films
  { tmdbId: 129, title: "Spirited Away", original_title: "千と千尋の神隠し", year: 2001, mediaType: 'MOVIE' as const },
  { tmdbId: 920, title: "Cars", year: 2006, mediaType: 'MOVIE' as const },
  
  // Action films
  { tmdbId: 680, title: "Pulp Fiction", year: 1994, mediaType: 'MOVIE' as const },
  { tmdbId: 155, title: "The Dark Knight", year: 2008, mediaType: 'MOVIE' as const },
  { tmdbId: 24428, title: "The Avengers", year: 2012, mediaType: 'MOVIE' as const }
]

async function simulateLiveProcessing() {
  console.log('🎬 Live Site Simulation - 20 Movies')
  console.log('===================================')
  console.log('Simulating exact production behavior...\n')
  
  // Step 1: Create queue file exactly as the seed script would
  const dataDir = pathJoin(process.cwd(), 'data')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  
  const queueFile = pathJoin(dataDir, 'also-liked-queue-test.json')
  writeFileSync(queueFile, JSON.stringify(testMovies, null, 2))
  console.log(`✅ Created test queue with ${testMovies.length} movies\n`)
  
  // Step 2: Import and run the reliable worker
  const { fetchAlsoLikedWithRetries } = await import('./fetch-also-liked-reliable')
  
  const results = []
  const startTime = Date.now()
  let successCount = 0
  let failedCount = 0
  let notFoundCount = 0
  
  // Process each movie exactly as the worker would
  for (let i = 0; i < testMovies.length; i++) {
    const movie = testMovies[i]
    const movieNum = i + 1
    
    console.log(`\n[${movieNum}/20] Processing: "${movie.title}" (${movie.year})`)
    console.log('─'.repeat(60))
    
    const movieStartTime = Date.now()
    
    try {
      const percentage = await fetchAlsoLikedWithRetries(movie)
      const processingTime = ((Date.now() - movieStartTime) / 1000).toFixed(1)
      
      if (percentage !== null) {
        console.log(`✅ SUCCESS: ${percentage}% liked this movie (took ${processingTime}s)`)
        results.push({ ...movie, percentage, status: 'success' })
        successCount++
      } else {
        console.log(`📊 NOT FOUND: No percentage data available (took ${processingTime}s)`)
        results.push({ ...movie, percentage: null, status: 'not_found' })
        notFoundCount++
      }
      
    } catch (error) {
      const processingTime = ((Date.now() - movieStartTime) / 1000).toFixed(1)
      console.log(`❌ FAILED: ${error} (took ${processingTime}s)`)
      results.push({ ...movie, percentage: null, status: 'failed', error: String(error) })
      failedCount++
    }
    
    // Rate limiting between movies (3-5 seconds)
    if (i < testMovies.length - 1) {
      const delay = 3000 + Math.random() * 2000
      console.log(`⏳ Rate limiting: waiting ${(delay/1000).toFixed(1)}s before next movie...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  // Calculate total runtime
  const totalRuntime = Math.round((Date.now() - startTime) / 1000)
  const minutes = Math.floor(totalRuntime / 60)
  const seconds = totalRuntime % 60
  
  // Display comprehensive results
  console.log('\n\n' + '='.repeat(70))
  console.log('📊 FINAL RESULTS - LIVE SIMULATION')
  console.log('='.repeat(70) + '\n')
  
  console.log('Movie Title                                        Year    Status         % Liked')
  console.log('─'.repeat(80))
  
  results.forEach(movie => {
    const title = movie.title.substring(0, 48).padEnd(50)
    const year = movie.year.toString().padEnd(8)
    const status = movie.status === 'success' ? '✅ Found    ' : 
                   movie.status === 'not_found' ? '📊 No Data  ' : '❌ Failed   '
    const percentage = movie.percentage !== null ? `${movie.percentage}%` : '-'
    console.log(`${title} ${year}${status} ${percentage.padStart(7)}`)
  })
  
  // Summary statistics
  console.log('\n' + '─'.repeat(80))
  console.log('\n📈 PERFORMANCE SUMMARY')
  console.log('=====================')
  console.log(`Total movies processed: ${results.length}`)
  console.log(`Successfully extracted: ${successCount} (${(successCount/results.length*100).toFixed(1)}%)`)
  console.log(`No data available:     ${notFoundCount} (${(notFoundCount/results.length*100).toFixed(1)}%)`)
  console.log(`Failed to process:     ${failedCount} (${(failedCount/results.length*100).toFixed(1)}%)`)
  console.log(`Total runtime:         ${minutes}m ${seconds}s`)
  console.log(`Average time per movie: ${(totalRuntime/results.length).toFixed(1)}s`)
  
  // Cost analysis
  const estimatedCost = (results.length * 4 * 0.0006).toFixed(2) // Max 4 queries per movie
  console.log(`\n💰 Estimated DataForSEO cost: ~$${estimatedCost}`)
  
  // Reliability analysis
  const reliabilityScore = ((successCount + notFoundCount) / results.length * 100).toFixed(1)
  console.log(`\n🎯 Reliability Score: ${reliabilityScore}%`)
  console.log('(Movies processed without errors)\n')
  
  // Show any failed movies
  const failedMovies = results.filter(r => r.status === 'failed')
  if (failedMovies.length > 0) {
    console.log('❌ Failed Movies:')
    failedMovies.forEach(m => {
      console.log(`  - ${m.title} (${m.year}): ${m.error}`)
    })
  }
  
  // Show movies without data
  const noDataMovies = results.filter(r => r.status === 'not_found')
  if (noDataMovies.length > 0) {
    console.log('\n📊 Movies Without Google % Data:')
    noDataMovies.forEach(m => {
      console.log(`  - ${m.title} (${m.year})`)
    })
  }
  
  // Performance insights
  console.log('\n💡 INSIGHTS')
  console.log('===========')
  
  // Success rate by era
  const byDecade = {
    '1970s': results.filter(m => m.year >= 1970 && m.year < 1980),
    '1990s': results.filter(m => m.year >= 1990 && m.year < 2000),
    '2000s': results.filter(m => m.year >= 2000 && m.year < 2010),
    '2010s': results.filter(m => m.year >= 2010 && m.year < 2020),
    '2020s': results.filter(m => m.year >= 2020)
  }
  
  console.log('\nSuccess rate by era:')
  Object.entries(byDecade).forEach(([decade, movies]) => {
    if (movies.length > 0) {
      const decadeSuccess = movies.filter(m => m.status === 'success').length
      const rate = (decadeSuccess / movies.length * 100).toFixed(0)
      console.log(`  ${decade}: ${decadeSuccess}/${movies.length} (${rate}%)`)
    }
  })
  
  // Final recommendation
  console.log('\n✨ RECOMMENDATION')
  console.log('=================')
  if (reliabilityScore >= 95) {
    console.log('The reliable worker is performing excellently! Ready for production use.')
  } else if (reliabilityScore >= 85) {
    console.log('Good performance, but consider investigating the failed movies.')
  } else {
    console.log('Performance needs improvement. Check the failed movies log for patterns.')
  }
  
  // Clean up test queue
  const { unlinkSync } = await import('fs')
  unlinkSync(queueFile)
  console.log('\n🧹 Test queue cleaned up')
}

// Run simulation
simulateLiveProcessing().catch(console.error)