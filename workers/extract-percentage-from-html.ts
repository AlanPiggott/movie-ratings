#!/usr/bin/env tsx

// Load environment variables from .env.local
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
import { readFileSync, writeFileSync } from 'fs'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

// DataForSEO credentials
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD

if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
  console.error('❌ Missing DataForSEO credentials')
  process.exit(1)
}

async function extractPercentageFromHTML() {
  console.log('🧪 Testing percentage extraction from HTML\n')
  
  const searchQuery = "Oppenheimer 2023 movie"
  const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
  
  try {
    // Step 1: Create a task
    console.log('Creating task for:', searchQuery)
    
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
      console.error('Failed to create task')
      return
    }
    
    const taskId = taskData.tasks[0].id
    console.log(`Task ID: ${taskId}`)
    
    // Wait for task to complete
    console.log('Waiting 5 seconds...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Step 2: Get HTML
    const htmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    })
    
    const htmlData = await htmlResponse.json()
    
    if (htmlData.status_code !== 20000 || !htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html) {
      console.error('Failed to get HTML')
      return
    }
    
    const html = htmlData.tasks[0].result[0].items[0].html
    console.log(`\n✅ Got HTML (${html.length} characters)\n`)
    
    // Search for percentage patterns
    console.log('Searching for "% liked" patterns...\n')
    
    // First, let's see if "liked" appears anywhere
    const likedMatches = html.match(/[^>]*liked[^<]*/gi)
    if (likedMatches) {
      console.log('Found "liked" in these contexts:')
      likedMatches.slice(0, 10).forEach(match => {
        if (match.includes('%') || match.match(/\d+/)) {
          console.log(`  ✨ "${match.trim()}"`)
        }
      })
    }
    
    // Look for percentage patterns near "liked"
    const percentagePatterns = [
      // Common patterns
      /(\d{1,3})%\s*liked\s*this/gi,
      /(\d{1,3})%\s*of\s*(?:Google\s*)?users\s*liked/gi,
      /liked\s*by\s*(\d{1,3})%/gi,
      
      // Look for any percentage followed by "liked" within 50 chars
      /(\d{1,3})%[^<]{0,50}liked/gi,
      /liked[^<]{0,50}(\d{1,3})%/gi,
      
      // Google specific
      /google\s*users[^<]*(\d{1,3})%/gi,
      /(\d{1,3})%[^<]*google\s*users/gi
    ]
    
    let foundPercentage = false
    
    for (const pattern of percentagePatterns) {
      const matches = html.match(pattern)
      if (matches) {
        console.log(`\n✅ Pattern matched: ${pattern}`)
        matches.forEach(match => {
          console.log(`   "${match.replace(/\s+/g, ' ').trim()}"`)
          
          // Extract the actual percentage
          const percentMatch = match.match(/(\d{1,3})%/)
          if (percentMatch) {
            console.log(`   → Percentage: ${percentMatch[1]}%`)
            foundPercentage = true
          }
        })
      }
    }
    
    if (!foundPercentage) {
      console.log('\n❌ No percentage patterns found')
      
      // Save HTML for manual inspection
      const sampleFile = join(process.cwd(), 'data', `${searchQuery.replace(/\s+/g, '-')}-html.html`)
      writeFileSync(sampleFile, html)
      console.log(`\n💾 Saved full HTML to: ${sampleFile}`)
      console.log('You can open this file in a browser to see what Google returned')
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

extractPercentageFromHTML().catch(console.error)