#!/usr/bin/env tsx

// Test the updated API endpoint with problem movies

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'

dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

const TEST_MOVIES = [
  { id: 'tt1361336', title: 'Miracle in Cell No. 7', year: 2019, type: 'MOVIE' },
  { id: 'tt13622970', title: 'Violet Evergarden: The Movie', year: 2020, type: 'MOVIE' },
  { id: 'tt0117951', title: 'Il Sorpasso', year: 1962, type: 'MOVIE' },
  { id: 'tt11032374', title: 'Demon Slayer: Mugen Train', year: 2020, type: 'MOVIE' }
]

async function testMovie(movie: typeof TEST_MOVIES[0]) {
  console.log(`\nTesting: ${movie.title} (${movie.year})`)
  console.log('=' .repeat(50))
  
  try {
    // Call the local API endpoint
    const response = await fetch(`http://localhost:3000/api/media/${movie.id}/also-liked`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tmdbId: parseInt(movie.id.replace('tt', '')),
        mediaType: movie.type,
        title: movie.title,
        releaseDate: `${movie.year}-01-01`
      })
    })
    
    const data = await response.json()
    
    if (data.percentage !== null) {
      console.log(`✅ SUCCESS: ${data.percentage}% liked`)
    } else {
      console.log(`❌ FAILED: No rating found`)
      console.log(`Message: ${data.message || 'Unknown error'}`)
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error)
  }
}

async function main() {
  console.log('Testing Updated API Endpoint')
  console.log('Make sure the dev server is running (npm run dev)')
  console.log('')
  
  for (const movie of TEST_MOVIES) {
    await testMovie(movie)
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  console.log('\n✨ Test complete!')
}

main().catch(console.error)