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

async function getTaskId() {
  console.log('🔍 Making a test request to get Task ID for DataForSEO support...\n')
  
  const searchQuery = "Mission: Impossible - The Final Reckoning 2025 movie"
  console.log(`Search query: "${searchQuery}"`)
  console.log('Endpoint: /serp/google/organic/live/regular')
  console.log('Parameters: load_html: true\n')
  
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
        keyword: searchQuery,
        calculate_rectangles: false,
        load_html: true, // We want HTML but it's not being returned
        device: 'desktop',
        os: 'windows'
      }])
    })
    
    const data = await response.json()
    
    console.log('📋 RESPONSE DETAILS FOR SUPPORT:')
    console.log('================================')
    console.log(`API Status Code: ${data.status_code}`)
    console.log(`API Status Message: ${data.status_message}`)
    
    if (data.tasks && data.tasks[0]) {
      const task = data.tasks[0]
      console.log(`\n✅ TASK ID: ${task.id}`)
      console.log(`Task Status Code: ${task.status_code}`)
      console.log(`Task Status Message: ${task.status_message}`)
      console.log(`Cost: $${task.cost || 0}`)
      
      // Check if HTML was loaded
      console.log(`\n📄 HTML Status:`)
      console.log(`- task.data exists: ${!!task.data}`)
      console.log(`- task.data.html exists: ${!!task.data?.html}`)
      if (task.data?.html) {
        console.log(`- HTML length: ${task.data.html.length} characters`)
      } else {
        console.log(`- ❌ NO HTML RETURNED (this is the issue)`)
      }
      
      // Check what we did get
      if (task.result && task.result[0]) {
        const resultTypes = task.result[0].items?.map((item: any) => item.type) || []
        console.log(`\n📊 Result types found: ${[...new Set(resultTypes)].join(', ')}`)
        
        // Check if knowledge graph exists
        const kg = task.result[0].items?.find((item: any) => item.type === 'knowledge_graph')
        if (kg) {
          console.log('\n📦 Knowledge Graph found but it doesn\'t contain "% liked" data')
        }
      }
      
      console.log('\n💬 ISSUE TO REPORT:')
      console.log('We requested load_html: true but HTML is not being returned.')
      console.log('We need the HTML to extract Google\'s "% liked this movie" data.')
      console.log('This data appears in Google search but not in the structured API response.')
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

getTaskId().catch(console.error)