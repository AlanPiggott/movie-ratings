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

// Test different query strategies for "The Dark Knight"
const queryStrategies = [
  { 
    name: "Basic movie search",
    query: "The Dark Knight movie"
  },
  {
    name: "With year",
    query: "The Dark Knight 2008 movie"
  },
  {
    name: "With 'film' instead of 'movie'",
    query: "The Dark Knight 2008 film"
  },
  {
    name: "Just title and year",
    query: "The Dark Knight 2008"
  },
  {
    name: "With 'google rating'",
    query: "The Dark Knight movie google rating"
  },
  {
    name: "With 'reviews'",
    query: "The Dark Knight movie reviews"
  },
  {
    name: "IMDB style",
    query: "The Dark Knight imdb"
  },
  {
    name: "Knowledge panel trigger",
    query: "The Dark Knight cast runtime"
  }
]

async function testQuery(strategy: typeof queryStrategies[0], authHeader: string) {
  console.log(`\nTesting: "${strategy.query}"`)
  console.log(`Strategy: ${strategy.name}`)
  
  try {
    // Create task
    const taskResponse = await fetch('https://api.dataforseo.com/v3/serp/google/organic/task_post', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        language_code: 'en',
        location_code: 2840,
        keyword: strategy.query,
        device: 'desktop',
        os: 'windows'
      }])
    })
    
    const taskData = await taskResponse.json()
    if (taskData.status_code !== 20000 || !taskData.tasks?.[0]) {
      throw new Error('Failed to create task')
    }
    
    const taskId = taskData.tasks[0].id
    console.log(`Task ID: ${taskId}`)
    
    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 8000))
    
    // Get HTML
    const htmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
      method: 'GET',
      headers: { 'Authorization': authHeader }
    })
    
    const htmlData = await htmlResponse.json()
    if (!htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html) {
      throw new Error('No HTML returned')
    }
    
    const html = htmlData.tasks[0].result[0].items[0].html
    
    // Check for percentage
    const percentageMatch = html.match(/(\d{1,3})%\s*liked\s*this\s*(movie|film)/i)
    if (percentageMatch) {
      console.log(`✅ FOUND: ${percentageMatch[1]}% liked`)
      return { query: strategy.query, percentage: percentageMatch[1] }
    } else {
      // Check if knowledge panel exists
      const hasKnowledgePanel = html.includes('kno-result') || html.includes('knowledge-panel')
      console.log(`❌ No percentage found ${hasKnowledgePanel ? '(Knowledge Panel present)' : '(No Knowledge Panel)'})`)
      return { query: strategy.query, percentage: null, hasKnowledgePanel }
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error}`)
    return { query: strategy.query, percentage: null, error: true }
  }
}

async function runTest() {
  console.log('🧪 Testing Different Query Strategies')
  console.log('====================================')
  
  const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
  const results = []
  
  for (const strategy of queryStrategies) {
    const result = await testQuery(strategy, authHeader)
    results.push(result)
    await new Promise(resolve => setTimeout(resolve, 3000))
  }
  
  console.log('\n\n📊 SUMMARY')
  console.log('==========')
  const successful = results.filter(r => r.percentage)
  console.log(`Success rate: ${successful.length}/${results.length}`)
  console.log('\nSuccessful queries:')
  successful.forEach(r => console.log(`  ✅ "${r.query}" → ${r.percentage}%`))
}

runTest().catch(console.error)