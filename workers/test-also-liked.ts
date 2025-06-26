#!/usr/bin/env tsx

// Load environment variables from .env.local
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

// Test items - known movies that should have Google sentiment data
const testItems = [
  {
    tmdbId: 155, // The Dark Knight
    title: "The Dark Knight",
    year: 2008,
    mediaType: 'MOVIE' as const
  },
  {
    tmdbId: 680, // Pulp Fiction
    title: "Pulp Fiction",
    year: 1994,
    mediaType: 'MOVIE' as const
  },
  {
    tmdbId: 278, // The Shawshank Redemption
    title: "The Shawshank Redemption",
    year: 1994,
    mediaType: 'MOVIE' as const
  }
]

// DataForSEO credentials
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD

if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
  console.error('❌ Missing DataForSEO credentials')
  process.exit(1)
}

// Progress logging
function logProgress(message: string) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0]
  console.log(`[${timestamp}] ${message}`)
}

// Test fetching percentage for a single item
async function testFetchPercentage(item: typeof testItems[0]) {
  try {
    logProgress(`\n🎬 Testing: "${item.title}" (${item.year})`)
    logProgress('=' + '='.repeat(50))
    
    // Build search query
    const searchQuery = `${item.title} ${item.year} movie`
    logProgress(`Search query: "${searchQuery}"`)
    
    // Call DataForSEO API
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
        load_html: true,
        device: 'desktop',
        os: 'windows'
      }])
    })
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    
    const data = await response.json()
    const task = data.tasks?.[0]
    
    if (!task || task.status_code !== 20000) {
      throw new Error('Task failed')
    }
    
    logProgress(`✅ API call successful (cost: $${task.cost || 0.0006})`)
    
    // Debug: Show task structure
    logProgress(`Task has data field: ${!!task.data}`)
    logProgress(`Task has result field: ${!!task.result}`)
    if (task.data) {
      logProgress(`Task.data has html: ${!!task.data.html}`)
      if (task.data.html) {
        logProgress(`HTML length: ${task.data.html.length} chars`)
      }
    }
    
    // Debug: Show all result types found
    if (task.result?.[0]?.items) {
      const types = new Set(task.result[0].items.map((item: any) => item.type))
      logProgress(`Result types found: ${Array.from(types).join(', ')}`)
      
      // Look for any item with percentage in title or snippet
      for (const item of task.result[0].items.slice(0, 3)) {
        if (item.title?.includes('%') || item.snippet?.includes('%')) {
          logProgress(`Found % in item: ${item.type}`)
          logProgress(`  Title: ${item.title?.substring(0, 100)}`)
          logProgress(`  Snippet: ${item.snippet?.substring(0, 100)}`)
        }
      }
    }
    
    // Look for knowledge panel
    let foundKnowledgePanel = false
    let percentageFound = null
    
    if (task.result?.[0]?.items) {
      for (const item of task.result[0].items) {
        if (item.type === 'knowledge_graph' || 
            item.type === 'featured_snippet' || 
            item.type === 'answer_box') {
          foundKnowledgePanel = true
          logProgress(`Found ${item.type}`)
          
          // Check for percentage in various fields
          const fieldsToCheck = [
            item.title,
            item.snippet,
            item.description,
            item.extended_snippet
          ]
          
          for (const field of fieldsToCheck) {
            if (field && field.includes('%')) {
              logProgress(`Field with %: ${field.substring(0, 100)}...`)
              
              // Try to extract percentage
              const patterns = [
                /(\d+)%\s*liked/i,
                /(\d+)%\s*of\s*(?:people|users)/i,
                /audience.*?(\d+)%/i
              ]
              
              for (const pattern of patterns) {
                const match = field.match(pattern)
                if (match) {
                  percentageFound = parseInt(match[1])
                  logProgress(`✨ Found percentage: ${percentageFound}%`)
                  break
                }
              }
              if (percentageFound) break
            }
          }
        }
      }
    }
    
    // Check full HTML if available
    if (!percentageFound) {
      // Check where HTML is stored
      if (task.data?.html) {
        logProgress('Found HTML in task.data.html')
        const html = task.data.html
        
        // Check if it contains knowledge panel indicators
        if (html.includes('% liked') || html.includes('audience score')) {
          logProgress('HTML contains percentage indicators!')
          
          // Simple pattern matching on HTML
          const patterns = [
            /(\d+)%\s*liked\s*this/i,
            /(\d+)%\s*of\s*(?:Google\s*)?users/i,
            /audience\s*score.*?(\d+)%/i,
            /(\d+)%[^>]*liked/i
          ]
          
          for (const pattern of patterns) {
            const match = html.match(pattern)
            if (match) {
              percentageFound = parseInt(match[1])
              logProgress(`✨ Found in HTML: ${percentageFound}%`)
              break
            }
          }
        } else {
          logProgress('No percentage indicators in HTML')
        }
      } else if (task.result?.[0]?.html) {
        logProgress('Found HTML in task.result[0].html')
      } else {
        logProgress('No HTML found in response')
      }
    }
    
    if (!foundKnowledgePanel) {
      logProgress('⚠️  No knowledge panel found')
    }
    
    if (!percentageFound) {
      logProgress('❌ No percentage found')
    }
    
    return percentageFound
    
  } catch (error) {
    console.error(`Error testing "${item.title}":`, error)
    return null
  }
}

// Run tests
async function runTests() {
  console.log('🧪 DataForSEO Also-Liked Test')
  console.log('============================\n')
  
  const results: { title: string; percentage: number | null }[] = []
  
  for (const item of testItems) {
    const percentage = await testFetchPercentage(item)
    results.push({ title: item.title, percentage })
    
    // Wait 2 seconds between requests
    if (item !== testItems[testItems.length - 1]) {
      logProgress('\nWaiting 2 seconds...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  // Summary
  console.log('\n\n📊 Test Results Summary')
  console.log('=====================')
  for (const result of results) {
    const status = result.percentage !== null ? '✅' : '❌'
    const percentStr = result.percentage !== null ? `${result.percentage}%` : 'Not found'
    console.log(`${status} ${result.title}: ${percentStr}`)
  }
  
  const successCount = results.filter(r => r.percentage !== null).length
  console.log(`\nSuccess rate: ${successCount}/${results.length}`)
}

// Run the tests
runTests().catch(console.error)