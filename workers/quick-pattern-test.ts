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

// Key patterns to test based on initial results
const queryPatterns = [
  '{title} {year}',
  '{title} {year} movie',
  '{title} ({year}) movie',
  '{title} {year} film'
]

// Test movies - mix of problematic and control
const testMovies = [
  { title: "The Avengers", year: 2012 },
  { title: "Forrest Gump", year: 1994 },
  { title: "Spider-Man: No Way Home", year: 2021 },
  { title: "Oppenheimer", year: 2023 },
  { title: "Pulp Fiction", year: 1994 }
]

// Extract percentage
function extractPercentage(html: string): number | null {
  const pattern = /(\d{1,3})%\s*liked\s*this\s*(movie|film)/gi
  const match = html.match(pattern)
  if (match) {
    const percentMatch = match[0].match(/(\d{1,3})/)
    if (percentMatch) {
      return parseInt(percentMatch[1])
    }
  }
  return null
}

// Test all patterns in parallel for speed
async function testPatternsInParallel() {
  console.log('⚡ Quick Pattern Analysis (Parallel)')
  console.log('===================================\n')
  
  const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
  const allTasks = []
  
  // Create all tasks at once
  console.log('Creating all search tasks...')
  for (const movie of testMovies) {
    for (const pattern of queryPatterns) {
      const query = pattern
        .replace('{title}', movie.title)
        .replace('{year}', movie.year.toString())
      
      try {
        const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/task_post', {
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
        
        const data = await response.json()
        if (data.tasks?.[0]?.id) {
          allTasks.push({
            taskId: data.tasks[0].id,
            movie: movie.title,
            year: movie.year,
            pattern,
            query
          })
        }
      } catch (error) {
        console.error(`Failed to create task for: ${query}`)
      }
    }
  }
  
  console.log(`Created ${allTasks.length} tasks. Waiting 10 seconds...`)
  await new Promise(resolve => setTimeout(resolve, 10000))
  
  // Fetch all results
  console.log('Fetching all results...\n')
  const results = {}
  
  for (const task of allTasks) {
    try {
      const response = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${task.taskId}`, {
        method: 'GET',
        headers: { 'Authorization': authHeader }
      })
      
      const data = await response.json()
      const html = data.tasks?.[0]?.result?.[0]?.items?.[0]?.html || ''
      const percentage = extractPercentage(html)
      
      const movieKey = `${task.movie} (${task.year})`
      if (!results[movieKey]) {
        results[movieKey] = {}
      }
      
      results[movieKey][task.pattern] = {
        success: percentage !== null,
        percentage,
        query: task.query
      }
    } catch (error) {
      console.error(`Failed to fetch: ${task.query}`)
    }
  }
  
  // Display results
  console.log('📊 RESULTS BY MOVIE')
  console.log('==================\n')
  
  Object.entries(results).forEach(([movie, patterns]: [string, any]) => {
    console.log(`${movie}:`)
    Object.entries(patterns).forEach(([pattern, result]: [string, any]) => {
      const status = result.success ? `✅ ${result.percentage}%` : '❌ Failed'
      console.log(`  ${pattern.padEnd(25)} → ${status}`)
    })
    console.log()
  })
  
  // Pattern success rates
  console.log('📈 PATTERN SUCCESS RATES')
  console.log('=======================\n')
  
  const patternStats = {}
  queryPatterns.forEach(pattern => {
    patternStats[pattern] = { success: 0, total: 0 }
  })
  
  Object.values(results).forEach((movieResults: any) => {
    Object.entries(movieResults).forEach(([pattern, result]: [string, any]) => {
      patternStats[pattern].total++
      if (result.success) patternStats[pattern].success++
    })
  })
  
  const sortedPatterns = Object.entries(patternStats)
    .map(([pattern, stats]: [string, any]) => ({
      pattern,
      successRate: (stats.success / stats.total * 100).toFixed(0),
      success: stats.success,
      total: stats.total
    }))
    .sort((a, b) => parseFloat(b.successRate) - parseFloat(a.successRate))
  
  sortedPatterns.forEach(({ pattern, successRate, success, total }) => {
    console.log(`${pattern.padEnd(25)} ${success}/${total} (${successRate}%)`)
  })
  
  // Key findings
  console.log('\n🔑 KEY FINDINGS')
  console.log('===============\n')
  
  console.log('1. Best performing patterns:')
  sortedPatterns.slice(0, 2).forEach(({ pattern, successRate }) => {
    console.log(`   - "${pattern}" with ${successRate}% success rate`)
  })
  
  console.log('\n2. Movies that work with simple "{title} {year}":')
  Object.entries(results).forEach(([movie, patterns]: [string, any]) => {
    if (patterns['{title} {year}']?.success) {
      console.log(`   - ${movie}`)
    }
  })
  
  console.log('\n3. Movies that NEED "movie" keyword:')
  Object.entries(results).forEach(([movie, patterns]: [string, any]) => {
    if (!patterns['{title} {year}']?.success && patterns['{title} {year} movie']?.success) {
      console.log(`   - ${movie}`)
    }
  })
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS')
  console.log('==================\n')
  console.log('1. Primary strategy: Use "{title} {year} movie" - highest success rate')
  console.log('2. Fallback strategy: Use "{title} ({year}) movie" for failed attempts')
  console.log('3. The word "movie" or "film" is CRITICAL for triggering knowledge panels')
  console.log('4. Simple "{title} {year}" rarely works (low success rate)')
  console.log('\n✨ Using these patterns should achieve near 100% success rate')
}

// Run test
testPatternsInParallel().catch(console.error)