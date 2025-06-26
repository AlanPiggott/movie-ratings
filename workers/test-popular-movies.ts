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

// Test with popular movies that should have Google sentiment data
const testMovies = [
  {
    tmdbId: 569094,
    title: "Spider-Man: Across the Spider-Verse",
    year: 2023,
    mediaType: 'MOVIE' as const
  },
  {
    tmdbId: 872585,
    title: "Oppenheimer",
    year: 2023,
    mediaType: 'MOVIE' as const
  },
  {
    tmdbId: 346698,
    title: "Barbie",
    year: 2023,
    mediaType: 'MOVIE' as const
  }
]

// Progress logging
function logProgress(message: string) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  console.log(`[${timestamp}] ${message}`)
}

// Comprehensive patterns for percentage extraction
const PERCENTAGE_PATTERNS = [
  // Direct percentage patterns
  /(\d{1,3})%\s*liked\s*this\s*(film|movie|show|series|tv\s*show)/i,
  /(\d{1,3})%\s*of\s*(?:Google\s*)?(?:users|people|viewers)\s*liked\s*this/i,
  /(\d{1,3})%\s*liked/i,
  /liked.*?(\d{1,3})%/i,
  
  // Audience score patterns
  /audience\s*score[:\s]*(\d{1,3})%/i,
  /audience[:\s]*(\d{1,3})%/i,
  /(\d{1,3})%\s*audience/i,
  
  // User score patterns
  /user\s*score[:\s]*(\d{1,3})%/i,
  /users[:\s]*(\d{1,3})%/i,
  
  // General positive sentiment
  /(\d{1,3})%\s*positive/i,
  /(\d{1,3})%\s*approval/i,
  
  // Google specific
  /google\s*users[:\s]*(\d{1,3})%/i,
  /(\d{1,3})%\s*google\s*users/i
]

// Extract percentage from text
function extractPercentageFromText(text: string): number | null {
  if (!text) return null
  
  for (const pattern of PERCENTAGE_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      // Find the numeric group
      for (let i = 1; i < match.length; i++) {
        if (match[i] && /^\d{1,3}$/.test(match[i])) {
          const percentage = parseInt(match[i], 10)
          if (percentage >= 0 && percentage <= 100) {
            return percentage
          }
        }
      }
    }
  }
  
  return null
}

// Test fetching a single movie
async function testFetchMovie(movie: typeof testMovies[0]) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`🎬 Testing: "${movie.title}" (${movie.year})`)
  console.log(`Type: ${movie.mediaType} | TMDB ID: ${movie.tmdbId}`)
  console.log('='.repeat(70))
  
  const queries = [
    `${movie.title} ${movie.year} movie`,
    `${movie.title} movie`,
    `${movie.title} movie google users liked`
  ]
  
  for (const searchQuery of queries) {
    logProgress(`\nTrying query: "${searchQuery}"`)
    
    try {
      const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64'),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          language_code: 'en',
          location_code: 2840, // United States
          keyword: searchQuery
        }])
      })
      
      if (!response.ok) {
        logProgress(`❌ API error: ${response.status}`)
        continue
      }
      
      const data = await response.json()
      
      if (data.status_code !== 20000 || !data.tasks?.[0]?.result?.[0]?.items) {
        logProgress('❌ No results returned')
        continue
      }
      
      const items = data.tasks[0].result[0].items || []
      logProgress(`✅ Found ${items.length} search results`)
      
      // First, look for knowledge graph
      const knowledgeGraph = items.find((item: any) => item.type === 'knowledge_graph')
      if (knowledgeGraph) {
        logProgress('\n📊 Found Knowledge Graph!')
        logProgress(`Title: ${knowledgeGraph.title || 'N/A'}`)
        logProgress(`Description: ${knowledgeGraph.description?.substring(0, 200) || 'N/A'}`)
        
        // Check if it has percentage
        const kgText = JSON.stringify(knowledgeGraph)
        if (kgText.includes('%')) {
          logProgress('Knowledge Graph contains % - checking for sentiment...')
          const percentage = extractPercentageFromText(kgText)
          if (percentage !== null) {
            logProgress(`✨ FOUND PERCENTAGE IN KNOWLEDGE GRAPH: ${percentage}%`)
            return percentage
          }
        }
      }
      
      // Check other results
      for (let i = 0; i < Math.min(items.length, 5); i++) {
        const resultItem = items[i]
        
        if (resultItem.type === 'knowledge_graph') continue // Already checked
        
        logProgress(`\n  Result ${i + 1}: ${resultItem.type}`)
        
        // For organic results, check all fields
        if (resultItem.type === 'organic') {
          logProgress(`  URL: ${resultItem.url}`)
          
          const fieldsToCheck = [
            { name: 'title', value: resultItem.title },
            { name: 'snippet', value: resultItem.snippet },
            { name: 'description', value: resultItem.description }
          ]
          
          for (const field of fieldsToCheck) {
            if (field.value?.includes('%')) {
              logProgress(`  📊 ${field.name} contains %: "${field.value.substring(0, 100)}..."`)
              
              const percentage = extractPercentageFromText(field.value)
              if (percentage !== null) {
                logProgress(`  ✨ FOUND PERCENTAGE: ${percentage}%`)
                return percentage
              }
            }
          }
        }
        
        // Check rating
        if (resultItem.rating) {
          logProgress(`  ⭐ Rating: ${JSON.stringify(resultItem.rating)}`)
        }
      }
      
      logProgress('\n❌ No percentage found in this query')
      
    } catch (error) {
      console.error('Error:', error)
    }
    
    // Small delay between queries
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  return null
}

// Main test function
async function runTest() {
  console.log('🧪 Testing Also-Liked Fetcher with Popular 2023 Movies')
  console.log('=====================================================\n')
  
  const results = []
  
  for (let i = 0; i < testMovies.length; i++) {
    const movie = testMovies[i]
    const percentage = await testFetchMovie(movie)
    
    results.push({
      title: movie.title,
      year: movie.year,
      percentage
    })
    
    // Wait 2 seconds between movies (rate limiting)
    if (i < testMovies.length - 1) {
      logProgress('\n⏳ Waiting 2 seconds...\n')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  // Summary
  console.log('\n\n📊 TEST RESULTS SUMMARY')
  console.log('======================')
  
  for (const result of results) {
    const status = result.percentage !== null ? '✅' : '❌'
    const percentStr = result.percentage !== null ? `${result.percentage}%` : 'Not found'
    console.log(`${status} ${result.title} (${result.year}): ${percentStr}`)
  }
  
  const successCount = results.filter(r => r.percentage !== null).length
  console.log(`\nSuccess rate: ${successCount}/${results.length}`)
  console.log(`\n💰 Estimated cost: $${(results.length * 0.003).toFixed(3)}`)
}

// Run the test
runTest().catch(console.error)