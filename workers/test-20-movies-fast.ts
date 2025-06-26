#!/usr/bin/env tsx

// Load environment variables from .env.local
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

// DataForSEO credentials
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD

if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
  console.error('❌ Missing DataForSEO credentials')
  process.exit(1)
}

// Test movies - mix of easy and challenging titles
const testMovies = [
  // Classic/Easy titles
  { title: "Forrest Gump", year: 1994, category: "Classic" },
  { title: "The Shawshank Redemption", year: 1994, category: "Classic" },
  { title: "Pulp Fiction", year: 1994, category: "Classic" },
  { title: "The Godfather", year: 1972, category: "Classic" },
  { title: "Schindler's List", year: 1993, category: "Classic" },
  
  // Franchise films (challenging)
  { title: "Spider-Man: No Way Home", year: 2021, category: "Franchise" },
  { title: "The Avengers", year: 2012, category: "Franchise" },
  { title: "Avengers: Endgame", year: 2019, category: "Franchise" },
  { title: "The Dark Knight", year: 2008, category: "Franchise" },
  { title: "Batman Begins", year: 2005, category: "Franchise" },
  
  // Movies with numbers/sequels
  { title: "Terminator 2: Judgment Day", year: 1991, category: "Sequel" },
  { title: "Blade Runner 2049", year: 2017, category: "Sequel" },
  { title: "2001: A Space Odyssey", year: 1968, category: "Number" },
  { title: "300", year: 2006, category: "Number" },
  
  // Recent popular films
  { title: "Oppenheimer", year: 2023, category: "Recent" },
  { title: "Barbie", year: 2023, category: "Recent" },
  { title: "Dune", year: 2021, category: "Recent" },
  
  // Ambiguous titles
  { title: "It", year: 2017, category: "Ambiguous" },
  { title: "Her", year: 2013, category: "Ambiguous" },
  { title: "Up", year: 2009, category: "Ambiguous" }
]

// Extract percentage from HTML
function extractPercentage(html: string): number | null {
  const patterns = [
    /(\d{1,3})%\s*liked\s*this\s*(movie|film)/i,
    /(\d{1,3})%\s*of\s*(?:Google\s*)?users\s*liked/i,
    />(\d{1,3})%\s*liked\s*this/i,
    /class="[^"]*srBp4[^"]*"[^>]*>\s*(\d{1,3})%/i,
    /(\d{1,3})%\s*liked/i
  ]
  
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match) {
      const percentage = parseInt(match[1])
      if (percentage >= 0 && percentage <= 100) {
        return percentage
      }
    }
  }
  
  return null
}

// Process a batch of movies
async function processBatch(movies: typeof testMovies, startIdx: number = 0): Promise<any[]> {
  const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
  const results = []
  
  // Create all tasks first
  console.log(`\nCreating tasks for movies ${startIdx + 1}-${startIdx + movies.length}...`)
  const taskIds = []
  
  for (const movie of movies) {
    const query = `${movie.title} ${movie.year} movie`
    
    try {
      const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/task_post', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          language_code: 'en',
          location_code: 2840,
          keyword: query
        }])
      })
      
      const data = await response.json()
      if (data.tasks?.[0]?.id) {
        taskIds.push({ taskId: data.tasks[0].id, movie, query })
      }
    } catch (error) {
      console.error(`Error creating task for ${movie.title}`)
    }
  }
  
  // Wait for tasks to complete
  console.log(`Waiting 10 seconds for ${taskIds.length} tasks to complete...`)
  await new Promise(resolve => setTimeout(resolve, 10000))
  
  // Fetch all results
  console.log('Fetching results...')
  for (const { taskId, movie, query } of taskIds) {
    try {
      const response = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
        method: 'GET',
        headers: { 'Authorization': authHeader }
      })
      
      const data = await response.json()
      const html = data.tasks?.[0]?.result?.[0]?.items?.[0]?.html || ''
      const percentage = html ? extractPercentage(html) : null
      
      results.push({
        ...movie,
        percentage,
        query,
        found: percentage !== null
      })
      
      console.log(`${movie.title} (${movie.year}): ${percentage !== null ? `${percentage}%` : 'Not found'}`)
      
    } catch (error) {
      results.push({
        ...movie,
        percentage: null,
        query,
        found: false
      })
    }
  }
  
  return results
}

// Main test function
async function runFastTest() {
  console.log('🎬 Fast Comprehensive Movie Test')
  console.log('================================\n')
  
  const startTime = Date.now()
  const batchSize = 5
  const allResults = []
  
  // Process in batches
  for (let i = 0; i < testMovies.length; i += batchSize) {
    const batch = testMovies.slice(i, i + batchSize)
    const results = await processBatch(batch, i)
    allResults.push(...results)
    
    // Wait between batches
    if (i + batchSize < testMovies.length) {
      console.log('\nWaiting 3 seconds before next batch...')
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  }
  
  // Display final results
  const runtime = Math.round((Date.now() - startTime) / 1000)
  const successful = allResults.filter(r => r.found)
  
  console.log('\n\n📊 FINAL RESULTS')
  console.log('================\n')
  
  // By category
  const categories = ['Classic', 'Franchise', 'Sequel', 'Number', 'Recent', 'Ambiguous']
  for (const category of categories) {
    const categoryMovies = allResults.filter(m => m.category === category)
    const found = categoryMovies.filter(m => m.found).length
    console.log(`\n${category} Movies (${found}/${categoryMovies.length} found):`)
    
    categoryMovies.forEach(movie => {
      const status = movie.found ? `✅ ${movie.percentage}%` : '❌ Not found'
      console.log(`  ${movie.title} (${movie.year}): ${status}`)
    })
  }
  
  // Summary
  console.log('\n\n📈 SUMMARY')
  console.log('==========')
  console.log(`Total movies tested: ${allResults.length}`)
  console.log(`Successfully found: ${successful.length} (${(successful.length/allResults.length*100).toFixed(1)}%)`)
  console.log(`Not found: ${allResults.length - successful.length}`)
  console.log(`Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`)
  console.log(`Estimated cost: ~$${(allResults.length * 0.0006).toFixed(2)}`)
}

// Run the test
runFastTest().catch(console.error)