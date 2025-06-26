#!/usr/bin/env tsx

// Load environment variables from .env.local
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
import { writeFileSync } from 'fs'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

// DataForSEO credentials
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD

if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
  console.error('❌ Missing DataForSEO credentials')
  process.exit(1)
}

// Test movies - let's use ones from the queue
const testMovies = [
  { title: "The Accountant²", year: 2025 },
  { title: "Barbie", year: 2023 },
  { title: "Spider-Man: Across the Spider-Verse", year: 2023 }
]

// Progress logging
function logProgress(message: string, indent: number = 0) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  const prefix = '  '.repeat(indent)
  console.log(`[${timestamp}] ${prefix}${message}`)
}

// Extract percentage from HTML - improved version
function extractPercentageFromHTML(html: string): { percentage: number | null, context: string | null } {
  // Look for the specific pattern we found
  const knowledgePanelPattern = /<div[^>]*class="[^"]*srBp4[^"]*"[^>]*>\s*(\d{1,3})%\s*liked\s*this\s*(movie|film|show)/gi
  
  // Also try other common patterns
  const patterns = [
    knowledgePanelPattern,
    // Direct patterns
    /(\d{1,3})%\s*liked\s*this\s*(movie|film|show|series)/gi,
    /(\d{1,3})%\s*of\s*(?:Google\s*)?users\s*liked/gi,
    // Look in any element
    />([^<]*(\d{1,3})%[^<]*liked[^<]*)</gi,
    />([^<]*liked[^<]*(\d{1,3})%[^<]*)</gi
  ]
  
  for (const pattern of patterns) {
    const matches = html.match(pattern)
    if (matches) {
      for (const match of matches) {
        const percentMatch = match.match(/(\d{1,3})%/)
        if (percentMatch) {
          const percentage = parseInt(percentMatch[1])
          if (percentage >= 0 && percentage <= 100) {
            // Clean up the context
            const context = match.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
            return { percentage, context }
          }
        }
      }
    }
  }
  
  return { percentage: null, context: null }
}

// Check task status
async function checkTaskStatus(taskId: string, authHeader: string): Promise<string> {
  const response = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/tasks_ready`, {
    method: 'GET',
    headers: {
      'Authorization': authHeader
    }
  })
  
  const data = await response.json()
  if (data.tasks) {
    for (const task of data.tasks) {
      if (task.id === taskId) {
        return task.status_message || 'unknown'
      }
    }
  }
  return 'not found'
}

// Process a single movie with retries
async function processMovie(movie: typeof testMovies[0], authHeader: string) {
  const searchQuery = `${movie.title} ${movie.year} movie`
  
  logProgress(`\n${'='.repeat(60)}`)
  logProgress(`🎬 Processing: "${searchQuery}"`)
  logProgress('='.repeat(60))
  
  try {
    // Step 1: Create task
    logProgress('Creating search task...', 1)
    
    const taskResponse = await fetch('https://api.dataforseo.com/v3/serp/google/organic/task_post', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        language_code: 'en',
        location_code: 2840, // United States
        keyword: searchQuery,
        device: 'desktop',
        os: 'windows'
      }])
    })
    
    const taskData = await taskResponse.json()
    
    if (taskData.status_code !== 20000 || !taskData.tasks?.[0]) {
      throw new Error('Failed to create task')
    }
    
    const taskId = taskData.tasks[0].id
    logProgress(`Task ID: ${taskId}`, 1)
    logProgress(`Cost: $${taskData.tasks[0].cost || 0}`, 1)
    
    // Step 2: Wait longer and check status
    logProgress('Waiting 10 seconds for task to complete...', 1)
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    // Check task status
    const status = await checkTaskStatus(taskId, authHeader)
    logProgress(`Task status: ${status}`, 1)
    
    // Step 3: Get HTML with retry
    logProgress('Fetching HTML results...', 1)
    
    let htmlData = null
    let retries = 3
    
    while (retries > 0 && !htmlData) {
      const htmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader
        }
      })
      
      const data = await htmlResponse.json()
      
      if (data.status_code === 20000 && data.tasks?.[0]?.result?.[0]?.items?.[0]?.html) {
        htmlData = data
        break
      }
      
      retries--
      if (retries > 0) {
        logProgress(`Retry ${3 - retries}/3 - waiting 5 seconds...`, 1)
        await new Promise(resolve => setTimeout(resolve, 5000))
      }
    }
    
    if (!htmlData || !htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html) {
      throw new Error('Failed to get HTML after retries')
    }
    
    const html = htmlData.tasks[0].result[0].items[0].html
    logProgress(`✅ Got HTML (${html.length.toLocaleString()} characters)`, 1)
    
    // Step 4: Extract percentage
    logProgress('Extracting percentage...', 1)
    const result = extractPercentageFromHTML(html)
    
    if (result.percentage !== null) {
      logProgress(`✨ FOUND: ${result.percentage}% liked`, 1)
      logProgress(`Context: "${result.context}"`, 1)
    } else {
      logProgress('❌ No percentage found', 1)
      
      // Look for any occurrence of "liked" in the HTML
      const likedCount = (html.match(/liked/gi) || []).length
      logProgress(`Found "${likedCount}" occurrences of "liked" in HTML`, 1)
      
      // Save HTML for debugging
      const filename = `${movie.title.replace(/[^\w\s]/g, '').replace(/\s+/g, '-')}-${movie.year}.html`
      const filepath = pathJoin(process.cwd(), 'data', filename)
      writeFileSync(filepath, html)
      logProgress(`💾 Saved HTML to: data/${filename}`, 1)
    }
    
    return {
      movie: `${movie.title} (${movie.year})`,
      percentage: result.percentage,
      context: result.context,
      taskId
    }
    
  } catch (error) {
    logProgress(`❌ Error: ${error}`, 1)
    return {
      movie: `${movie.title} (${movie.year})`,
      percentage: null,
      context: null,
      error: String(error)
    }
  }
}

// Main test function
async function runTest() {
  console.log('🧪 Testing HTML Extraction (Improved)')
  console.log('====================================\n')
  
  const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
  const results = []
  
  for (let i = 0; i < testMovies.length; i++) {
    const movie = testMovies[i]
    const result = await processMovie(movie, authHeader)
    results.push(result)
    
    // Wait between requests
    if (i < testMovies.length - 1) {
      logProgress('\n⏳ Waiting 3 seconds before next request...\n')
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  }
  
  // Summary
  console.log('\n\n' + '='.repeat(60))
  console.log('📊 RESULTS SUMMARY')
  console.log('='.repeat(60))
  
  let successCount = 0
  for (const result of results) {
    if (result.percentage !== null) {
      console.log(`✅ ${result.movie}: ${result.percentage}% liked`)
      if (result.context) {
        console.log(`   Context: "${result.context}"`)
      }
      successCount++
    } else {
      console.log(`❌ ${result.movie}: Not found`)
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
    }
  }
  
  console.log(`\nSuccess rate: ${successCount}/${results.length}`)
  console.log(`\n💰 Total cost: ~$${(results.length * 0.0006).toFixed(4)}`)
  
  if (successCount > 0) {
    console.log('\n✨ The HTML endpoint works! We can extract Google\'s "% liked" data')
    console.log('   Pattern found: <div class="srBp4 Vrkhme"> XX% liked this movie')
  }
}

// Run the test
runTest().catch(console.error)