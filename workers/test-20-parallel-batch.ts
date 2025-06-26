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

// 20 different movies for testing
const testMovies = [
  // 90s Classics
  { title: "The Matrix", year: 1999 },
  { title: "Fight Club", year: 1999 },
  { title: "Good Will Hunting", year: 1997 },
  { title: "The Sixth Sense", year: 1999 },
  { title: "American Beauty", year: 1999 },
  
  // 2000s Films
  { title: "Gladiator", year: 2000 },
  { title: "The Lord of the Rings: The Fellowship of the Ring", year: 2001 },
  { title: "Inception", year: 2010 },
  { title: "The Departed", year: 2006 },
  { title: "No Country for Old Men", year: 2007 },
  
  // Recent Films (2020s)
  { title: "Everything Everywhere All at Once", year: 2022 },
  { title: "Top Gun: Maverick", year: 2022 },
  { title: "The Batman", year: 2022 },
  { title: "Glass Onion: A Knives Out Mystery", year: 2022 },
  { title: "Avatar: The Way of Water", year: 2022 },
  
  // Challenging titles
  { title: "Se7en", year: 1995 },
  { title: "12 Angry Men", year: 1957 },
  { title: "V for Vendetta", year: 2005 },
  { title: "A Beautiful Mind", year: 2001 },
  { title: "The Prestige", year: 2006 }
]

// Extract percentage with proven patterns
function extractPercentage(html: string): number | null {
  const patterns = [
    /(\d{1,3})%\s*liked\s*this\s*(movie|film)/gi,
    /(\d{1,3})%\s*of\s*(?:Google\s*)?users\s*liked/gi,
    />(\d{1,3})%\s*liked\s*this/gi,
    /(\d{1,3})%\s*liked/gi
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

// Process movies in parallel batches
async function testParallelBatch() {
  console.log('🚀 Parallel Batch Test - 20 Movies')
  console.log('==================================\n')
  
  const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
  const startTime = Date.now()
  const results = []
  const batchSize = 5
  
  // Process in batches
  for (let i = 0; i < testMovies.length; i += batchSize) {
    const batch = testMovies.slice(i, i + batchSize)
    console.log(`\n📦 Batch ${Math.floor(i/batchSize) + 1}: Creating tasks for ${batch.length} movies...`)
    
    // Create all tasks for this batch
    const tasks = []
    for (const movie of batch) {
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
          tasks.push({
            taskId: data.tasks[0].id,
            movie,
            query
          })
          console.log(`   ✓ Created task for: ${movie.title}`)
        }
      } catch (error) {
        console.log(`   ✗ Failed to create task for: ${movie.title}`)
      }
    }
    
    // Wait for tasks to complete
    console.log(`   ⏳ Waiting 10 seconds for tasks to complete...`)
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    // Fetch all results for this batch
    console.log(`   📥 Fetching results...`)
    for (const { taskId, movie, query } of tasks) {
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
          found: percentage !== null,
          query
        })
        
        console.log(`   ${movie.title}: ${percentage !== null ? `✅ ${percentage}%` : '❌ Not found'}`)
        
      } catch (error) {
        results.push({
          ...movie,
          percentage: null,
          found: false,
          query
        })
        console.log(`   ${movie.title}: ❌ Error fetching`)
      }
    }
  }
  
  // Display final results
  const runtime = Math.round((Date.now() - startTime) / 1000)
  const successful = results.filter(r => r.found)
  
  console.log('\n\n📊 FINAL RESULTS - ALL 20 MOVIES')
  console.log('================================\n')
  
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
  console.log(`Runtime: ${runtime} seconds`)
  
  // Show which ones failed
  const failed = results.filter(r => !r.found)
  if (failed.length > 0) {
    console.log('\n❌ Movies without data:')
    failed.forEach(m => console.log(`  - ${m.title} (${m.year})`))
  } else {
    console.log('\n✨ 100% SUCCESS! All movies found!')
  }
  
  console.log(`\n💰 Estimated cost: ~$${(results.length * 0.0006).toFixed(2)}`)
}

// Run test
testParallelBatch().catch(console.error)