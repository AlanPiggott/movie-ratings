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

async function testSearch(query: string) {
  console.log(`\n🔍 Searching for: "${query}"`)
  console.log('=' + '='.repeat(60))
  
  try {
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        language_code: 'en',
        location_code: 2840, // United States
        keyword: query,
        calculate_rectangles: false,
        load_html: false, // Try without HTML first
        device: 'desktop',
        os: 'windows'
      }])
    })
    
    const data = await response.json()
    const task = data.tasks?.[0]
    
    if (!task || task.status_code !== 20000) {
      console.error('Task failed')
      return
    }
    
    console.log(`✅ Search successful (cost: $${task.cost})`)
    
    // Look through all items
    if (task.result?.[0]?.items) {
      let foundPercentage = false
      
      task.result[0].items.forEach((item: any, index: number) => {
        // Check if this item contains percentage data
        const hasPercentage = 
          item.title?.includes('%') || 
          item.snippet?.includes('%') ||
          item.description?.includes('%')
        
        if (hasPercentage || index < 3) {
          console.log(`\n📄 Result ${index + 1}:`)
          console.log(`  Type: ${item.type}`)
          console.log(`  URL: ${item.url}`)
          console.log(`  Title: ${item.title}`)
          console.log(`  Snippet: ${item.snippet?.substring(0, 150)}...`)
          
          if (hasPercentage) {
            foundPercentage = true
            console.log('  ⭐ Contains percentage!')
          }
        }
      })
      
      if (!foundPercentage) {
        console.log('\n❌ No percentage data found in any results')
      }
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Test various query formats
async function runTests() {
  console.log('🧪 Testing different query formats\n')
  
  const queries = [
    'The Dark Knight 2008 movie',
    'The Dark Knight movie',
    'The Dark Knight imdb',
    'The Dark Knight movie review',
    'how many people liked The Dark Knight movie',
    'The Dark Knight audience score',
    'The Dark Knight google users liked'
  ]
  
  for (const query of queries) {
    await testSearch(query)
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
}

runTests().catch(console.error)