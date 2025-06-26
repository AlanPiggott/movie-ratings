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

async function testHtmlEndpoint() {
  console.log('🧪 Testing HTML endpoint as suggested by DataForSEO support\n')
  
  const searchQuery = "The Dark Knight 2008 movie"
  const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
  
  try {
    // Step 1: Create a task
    console.log('STEP 1: Creating task with /serp/google/organic/task_post/')
    console.log('=========================================================')
    
    const taskResponse = await fetch('https://api.dataforseo.com/v3/serp/google/organic/task_post', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        language_code: 'en',
        location_code: 2840, // United States
        keyword: searchQuery
      }])
    })
    
    const taskData = await taskResponse.json()
    
    if (taskData.status_code !== 20000 || !taskData.tasks?.[0]) {
      console.error('❌ Failed to create task:', taskData)
      return
    }
    
    const taskId = taskData.tasks[0].id
    console.log(`✅ Task created successfully`)
    console.log(`📋 Task ID: ${taskId}`)
    console.log(`💰 Cost: $${taskData.tasks[0].cost || 0}`)
    
    // Step 2: Wait a bit for task to complete
    console.log('\n⏳ Waiting 5 seconds for task to complete...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Step 3: Get HTML using the specific HTML endpoint
    console.log('\nSTEP 2: Getting HTML with /serp/google/organic/task_get/html/')
    console.log('=============================================================')
    
    const htmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    })
    
    const htmlData = await htmlResponse.json()
    
    if (htmlData.status_code !== 20000 || !htmlData.tasks?.[0]) {
      console.error('❌ Failed to get HTML:', htmlData)
      return
    }
    
    const task = htmlData.tasks[0]
    console.log(`✅ HTML endpoint response received`)
    console.log(`📋 Task ID: ${task.id}`)
    console.log(`📊 Task Status: ${task.status_code} - ${task.status_message}`)
    
    // Check if we got HTML
    if (task.result?.[0]?.html) {
      const html = task.result[0].html
      console.log(`\n✅ HTML FOUND! Length: ${html.length} characters`)
      
      // Search for % liked patterns
      console.log('\n🔎 Searching for "% liked" patterns in HTML...')
      
      const patterns = [
        /(\d+)%\s*liked\s*this\s*(movie|film)/gi,
        /(\d+)%\s*of\s*(?:Google\s*)?users\s*liked/gi,
        /audience\s*score.*?(\d+)%/gi,
        /(\d+)%[^>]*liked/gi
      ]
      
      let foundAny = false
      
      for (const pattern of patterns) {
        const matches = html.match(pattern)
        if (matches) {
          console.log(`\n✅ Found matches for pattern: ${pattern}`)
          matches.slice(0, 5).forEach(match => {
            console.log(`   "${match.trim()}"`)
          })
          foundAny = true
        }
      }
      
      if (!foundAny) {
        console.log('\n❌ No "% liked" patterns found in HTML')
        
        // Let's check if "liked" appears at all
        if (html.includes('liked')) {
          console.log('\n💡 The word "liked" does appear in the HTML')
          // Find context around "liked"
          const likedIndex = html.indexOf('liked')
          const context = html.substring(Math.max(0, likedIndex - 100), Math.min(html.length, likedIndex + 100))
          console.log('Context:', context.replace(/\s+/g, ' ').trim())
        }
      }
      
      // Save a sample of HTML for debugging
      const sampleFile = join(process.cwd(), 'data', 'sample-html.txt')
      require('fs').writeFileSync(sampleFile, html.substring(0, 50000))
      console.log(`\n💾 Saved HTML sample to: ${sampleFile}`)
      
    } else {
      console.log('\n❌ NO HTML in the response!')
      console.log('Response structure:', JSON.stringify(task, null, 2))
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

testHtmlEndpoint().catch(console.error)