#!/usr/bin/env tsx

// Test the new reliable worker functionality

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

import { 
  fetchAlsoLikedWithRetries, 
  extractPercentageFromHTML, 
  buildQueryStrategies,
  waitForTask,
  getTaskHtmlWithRetry
} from './fetch-also-liked-reliable'

// Test movies - including ones that previously failed
const testMovies = [
  { tmdbId: 1, title: "The Matrix", year: 1999, mediaType: 'MOVIE' as const },
  { tmdbId: 2, title: "Avatar: The Way of Water", year: 2022, mediaType: 'MOVIE' as const },
  { tmdbId: 3, title: "The Prestige", year: 2006, mediaType: 'MOVIE' as const },
  { tmdbId: 4, title: "Oppenheimer", year: 2023, mediaType: 'MOVIE' as const }
]

async function testReliableWorker() {
  console.log('🧪 Testing Reliable Worker Features')
  console.log('==================================\n')
  
  for (const movie of testMovies) {
    console.log(`\n📽️ Testing: ${movie.title} (${movie.year})`)
    console.log('-'.repeat(50))
    
    // Test query building
    const queries = buildQueryStrategies(movie)
    console.log('Query strategies:')
    queries.forEach((q, i) => console.log(`  ${i+1}. "${q}"`))
    
    // Test the full fetch with retries
    console.log('\nFetching percentage with full retry logic...')
    const startTime = Date.now()
    
    try {
      const percentage = await fetchAlsoLikedWithRetries(movie)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      
      if (percentage !== null) {
        console.log(`✅ SUCCESS: ${percentage}% liked (took ${elapsed}s)`)
      } else {
        console.log(`❌ FAILED: No percentage found (took ${elapsed}s)`)
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error}`)
    }
  }
  
  // Check failed movies log
  console.log('\n\n📋 Checking failed movies log...')
  try {
    const { readFileSync, existsSync } = await import('fs')
    const FAILED_FILE = pathJoin(process.cwd(), 'data', 'failed-movies.json')
    
    if (existsSync(FAILED_FILE)) {
      const failedData = JSON.parse(readFileSync(FAILED_FILE, 'utf-8'))
      const failedCount = Object.keys(failedData).length
      
      console.log(`Found ${failedCount} movies with failed attempts`)
      
      if (failedCount > 0) {
        console.log('\nSample failed attempts:')
        Object.entries(failedData).slice(0, 3).forEach(([key, data]: [string, any]) => {
          console.log(`\n${data.movie.title}:`)
          console.log(`  Total attempts: ${data.totalAttempts}`)
          console.log(`  Last attempt: ${data.lastAttemptDate}`)
          console.log(`  Errors: ${data.attempts.map((a: any) => a.error).join(', ')}`)
        })
      }
    } else {
      console.log('No failed movies log found (good sign!)')
    }
  } catch (error) {
    console.log('Could not read failed movies log')
  }
  
  console.log('\n✨ Test complete!')
}

// Run test
testReliableWorker().catch(console.error)