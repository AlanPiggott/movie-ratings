#!/usr/bin/env tsx

// Load environment variables from .env.local
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

import { readFileSync } from 'fs'
import { join } from 'path'

// DataForSEO credentials
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD

if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
  console.error('❌ Missing DataForSEO credentials')
  process.exit(1)
}

// Queue item interface
interface QueueItem {
  tmdbId: number
  title: string
  year: number | null
  mediaType: 'MOVIE' | 'TV_SHOW'
}

// Progress logging
function logProgress(message: string) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  console.log(`[${timestamp}] ${message}`)
}

// Load queue from file
function loadQueue(): QueueItem[] {
  const QUEUE_FILE = join(process.cwd(), 'data', 'also-liked-queue.json')
  
  try {
    const content = readFileSync(QUEUE_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('Error loading queue file:', error)
    return []
  }
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

// Test fetching a single item
async function testFetchItem(item: QueueItem) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`🎬 Testing: "${item.title}" (${item.year || 'N/A'})`)
  console.log(`Type: ${item.mediaType} | TMDB ID: ${item.tmdbId}`)
  console.log('='.repeat(70))
  
  const mediaTypeStr = item.mediaType === 'MOVIE' ? 'movie' : 'tv show'
  const queries = [
    `${item.title} ${mediaTypeStr}`,
    item.year ? `${item.title} ${item.year} ${mediaTypeStr}` : null,
    `${item.title} ${mediaTypeStr} google users liked`
  ].filter(Boolean)
  
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
      
      let foundPercentage = false
      
      // Check each result
      for (let i = 0; i < Math.min(items.length, 5); i++) {
        const resultItem = items[i]
        logProgress(`\n  Result ${i + 1}: ${resultItem.type}`)
        logProgress(`  URL: ${resultItem.url}`)
        
        // Check all text fields
        const fieldsToCheck = [
          { name: 'title', value: resultItem.title },
          { name: 'snippet', value: resultItem.snippet },
          { name: 'description', value: resultItem.description },
          { name: 'extended_snippet', value: resultItem.extended_snippet }
        ]
        
        for (const field of fieldsToCheck) {
          if (!field.value) continue
          
          // Check if field contains percentage
          if (field.value.includes('%')) {
            logProgress(`  📊 ${field.name} contains %: "${field.value.substring(0, 100)}..."`)
            
            const percentage = extractPercentageFromText(field.value)
            if (percentage !== null) {
              logProgress(`  ✨ FOUND PERCENTAGE: ${percentage}%`)
              foundPercentage = true
              return percentage
            }
          }
        }
        
        // Check rating if available
        if (resultItem.rating) {
          logProgress(`  ⭐ Rating found: ${JSON.stringify(resultItem.rating)}`)
          if (resultItem.rating.value && resultItem.rating.scale) {
            const rating = parseFloat(resultItem.rating.value)
            const scale = parseFloat(resultItem.rating.scale)
            const percentage = Math.round((rating / scale) * 100)
            logProgress(`  ✨ CONVERTED RATING: ${rating}/${scale} = ${percentage}%`)
            return percentage
          }
        }
      }
      
      if (!foundPercentage) {
        logProgress('\n❌ No percentage found in this query')
      }
      
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
  console.log('🧪 Testing Also-Liked Fetcher with 3 Items')
  console.log('==========================================\n')
  
  // Load queue
  const queue = loadQueue()
  
  if (queue.length === 0) {
    console.log('❌ Queue is empty!')
    return
  }
  
  console.log(`📁 Loaded queue with ${queue.length} items`)
  console.log('📋 Testing first 3 items...\n')
  
  // Test first 3 items
  const testItems = queue.slice(0, 3)
  const results = []
  
  for (let i = 0; i < testItems.length; i++) {
    const item = testItems[i]
    const percentage = await testFetchItem(item)
    
    results.push({
      title: item.title,
      year: item.year,
      percentage
    })
    
    // Wait 2 seconds between items (rate limiting)
    if (i < testItems.length - 1) {
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
    console.log(`${status} ${result.title} (${result.year || 'N/A'}): ${percentStr}`)
  }
  
  const successCount = results.filter(r => r.percentage !== null).length
  console.log(`\nSuccess rate: ${successCount}/${results.length}`)
  console.log(`\n💰 Estimated cost: $${(results.length * 0.003).toFixed(3)}`)
}

// Run the test
runTest().catch(console.error)