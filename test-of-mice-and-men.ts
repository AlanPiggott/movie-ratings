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

// Auth header
const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')

// Test "Of Mice and Men"
async function testOfMiceAndMen() {
  console.log('Testing "Of Mice and Men" with different approaches...\n')
  
  // Try task-based approach
  console.log('=== TASK-BASED APPROACH ===')
  
  const queries = [
    'Of Mice and Men movie',
    'Of Mice and Men 1939 movie',
    'Of Mice and Men 1992 movie',
    'Of Mice and Men film'
  ]
  
  for (const query of queries) {
    console.log(`\nTrying query: "${query}"`)
    
    // Create task
    const taskResponse = await fetch('https://api.dataforseo.com/v3/serp/google/organic/task_post', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        language_code: 'en',
        location_code: 2840, // United States
        keyword: query,
        device: 'desktop',
        os: 'windows'
      }])
    })
    
    const taskData = await taskResponse.json()
    if (taskData.status_code !== 20000 || !taskData.tasks?.[0]) {
      console.log('Failed to create task')
      continue
    }
    
    const taskId = taskData.tasks[0].id
    console.log(`Task ID: ${taskId}`)
    
    // Wait 8 seconds (proven delay)
    console.log('Waiting 8 seconds...')
    await new Promise(resolve => setTimeout(resolve, 8000))
    
    // Get HTML
    const htmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
      method: 'GET',
      headers: { 'Authorization': authHeader }
    })
    
    const htmlData = await htmlResponse.json()
    const html = htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html || ''
    
    console.log(`HTML length: ${html.length}`)
    
    // Extract percentage
    const patterns = [
      /(\d{1,3})%\s*liked\s*this\s*(movie|film|show|series)/gi,
      /(\d{1,3})%\s*of\s*(?:Google\s*)?users\s*liked/gi,
      />(\d{1,3})%\s*liked\s*this/gi,
      /class="[^"]*srBp4[^"]*"[^>]*>\s*(\d{1,3})%/gi,
    ]
    
    let found = false
    for (const pattern of patterns) {
      const matches = html.match(pattern)
      if (matches) {
        console.log(`Found match: "${matches[0]}"`)
        const percentMatch = matches[0].match(/(\d{1,3})/)
        if (percentMatch) {
          console.log(`✅ Percentage: ${percentMatch[1]}%`)
          found = true
          break
        }
      }
    }
    
    if (!found) {
      console.log('❌ No percentage found')
      // Save HTML for inspection
      const fs = await import('fs')
      fs.writeFileSync(`of-mice-and-men-${Date.now()}.html`, html)
      console.log('Saved HTML for inspection')
    }
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
}

testOfMiceAndMen().catch(console.error)