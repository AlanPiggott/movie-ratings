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

// Test movies
const testMovies = [
  { title: "Barbie", year: 2023 },
  { title: "Oppenheimer", year: 2023 },
  { title: "The Dark Knight", year: 2008 }
]

// Progress logging
function logProgress(message: string, indent: number = 0) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  const prefix = '  '.repeat(indent)
  console.log(`[${timestamp}] ${prefix}${message}`)
}

// Extract percentage from HTML
function extractPercentageFromHTML(html: string): { percentage: number | null, context: string | null } {
  // Clean up HTML for better pattern matching
  const cleanHtml = html.replace(/\s+/g, ' ').replace(/>\s+</g, '><')
  
  // Comprehensive patterns to find percentage
  const patterns = [
    // Direct "% liked" patterns
    /(\d{1,3})%\s*(?:of\s*)?(?:Google\s*)?(?:users\s*)?liked\s*this/gi,
    /(\d{1,3})%\s*liked/gi,
    /liked\s*by\s*(\d{1,3})%/gi,
    
    // Audience score patterns
    /audience\s*score[:\s]*(\d{1,3})%/gi,
    /(\d{1,3})%\s*audience/gi,
    
    // Look for percentage near "liked" (within 100 chars)
    /(\d{1,3})%[^<>]{0,100}liked/gi,
    /liked[^<>]{0,100}(\d{1,3})%/gi,
    
    // Google Knowledge Panel specific patterns
    /class="[^"]*kno[^"]*"[^>]*>[^<]*(\d{1,3})%[^<]*liked/gi,
    /data-attrid="[^"]*"[^>]*>[^<]*(\d{1,3})%[^<]*liked/gi
  ]
  
  for (const pattern of patterns) {
    const matches = cleanHtml.match(pattern)
    if (matches) {
      for (const match of matches) {
        const percentMatch = match.match(/(\d{1,3})%/)
        if (percentMatch) {
          const percentage = parseInt(percentMatch[1])
          if (percentage >= 0 && percentage <= 100) {
            // Get some context around the match
            const startIndex = Math.max(0, cleanHtml.indexOf(match) - 50)
            const endIndex = Math.min(cleanHtml.length, cleanHtml.indexOf(match) + match.length + 50)
            const context = cleanHtml.substring(startIndex, endIndex).replace(/<[^>]*>/g, ' ').trim()
            
            return { percentage, context }
          }
        }
      }
    }
  }
  
  return { percentage: null, context: null }
}

// Process a single movie
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
        keyword: searchQuery
      }])
    })
    
    const taskData = await taskResponse.json()
    
    if (taskData.status_code !== 20000 || !taskData.tasks?.[0]) {
      throw new Error('Failed to create task')
    }
    
    const taskId = taskData.tasks[0].id
    logProgress(`Task ID: ${taskId}`, 1)
    logProgress(`Cost: $${taskData.tasks[0].cost || 0}`, 1)
    
    // Step 2: Wait for task completion
    logProgress('Waiting 5 seconds for task to complete...', 1)
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Step 3: Get HTML
    logProgress('Fetching HTML results...', 1)
    
    const htmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    })
    
    const htmlData = await htmlResponse.json()
    
    if (htmlData.status_code !== 20000 || !htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html) {
      throw new Error('Failed to get HTML')
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
      
      // Save HTML for debugging
      const filename = `${movie.title.replace(/\s+/g, '-')}-${movie.year}.html`
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
  console.log('🧪 Testing HTML Extraction for 3 Movies')
  console.log('======================================\n')
  
  const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
  const results = []
  
  for (let i = 0; i < testMovies.length; i++) {
    const movie = testMovies[i]
    const result = await processMovie(movie, authHeader)
    results.push(result)
    
    // Wait between requests
    if (i < testMovies.length - 1) {
      logProgress('\n⏳ Waiting 2 seconds before next request...\n')
      await new Promise(resolve => setTimeout(resolve, 2000))
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
        console.log(`   Context: "${result.context.substring(0, 80)}..."`)
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
  
  if (successCount < results.length) {
    console.log('\n💡 HTML files saved for movies without percentages - you can inspect them manually')
  }
}

// Run the test
runTest().catch(console.error)