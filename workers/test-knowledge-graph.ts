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

// Test movie
const testMovie = {
  title: "Mission: Impossible - The Final Reckoning",
  year: 2025,
  mediaType: 'MOVIE' as const
}

// Progress logging
function logProgress(message: string) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  console.log(`[${timestamp}] ${message}`)
}

// Test fetching with detailed knowledge graph inspection
async function testFetchWithDebug() {
  console.log('🧪 Testing Knowledge Graph Data Extraction')
  console.log('=========================================\n')
  
  const searchQuery = `${testMovie.title} ${testMovie.year} movie`
  logProgress(`Testing query: "${searchQuery}"`)
  
  try {
    // Try with regular endpoint first to get HTML
    logProgress('\n1️⃣ Trying /serp/google/organic/live/regular (with HTML)...')
    
    const regularResponse = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        language_code: 'en',
        location_code: 2840, // United States
        keyword: searchQuery,
        calculate_rectangles: false,
        load_html: true,
        device: 'desktop',
        os: 'windows'
      }])
    })
    
    const regularData = await regularResponse.json()
    const regularTask = regularData.tasks?.[0]
    
    if (regularTask?.status_code === 20000) {
      logProgress('✅ Regular API successful')
      
      // Check if HTML was loaded
      if (regularTask.data?.html) {
        logProgress(`📄 HTML loaded: ${regularTask.data.html.length} characters`)
        
        // Search for percentage patterns in HTML
        const htmlSnippet = regularTask.data.html
        const percentageMatches = htmlSnippet.match(/\d{1,3}%[^>]*(?:liked|audience|users)/gi)
        if (percentageMatches) {
          logProgress('🎯 Found percentage patterns in HTML:')
          percentageMatches.slice(0, 5).forEach(match => {
            logProgress(`   "${match}"`)
          })
        }
      } else {
        logProgress('❌ No HTML in response')
      }
      
      // Check result types
      if (regularTask.result?.[0]?.items) {
        const types = regularTask.result[0].items.map((item: any) => item.type)
        logProgress(`📊 Result types: ${[...new Set(types)].join(', ')}`)
      }
    }
    
    // Wait before next request
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Try with advanced endpoint for structured data
    logProgress('\n2️⃣ Trying /serp/google/organic/live/advanced (structured data)...')
    
    const advancedResponse = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/advanced', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        language_code: 'en',
        location_code: 2840,
        keyword: searchQuery
      }])
    })
    
    const advancedData = await advancedResponse.json()
    const advancedTask = advancedData.tasks?.[0]
    
    if (advancedTask?.status_code === 20000 && advancedTask.result?.[0]?.items) {
      logProgress('✅ Advanced API successful')
      
      // Find knowledge graph
      const knowledgeGraph = advancedTask.result[0].items.find((item: any) => item.type === 'knowledge_graph')
      
      if (knowledgeGraph) {
        logProgress('\n📊 KNOWLEDGE GRAPH FOUND!')
        logProgress('Full structure:')
        console.log(JSON.stringify(knowledgeGraph, null, 2))
        
        // Check all fields for percentage
        const kgString = JSON.stringify(knowledgeGraph)
        const percentagePattern = /(\d{1,3})%/g
        const percentages = kgString.match(percentagePattern)
        
        if (percentages) {
          logProgress(`\n🎯 Percentages found in knowledge graph: ${percentages.join(', ')}`)
        }
      } else {
        logProgress('❌ No knowledge graph in results')
      }
      
      // Also check for featured snippets or other rich results
      const richResults = advancedTask.result[0].items.filter((item: any) => 
        ['featured_snippet', 'answer_box', 'knowledge_graph'].includes(item.type)
      )
      
      if (richResults.length > 0) {
        logProgress(`\n📦 Found ${richResults.length} rich results:`)
        richResults.forEach((item: any, index: number) => {
          logProgress(`\nRich Result ${index + 1}: ${item.type}`)
          if (item.description) logProgress(`Description: ${item.description.substring(0, 200)}...`)
          if (item.title) logProgress(`Title: ${item.title}`)
          
          // Check for any percentage data
          const itemString = JSON.stringify(item)
          if (itemString.includes('%')) {
            logProgress('⚠️  Contains % symbol - might have sentiment data')
          }
        })
      }
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the test
testFetchWithDebug().catch(console.error)