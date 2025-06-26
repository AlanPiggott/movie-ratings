#!/usr/bin/env tsx

// Compare old vs new approach on the same problematic movies

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

// Test the 3 movies that failed before
const problemMovies = [
  { title: "The Matrix", year: 1999 },
  { title: "Avatar: The Way of Water", year: 2022 },
  { title: "The Prestige", year: 2006 }
]

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN!
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD!
const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')

// Old approach - fixed wait, no retries
async function oldApproach(movie: { title: string, year: number }) {
  const query = `${movie.title} ${movie.year} movie`
  console.log(`[OLD] Testing: ${query}`)
  
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
        location_code: 2840,
        keyword: query
      }])
    })
    
    const taskData = await taskResponse.json()
    const taskId = taskData.tasks?.[0]?.id
    
    if (!taskId) {
      console.log('[OLD] ❌ Failed to create task')
      return null
    }
    
    // Fixed 8 second wait
    console.log('[OLD] Waiting fixed 8 seconds...')
    await new Promise(resolve => setTimeout(resolve, 8000))
    
    // Single attempt to get HTML
    const htmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
      method: 'GET',
      headers: { 'Authorization': authHeader }
    })
    
    const htmlData = await htmlResponse.json()
    const html = htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html || ''
    
    if (!html) {
      console.log('[OLD] ❌ No HTML returned')
      return null
    }
    
    // Extract percentage
    const match = html.match(/(\d{1,3})%\s*liked\s*this\s*(movie|film)/i)
    if (match) {
      console.log(`[OLD] ✅ Found: ${match[1]}%`)
      return parseInt(match[1])
    } else {
      console.log('[OLD] ❌ No percentage found')
      return null
    }
    
  } catch (error) {
    console.log('[OLD] ❌ Error:', error)
    return null
  }
}

// New approach - with all improvements
async function newApproach(movie: { title: string, year: number }) {
  const { 
    waitForTask,
    getTaskHtmlWithRetry,
    fetchAlsoLikedWithRetries
  } = await import('./fetch-also-liked-reliable')
  
  console.log(`[NEW] Testing: ${movie.title} (${movie.year})`)
  
  const result = await fetchAlsoLikedWithRetries({
    tmdbId: 999,
    title: movie.title,
    year: movie.year,
    mediaType: 'MOVIE'
  })
  
  if (result !== null) {
    console.log(`[NEW] ✅ Found: ${result}%`)
  } else {
    console.log('[NEW] ❌ No percentage found')
  }
  
  return result
}

// Run comparison
async function runComparison() {
  console.log('🔬 Reliability Comparison Test')
  console.log('==============================\n')
  console.log('Testing the 3 movies that failed in the original test...\n')
  
  const results = {
    old: { success: 0, total: 0 },
    new: { success: 0, total: 0 }
  }
  
  for (const movie of problemMovies) {
    console.log(`\n📽️ ${movie.title} (${movie.year})`)
    console.log('-'.repeat(50))
    
    // Test old approach
    console.log('\nOld approach:')
    const oldResult = await oldApproach(movie)
    results.old.total++
    if (oldResult !== null) results.old.success++
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Test new approach
    console.log('\nNew approach:')
    const newResult = await newApproach(movie)
    results.new.total++
    if (newResult !== null) results.new.success++
    
    // Rate limit between movies
    await new Promise(resolve => setTimeout(resolve, 3000))
  }
  
  // Summary
  console.log('\n\n📊 COMPARISON RESULTS')
  console.log('====================')
  console.log(`Old approach: ${results.old.success}/${results.old.total} (${(results.old.success/results.old.total*100).toFixed(0)}% success)`)
  console.log(`New approach: ${results.new.success}/${results.new.total} (${(results.new.success/results.new.total*100).toFixed(0)}% success)`)
  
  if (results.new.success > results.old.success) {
    const improvement = ((results.new.success - results.old.success) / results.old.total * 100).toFixed(0)
    console.log(`\n✨ Improvement: +${improvement}% success rate!`)
  }
}

// Run test
runComparison().catch(console.error)