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

// Test movies
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

// Extract percentage with FIXED regex patterns
function extractPercentage(html: string): number | null {
  const patterns = [
    /(\d{1,3})%\s*liked\s*this\s*(movie|film)/gi,
    /(\d{1,3})%\s*of\s*(?:Google\s*)?users\s*liked/gi,
    />(\d{1,3})%\s*liked\s*this/gi,
    /class="[^"]*srBp4[^"]*"[^>]*>\s*(\d{1,3})%/gi,
    /(\d{1,3})%\s*liked/gi,
    /liked\s*by\s*(\d{1,3})%/gi,
    /audience\s*score[:\s]*(\d{1,3})%/gi
  ]
  
  for (const pattern of patterns) {
    const matches = html.match(pattern)
    if (matches) {
      for (const match of matches) {
        const percentMatch = match.match(/(\d{1,3})/)
        if (percentMatch) {
          const percentage = parseInt(percentMatch[1])
          if (percentage >= 0 && percentage <= 100) {
            return percentage
          }
        }
      }
    }
  }
  
  return null
}

// Process all movies efficiently
async function runOptimizedTest() {
  console.log('🎬 Optimized Movie Test (All 20 Movies)')
  console.log('=======================================\n')
  
  const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
  const startTime = Date.now()
  const results = []
  
  // Process in smaller batches of 4 for better parallelism
  for (let i = 0; i < testMovies.length; i += 4) {
    const batch = testMovies.slice(i, i + 4)
    console.log(`\nBatch ${Math.floor(i/4) + 1}: Processing ${batch.map(m => m.title).join(', ')}...`)
    
    // Create tasks for primary queries
    const tasks = []
    for (const movie of batch) {
      // Try the most successful query format first
      const query = `${movie.title} ${movie.year} movie`
      
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
        tasks.push({ taskId: data.tasks[0].id, movie, query })
      }
    }
    
    // Wait for tasks
    await new Promise(resolve => setTimeout(resolve, 8000))
    
    // Fetch results
    for (const { taskId, movie, query } of tasks) {
      const htmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
        method: 'GET',
        headers: { 'Authorization': authHeader }
      })
      
      const htmlData = await htmlResponse.json()
      const html = htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html || ''
      let percentage = html ? extractPercentage(html) : null
      
      // If failed, try parentheses format (worked for many movies)
      if (percentage === null) {
        const retryQuery = `${movie.title} (${movie.year}) movie`
        console.log(`  Retrying ${movie.title} with: "${retryQuery}"`)
        
        const retryResponse = await fetch('https://api.dataforseo.com/v3/serp/google/organic/task_post', {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([{
            language_code: 'en',
            location_code: 2840,
            keyword: retryQuery
          }])
        })
        
        const retryData = await retryResponse.json()
        if (retryData.tasks?.[0]?.id) {
          await new Promise(resolve => setTimeout(resolve, 8000))
          
          const retryHtmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${retryData.tasks[0].id}`, {
            method: 'GET',
            headers: { 'Authorization': authHeader }
          })
          
          const retryHtmlData = await retryHtmlResponse.json()
          const retryHtml = retryHtmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html || ''
          percentage = retryHtml ? extractPercentage(retryHtml) : null
        }
      }
      
      results.push({
        ...movie,
        percentage,
        found: percentage !== null
      })
      
      console.log(`  ${movie.title}: ${percentage !== null ? `✅ ${percentage}%` : '❌ Not found'}`)
    }
    
    // Rate limit between batches
    if (i + 4 < testMovies.length) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  // Display final results
  const runtime = Math.round((Date.now() - startTime) / 1000)
  const successful = results.filter(r => r.found)
  
  console.log('\n\n📊 COMPLETE RESULTS FOR ALL 20 MOVIES')
  console.log('=====================================\n')
  
  console.log('Movie                                    Year    % Liked')
  console.log('─'.repeat(60))
  
  results.forEach(movie => {
    const title = movie.title.padEnd(40)
    const year = movie.year.toString().padEnd(8)
    const status = movie.found ? `✅ ${movie.percentage}%` : '❌ Not found'
    console.log(`${title} ${year}${status}`)
  })
  
  console.log('\n📈 SUMMARY')
  console.log('==========')
  console.log(`Success rate: ${successful.length}/${results.length} (${(successful.length/results.length*100).toFixed(1)}%)`)
  console.log(`Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`)
  
  // Show which movies failed
  const failed = results.filter(r => !r.found)
  if (failed.length > 0) {
    console.log('\n❌ Movies without data:')
    failed.forEach(m => console.log(`  - ${m.title} (${m.year})`))
  }
}

// Run the test
runOptimizedTest().catch(console.error)