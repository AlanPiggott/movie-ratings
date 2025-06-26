#!/usr/bin/env tsx

// Load environment variables from .env.local
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

// DataForSEO credentials
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD

if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
  console.error('❌ Missing DataForSEO credentials')
  process.exit(1)
}

// Test a few movies that failed
const testMovies = [
  { title: "Good Will Hunting", year: 1997 },
  { title: "The Matrix", year: 1999 },
  { title: "Inception", year: 2010 }
]

// Diagnostic test
async function runDiagnostic() {
  console.log('🔍 Diagnostic Test - Checking API Response Structure')
  console.log('==================================================\n')
  
  const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
  
  for (const movie of testMovies) {
    const query = `${movie.title} ${movie.year} movie`
    console.log(`\nTesting: ${query}`)
    console.log('-'.repeat(50))
    
    try {
      // Create task
      console.log('1. Creating task...')
      const taskResponse = await fetch('https://api.dataforseo.com/v3/serp/google/organic/task_post', {
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
      
      const taskData = await taskResponse.json()
      console.log('   Task response status:', taskData.status_code)
      console.log('   Task ID:', taskData.tasks?.[0]?.id)
      
      if (!taskData.tasks?.[0]?.id) {
        console.log('   ❌ No task ID returned')
        continue
      }
      
      const taskId = taskData.tasks[0].id
      
      // Wait
      console.log('2. Waiting 10 seconds...')
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      // Get HTML
      console.log('3. Fetching HTML...')
      const htmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
        method: 'GET',
        headers: { 'Authorization': authHeader }
      })
      
      const htmlData = await htmlResponse.json()
      console.log('   HTML response status:', htmlData.status_code)
      console.log('   Has tasks?:', !!htmlData.tasks)
      console.log('   Has result?:', !!htmlData.tasks?.[0]?.result)
      console.log('   Has items?:', !!htmlData.tasks?.[0]?.result?.[0]?.items)
      console.log('   Has HTML?:', !!htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html)
      
      if (htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html) {
        const html = htmlData.tasks[0].result[0].items[0].html
        console.log('   HTML length:', html.length)
        
        // Look for percentage
        const percentageMatch = html.match(/(\d{1,3})%\s*liked\s*this\s*(movie|film)/i)
        if (percentageMatch) {
          console.log('   ✅ Found percentage:', percentageMatch[1] + '%')
        } else {
          console.log('   ❌ No percentage found')
          
          // Save HTML for inspection
          const dataDir = pathJoin(process.cwd(), 'data', 'diagnostic')
          if (!existsSync(dataDir)) {
            mkdirSync(dataDir, { recursive: true })
          }
          
          const filename = `${movie.title.replace(/[^\w]/g, '-')}-${movie.year}.html`
          writeFileSync(pathJoin(dataDir, filename), html)
          console.log('   💾 Saved HTML to:', pathJoin('data', 'diagnostic', filename))
        }
      } else {
        console.log('   ❌ No HTML in response')
        console.log('   Full response structure:', JSON.stringify(htmlData, null, 2).substring(0, 500) + '...')
      }
      
    } catch (error) {
      console.log('   ❌ Error:', error)
    }
  }
  
  console.log('\n\n💡 Check the saved HTML files in data/diagnostic/ to see what Google returned')
}

// Run diagnostic
runDiagnostic().catch(console.error)