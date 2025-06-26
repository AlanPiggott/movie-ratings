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

// Test queries to find 83%
async function findEightyThreePercent() {
  console.log('Searching for the query that returns 83% for Of Mice and Men...\n')
  
  const testQueries = [
    // Simple queries
    'Of Mice and Men',
    'Of Mice and Men movie',
    'Of Mice and Men film',
    
    // With quotes
    '"Of Mice and Men"',
    '"Of Mice and Men" movie',
    '"Of Mice and Men" film',
    
    // Different formats
    'Of Mice and Men (movie)',
    'Of Mice and Men movie review',
    'Of Mice and Men imdb',
    'Of Mice and Men google',
    'Of Mice and Men audience score',
    
    // Without year specificity
    'Of Mice and Men John Steinbeck movie',
    'Of Mice and Men classic movie',
    
    // Try the exact format from the API
    'Of Mice and Men tv show', // Just to test
  ]
  
  for (const query of testQueries) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Testing query: "${query}"`)
    
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
          location_code: 2840, // United States
          keyword: query,
          device: 'desktop',
          os: 'windows'
        }])
      })
      
      const taskData = await taskResponse.json()
      if (taskData.status_code !== 20000 || !taskData.tasks?.[0]) {
        console.log('❌ Failed to create task')
        continue
      }
      
      const taskId = taskData.tasks[0].id
      console.log(`Task ID: ${taskId}`)
      
      // Wait 8 seconds
      console.log('Waiting 8 seconds...')
      await new Promise(resolve => setTimeout(resolve, 8000))
      
      // Get HTML
      const htmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
        method: 'GET',
        headers: { 'Authorization': authHeader }
      })
      
      const htmlData = await htmlResponse.json()
      const html = htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html || ''
      
      console.log(`HTML length: ${html.length.toLocaleString()} bytes`)
      
      if (html.length === 0) {
        console.log('❌ Empty HTML response')
        continue
      }
      
      // Extract ALL percentages found
      const allPercentages: Array<{value: number, context: string}> = []
      
      // Try multiple patterns
      const patterns = [
        /(\d{1,3})%\s*liked\s*this\s*(movie|film|show|series)/gi,
        /(\d{1,3})%\s*of\s*(?:Google\s*)?users\s*liked/gi,
        />(\d{1,3})%\s*liked\s*this/gi,
        /class="[^"]*srBp4[^"]*"[^>]*>\s*(\d{1,3})%/gi,
        /(\d{1,3})%\s*liked/gi,
      ]
      
      for (const pattern of patterns) {
        const matches = [...html.matchAll(pattern)]
        for (const match of matches) {
          const percentMatch = match[0].match(/(\d{1,3})/)
          if (percentMatch) {
            const percentage = parseInt(percentMatch[1])
            if (percentage >= 0 && percentage <= 100) {
              const context = match[0].substring(0, 100).replace(/\s+/g, ' ').trim()
              allPercentages.push({ value: percentage, context })
            }
          }
        }
      }
      
      // Remove duplicates
      const uniquePercentages = Array.from(new Set(allPercentages.map(p => p.value)))
      
      if (uniquePercentages.length > 0) {
        console.log(`Found percentages: ${uniquePercentages.join(', ')}`)
        
        if (uniquePercentages.includes(83)) {
          console.log(`✅ FOUND 83%! Query: "${query}"`)
          
          // Show contexts where 83% appears
          const contexts83 = allPercentages.filter(p => p.value === 83)
          contexts83.forEach((ctx, i) => {
            console.log(`   Context ${i + 1}: "${ctx.context}"`)
          })
          
          // Save this HTML for analysis
          const fs = await import('fs')
          fs.writeFileSync(`of-mice-83-percent-${Date.now()}.html`, html)
          console.log('   Saved HTML for further analysis')
        }
      } else {
        console.log('❌ No percentages found')
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error}`)
    }
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  console.log('\n\nSearch complete!')
}

findEightyThreePercent().catch(console.error)