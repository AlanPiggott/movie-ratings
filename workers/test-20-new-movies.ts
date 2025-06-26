#!/usr/bin/env tsx

// Load environment variables from .env.local
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

// Import the optimized functions
import { fetchAlsoLikedPercentage, buildOptimizedQuery } from './fetch-also-liked-optimized'

// 20 different movies for testing
const testMovies = [
  // 90s Classics
  { title: "The Matrix", year: 1999, mediaType: 'MOVIE' as const },
  { title: "Fight Club", year: 1999, mediaType: 'MOVIE' as const },
  { title: "Good Will Hunting", year: 1997, mediaType: 'MOVIE' as const },
  { title: "The Sixth Sense", year: 1999, mediaType: 'MOVIE' as const },
  { title: "American Beauty", year: 1999, mediaType: 'MOVIE' as const },
  
  // 2000s Films
  { title: "Gladiator", year: 2000, mediaType: 'MOVIE' as const },
  { title: "The Lord of the Rings: The Fellowship of the Ring", year: 2001, mediaType: 'MOVIE' as const },
  { title: "Inception", year: 2010, mediaType: 'MOVIE' as const },
  { title: "The Departed", year: 2006, mediaType: 'MOVIE' as const },
  { title: "No Country for Old Men", year: 2007, mediaType: 'MOVIE' as const },
  
  // Recent Films (2020s)
  { title: "Everything Everywhere All at Once", year: 2022, mediaType: 'MOVIE' as const },
  { title: "Top Gun: Maverick", year: 2022, mediaType: 'MOVIE' as const },
  { title: "The Batman", year: 2022, mediaType: 'MOVIE' as const },
  { title: "Glass Onion: A Knives Out Mystery", year: 2022, mediaType: 'MOVIE' as const },
  { title: "Avatar: The Way of Water", year: 2022, mediaType: 'MOVIE' as const },
  
  // Challenging titles
  { title: "Se7en", year: 1995, mediaType: 'MOVIE' as const },
  { title: "12 Angry Men", year: 1957, mediaType: 'MOVIE' as const },
  { title: "V for Vendetta", year: 2005, mediaType: 'MOVIE' as const },
  { title: "A Beautiful Mind", year: 2001, mediaType: 'MOVIE' as const },
  { title: "The Prestige", year: 2006, mediaType: 'MOVIE' as const }
]

// Test function
async function testNewMovies() {
  console.log('🎬 Testing 20 New Movies with Optimized Approach')
  console.log('===============================================\n')
  
  const results = []
  const startTime = Date.now()
  
  // Process all movies
  for (let i = 0; i < testMovies.length; i++) {
    const movie = testMovies[i]
    const query = buildOptimizedQuery({
      tmdbId: i + 1, // dummy ID for test
      title: movie.title,
      year: movie.year,
      mediaType: movie.mediaType,
    })
    
    console.log(`[${i + 1}/20] Testing: ${movie.title} (${movie.year})`)
    console.log(`      Query: "${query}"`)
    
    try {
      const percentage = await fetchAlsoLikedPercentage({
        tmdbId: i + 1,
        title: movie.title,
        year: movie.year,
        mediaType: movie.mediaType,
      })
      
      results.push({
        ...movie,
        percentage,
        found: percentage !== null,
        query
      })
      
      if (percentage !== null) {
        console.log(`      Result: ✅ ${percentage}% liked\n`)
      } else {
        console.log(`      Result: ❌ Not found\n`)
      }
      
    } catch (error) {
      console.log(`      Result: ❌ Error: ${error}\n`)
      results.push({
        ...movie,
        percentage: null,
        found: false,
        query,
        error: String(error)
      })
    }
    
    // Rate limiting
    if (i < testMovies.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  // Display summary
  const runtime = Math.round((Date.now() - startTime) / 1000)
  const successful = results.filter(r => r.found)
  
  console.log('\n📊 FINAL RESULTS')
  console.log('================\n')
  
  console.log('Movie                                              Year    % Liked')
  console.log('─'.repeat(70))
  
  results.forEach(movie => {
    const title = movie.title.padEnd(50)
    const year = movie.year.toString().padEnd(8)
    const status = movie.found ? `✅ ${movie.percentage}%` : '❌ Not found'
    console.log(`${title} ${year}${status}`)
  })
  
  console.log('\n📈 SUMMARY')
  console.log('==========')
  console.log(`Total movies tested: ${results.length}`)
  console.log(`Successfully found: ${successful.length}`)
  console.log(`Not found: ${results.length - successful.length}`)
  console.log(`Success rate: ${((successful.length / results.length) * 100).toFixed(1)}%`)
  console.log(`Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`)
  
  // Group by decade
  console.log('\n📅 Results by Era:')
  const eras = {
    '1950s': results.filter(m => m.year >= 1950 && m.year < 1960),
    '1990s': results.filter(m => m.year >= 1990 && m.year < 2000),
    '2000s': results.filter(m => m.year >= 2000 && m.year < 2010),
    '2010s': results.filter(m => m.year >= 2010 && m.year < 2020),
    '2020s': results.filter(m => m.year >= 2020)
  }
  
  Object.entries(eras).forEach(([era, movies]) => {
    if (movies.length > 0) {
      const found = movies.filter(m => m.found).length
      console.log(`  ${era}: ${found}/${movies.length} (${((found/movies.length)*100).toFixed(0)}%)`)
    }
  })
  
  // Show failures if any
  const failed = results.filter(r => !r.found)
  if (failed.length > 0) {
    console.log('\n❌ Movies without data:')
    failed.forEach(m => {
      console.log(`  - ${m.title} (${m.year})`)
      if (m.error) console.log(`    Error: ${m.error}`)
    })
  } else {
    console.log('\n✨ 100% SUCCESS! All movies found!')
  }
  
  console.log(`\n💰 Estimated cost: ~$${(results.length * 2 * 0.0006).toFixed(2)}`)
}

// Run test
testNewMovies().catch(console.error)