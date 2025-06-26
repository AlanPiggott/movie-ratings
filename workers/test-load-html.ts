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

async function testLoadHtml() {
  console.log('🧪 Testing load_html parameter as suggested by support\n')
  
  const searchQuery = "The Dark Knight 2008 movie"
  
  console.log('REQUEST DETAILS:')
  console.log('===============')
  console.log(`Endpoint: https://api.dataforseo.com/v3/serp/google/organic/live/regular`)
  console.log(`Search query: "${searchQuery}"`)
  console.log(`Parameters:`)
  console.log(JSON.stringify({
    language_code: 'en',
    location_code: 2840,
    keyword: searchQuery,
    calculate_rectangles: false,
    load_html: true,  // <-- THIS IS SET TO TRUE
    device: 'desktop',
    os: 'windows'
  }, null, 2))
  
  try {
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        language_code: 'en',
        location_code: 2840,
        keyword: searchQuery,
        calculate_rectangles: false,
        load_html: true,  // <-- WE ARE SETTING THIS TO TRUE
        device: 'desktop',
        os: 'windows'
      }])
    })
    
    const data = await response.json()
    
    console.log('\nRESPONSE ANALYSIS:')
    console.log('==================')
    
    if (data.tasks && data.tasks[0]) {
      const task = data.tasks[0]
      
      console.log(`✅ Task ID: ${task.id}`)
      console.log(`Task Status: ${task.status_code} - ${task.status_message}`)
      
      // This is where the HTML should be
      console.log('\n🔍 CHECKING FOR HTML:')
      console.log(`- task.data exists: ${!!task.data}`)
      console.log(`- task.data.html exists: ${!!task.data?.html}`)
      
      if (task.data?.html) {
        console.log(`✅ HTML FOUND! Length: ${task.data.html.length} characters`)
        
        // Search for % liked pattern
        const htmlSnippet = task.data.html
        const patterns = [
          /(\d+)%\s*liked\s*this/gi,
          /(\d+)%\s*of\s*(?:Google\s*)?users/gi,
          /audience\s*score.*?(\d+)%/gi
        ]
        
        console.log('\n🔎 Searching HTML for "% liked" patterns...')
        let foundAny = false
        
        for (const pattern of patterns) {
          const matches = htmlSnippet.match(pattern)
          if (matches) {
            console.log(`✅ Found matches for pattern ${pattern}:`)
            matches.forEach(match => console.log(`   "${match}"`))
            foundAny = true
          }
        }
        
        if (!foundAny) {
          console.log('❌ No "% liked" patterns found in HTML')
        }
        
      } else {
        console.log('❌ NO HTML RETURNED!')
        console.log('\n⚠️  PROBLEM: We set load_html: true but no HTML was returned')
        console.log('This is why we cannot extract the "% liked" metric')
      }
      
      // Also check if result exists
      if (task.result) {
        console.log(`\n📊 Result data exists: YES`)
        console.log(`Number of result sets: ${task.result.length}`)
        if (task.result[0]?.items) {
          console.log(`Number of items: ${task.result[0].items.length}`)
          const types = task.result[0].items.map((item: any) => item.type)
          console.log(`Item types: ${[...new Set(types)].join(', ')}`)
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

testLoadHtml().catch(console.error)