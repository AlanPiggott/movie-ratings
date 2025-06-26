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

// Test different query patterns
const queryPatterns = [
  { pattern: '{title} {year}', example: 'The Avengers 2012' },
  { pattern: '{title} {year} movie', example: 'The Avengers 2012 movie' },
  { pattern: '{title} ({year}) movie', example: 'The Avengers (2012) movie' },
  { pattern: '{title} {year} film', example: 'The Avengers 2012 film' },
  { pattern: '"{title}" {year}', example: '"The Avengers" 2012' },
  { pattern: '{title} movie {year}', example: 'The Avengers movie 2012' }
]

// Test movies - including previously problematic ones
const testMovies = [
  // Previously failed movies
  { title: "The Avengers", year: 2012, notes: "Previously failed in some tests" },
  { title: "Forrest Gump", year: 1994, notes: "Failed in fast version" },
  { title: "Pulp Fiction", year: 1994, notes: "Failed in fast version" },
  { title: "Batman Begins", year: 2005, notes: "Failed in fast version" },
  { title: "Spider-Man: No Way Home", year: 2021, notes: "Franchise film" },
  
  // Control group (always worked)
  { title: "Oppenheimer", year: 2023, notes: "Recent film, always worked" },
  { title: "The Dark Knight", year: 2008, notes: "Usually successful" },
  { title: "Barbie", year: 2023, notes: "Recent film" }
]

// Extract percentage with all patterns
function extractPercentage(html: string): { percentage: number | null, matchedPattern: string | null } {
  const patterns = [
    { regex: /(\d{1,3})%\s*liked\s*this\s*(movie|film)/gi, name: 'X% liked this movie/film' },
    { regex: /(\d{1,3})%\s*of\s*(?:Google\s*)?users\s*liked/gi, name: 'X% of users liked' },
    { regex: />(\d{1,3})%\s*liked\s*this/gi, name: '>X% liked this' },
    { regex: /class="[^"]*srBp4[^"]*"[^>]*>\s*(\d{1,3})%/gi, name: 'srBp4 class pattern' },
    { regex: /(\d{1,3})%\s*liked/gi, name: 'Simple X% liked' },
    { regex: /liked\s*by\s*(\d{1,3})%/gi, name: 'liked by X%' },
    { regex: /audience\s*score[:\s]*(\d{1,3})%/gi, name: 'audience score' }
  ]
  
  for (const { regex, name } of patterns) {
    const matches = html.match(regex)
    if (matches) {
      for (const match of matches) {
        const percentMatch = match.match(/(\d{1,3})/)
        if (percentMatch) {
          const percentage = parseInt(percentMatch[1])
          if (percentage >= 0 && percentage <= 100) {
            return { percentage, matchedPattern: name }
          }
        }
      }
    }
  }
  
  return { percentage: null, matchedPattern: null }
}

// Test a single query
async function testQuery(movie: typeof testMovies[0], queryPattern: string, authHeader: string): Promise<any> {
  const query = queryPattern
    .replace('{title}', movie.title)
    .replace('{year}', movie.year.toString())
  
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
    if (!taskData.tasks?.[0]?.id) {
      return { query, success: false, error: 'Failed to create task' }
    }
    
    const taskId = taskData.tasks[0].id
    
    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 8000))
    
    // Get HTML
    const htmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
      method: 'GET',
      headers: { 'Authorization': authHeader }
    })
    
    const htmlData = await htmlResponse.json()
    const html = htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html || ''
    
    // Check if knowledge panel exists
    const hasKnowledgePanel = html.includes('kno-result') || 
                             html.includes('knowledge-panel') || 
                             html.includes('srBp4') ||
                             html.includes('kp-wholepage')
    
    // Extract percentage
    const { percentage, matchedPattern } = extractPercentage(html)
    
    // Save HTML for analysis if requested
    if (process.argv.includes('--save-html')) {
      const dataDir = pathJoin(process.cwd(), 'data', 'query-analysis')
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true })
      }
      
      const filename = `${movie.title.replace(/[^\w]/g, '-')}-${queryPattern.replace(/[^\w]/g, '-')}.html`
      writeFileSync(pathJoin(dataDir, filename), html)
    }
    
    return {
      query,
      success: percentage !== null,
      percentage,
      hasKnowledgePanel,
      matchedPattern,
      htmlLength: html.length
    }
    
  } catch (error) {
    return { query, success: false, error: String(error) }
  }
}

// Analyze all patterns
async function analyzeQueryPatterns() {
  console.log('🔬 Query Pattern Analysis')
  console.log('========================\n')
  
  const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
  const results = []
  
  // Test each movie with each pattern
  for (const movie of testMovies) {
    console.log(`\n📽️  Testing: ${movie.title} (${movie.year})`)
    console.log(`   Notes: ${movie.notes}`)
    console.log('   ' + '-'.repeat(60))
    
    const movieResults = []
    
    for (const { pattern, example } of queryPatterns) {
      process.stdout.write(`   Testing "${pattern}"... `)
      
      const result = await testQuery(movie, pattern, authHeader)
      movieResults.push({ ...result, pattern })
      
      if (result.success) {
        console.log(`✅ ${result.percentage}% (${result.matchedPattern})`)
      } else {
        console.log(`❌ Failed${result.hasKnowledgePanel ? ' (has knowledge panel)' : ''}`)
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    results.push({ movie, results: movieResults })
  }
  
  // Analyze results
  console.log('\n\n📊 ANALYSIS RESULTS')
  console.log('==================\n')
  
  // Success rate by pattern
  console.log('Success Rate by Query Pattern:')
  console.log('─'.repeat(60))
  
  const patternStats = {}
  queryPatterns.forEach(({ pattern }) => {
    patternStats[pattern] = { total: 0, success: 0 }
  })
  
  results.forEach(({ results: movieResults }) => {
    movieResults.forEach(result => {
      patternStats[result.pattern].total++
      if (result.success) patternStats[result.pattern].success++
    })
  })
  
  Object.entries(patternStats).forEach(([pattern, stats]: [string, any]) => {
    const rate = ((stats.success / stats.total) * 100).toFixed(1)
    console.log(`${pattern.padEnd(30)} ${stats.success}/${stats.total} (${rate}%)`)
  })
  
  // Movies that failed with all patterns
  console.log('\n\nMovies with Issues:')
  console.log('─'.repeat(60))
  
  results.forEach(({ movie, results: movieResults }) => {
    const successCount = movieResults.filter(r => r.success).length
    if (successCount < queryPatterns.length) {
      console.log(`\n${movie.title} (${movie.year}): ${successCount}/${queryPatterns.length} patterns worked`)
      
      // Show which patterns worked
      movieResults.forEach(result => {
        if (result.success) {
          console.log(`  ✅ "${result.pattern}" → ${result.percentage}%`)
        } else {
          console.log(`  ❌ "${result.pattern}"${result.hasKnowledgePanel ? ' (has knowledge panel but no %)' : ''}`)
        }
      })
    }
  })
  
  // Most reliable patterns
  console.log('\n\n🏆 RECOMMENDATIONS')
  console.log('==================')
  
  const sortedPatterns = Object.entries(patternStats)
    .sort((a: any, b: any) => (b[1].success / b[1].total) - (a[1].success / a[1].total))
  
  console.log('Query patterns ranked by success rate:')
  sortedPatterns.forEach(([pattern, stats]: [string, any], index) => {
    const rate = ((stats.success / stats.total) * 100).toFixed(1)
    console.log(`${index + 1}. ${pattern} - ${rate}% success rate`)
  })
  
  // Pattern matching analysis
  console.log('\n\nHTML Pattern Matching:')
  console.log('─'.repeat(60))
  
  const matchPatterns = {}
  results.forEach(({ results: movieResults }) => {
    movieResults.forEach(result => {
      if (result.matchedPattern) {
        matchPatterns[result.matchedPattern] = (matchPatterns[result.matchedPattern] || 0) + 1
      }
    })
  })
  
  Object.entries(matchPatterns)
    .sort((a: any, b: any) => b[1] - a[1])
    .forEach(([pattern, count]) => {
      console.log(`${pattern}: ${count} times`)
    })
}

// Run analysis
analyzeQueryPatterns().catch(console.error)