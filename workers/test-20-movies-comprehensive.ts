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

// Test movies - mix of easy and challenging titles
const testMovies = [
  // Classic/Easy titles
  { title: "Forrest Gump", year: 1994, category: "Classic" },
  { title: "The Shawshank Redemption", year: 1994, category: "Classic" },
  { title: "Pulp Fiction", year: 1994, category: "Classic" },
  { title: "The Godfather", year: 1972, category: "Classic" },
  { title: "Schindler's List", year: 1993, category: "Classic" },
  
  // Franchise films (challenging)
  { title: "Spider-Man: No Way Home", year: 2021, category: "Franchise" },
  { title: "The Avengers", year: 2012, category: "Franchise" },
  { title: "Avengers: Endgame", year: 2019, category: "Franchise" },
  { title: "The Dark Knight", year: 2008, category: "Franchise" },
  { title: "Batman Begins", year: 2005, category: "Franchise" },
  
  // Movies with numbers/sequels
  { title: "Terminator 2: Judgment Day", year: 1991, category: "Sequel" },
  { title: "Blade Runner 2049", year: 2017, category: "Sequel" },
  { title: "2001: A Space Odyssey", year: 1968, category: "Number" },
  { title: "300", year: 2006, category: "Number" },
  
  // Recent popular films
  { title: "Oppenheimer", year: 2023, category: "Recent" },
  { title: "Barbie", year: 2023, category: "Recent" },
  { title: "Dune", year: 2021, category: "Recent" },
  
  // Ambiguous titles
  { title: "It", year: 2017, category: "Ambiguous" },
  { title: "Her", year: 2013, category: "Ambiguous" },
  { title: "Up", year: 2009, category: "Ambiguous" }
]

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

// Build search queries with different strategies
function buildSearchQueries(movie: typeof testMovies[0]): string[] {
  const { title, year } = movie
  const titleHasYear = /\b(19|20)\d{2}\b/.test(title)
  
  const queries = []
  
  // Strategy 1: Standard format
  if (!titleHasYear) {
    queries.push(`${title} ${year} movie`)
  } else {
    queries.push(`${title} movie`)
  }
  
  // Strategy 2: Without subtitle (if has colon)
  if (title.includes(':')) {
    const mainTitle = title.split(':')[0].trim()
    queries.push(`${mainTitle} ${year} movie`)
  }
  
  // Strategy 3: With parentheses
  queries.push(`${title} (${year}) movie`)
  
  // Strategy 4: Just title and year
  queries.push(`${title} ${year}`)
  
  // Remove duplicates
  return [...new Set(queries)]
}

// Extract percentage from HTML
function extractPercentage(html: string): { percentage: number | null, context: string | null } {
  const patterns = [
    // Most common pattern
    /(\d{1,3})%\s*liked\s*this\s*(movie|film)/gi,
    /(\d{1,3})%\s*of\s*(?:Google\s*)?users\s*liked/gi,
    
    // Knowledge panel specific
    />(\d{1,3})%\s*liked\s*this/gi,
    /class="[^"]*srBp4[^"]*"[^>]*>\s*(\d{1,3})%/gi,
    
    // General patterns
    /(\d{1,3})%\s*liked/gi,
    /liked\s*by\s*(\d{1,3})%/gi,
    
    // Audience score
    /audience\s*score[:\s]*(\d{1,3})%/gi
  ]
  
  for (const pattern of patterns) {
    const matches = html.match(pattern)
    if (matches) {
      for (const match of matches) {
        const percentMatch = match.match(/(\d{1,3})/)
        if (percentMatch) {
          const percentage = parseInt(percentMatch[1])
          if (percentage >= 0 && percentage <= 100) {
            const context = match.replace(/\s+/g, ' ').trim()
            return { percentage, context }
          }
        }
      }
    }
  }
  
  return { percentage: null, context: null }
}

// Fetch percentage for a single movie
async function fetchMoviePercentage(movie: typeof testMovies[0]): Promise<{
  title: string
  year: number
  percentage: number | null
  context: string | null
  successfulQuery: string | null
  attempts: number
}> {
  const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
  const queries = buildSearchQueries(movie)
  
  let attempts = 0
  
  for (const query of queries) {
    attempts++
    
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
      if (!taskData.tasks?.[0]?.id) continue
      
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
      
      if (html) {
        const result = extractPercentage(html)
        if (result.percentage !== null) {
          return {
            title: movie.title,
            year: movie.year,
            percentage: result.percentage,
            context: result.context,
            successfulQuery: query,
            attempts
          }
        }
      }
      
      // Wait between attempts
      if (attempts < queries.length) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      
    } catch (error) {
      console.error(`Error with query "${query}":`, error)
    }
  }
  
  return {
    title: movie.title,
    year: movie.year,
    percentage: null,
    context: null,
    successfulQuery: null,
    attempts
  }
}

// Main test function
async function runComprehensiveTest() {
  console.log(`${colors.bright}${colors.cyan}🎬 Comprehensive Movie Sentiment Test${colors.reset}`)
  console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}\n`)
  console.log(`Testing ${testMovies.length} movies across different categories:\n`)
  
  const results = []
  const startTime = Date.now()
  
  for (let i = 0; i < testMovies.length; i++) {
    const movie = testMovies[i]
    console.log(`${colors.bright}[${i + 1}/${testMovies.length}]${colors.reset} Processing: ${colors.yellow}"${movie.title}" (${movie.year})${colors.reset} - ${movie.category}`)
    
    const result = await fetchMoviePercentage(movie)
    results.push({ ...result, category: movie.category })
    
    if (result.percentage !== null) {
      console.log(`    ${colors.green}✅ Found: ${result.percentage}% liked${colors.reset}`)
      console.log(`    ${colors.blue}Query: "${result.successfulQuery}"${colors.reset}`)
    } else {
      console.log(`    ${colors.red}❌ Not found after ${result.attempts} attempts${colors.reset}`)
    }
    
    // Rate limiting
    if (i < testMovies.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  // Calculate statistics
  const runtime = Math.round((Date.now() - startTime) / 1000)
  const successful = results.filter(r => r.percentage !== null)
  const byCategory = testMovies.reduce((acc, movie) => {
    acc[movie.category] = acc[movie.category] || { total: 0, found: 0 }
    acc[movie.category].total++
    return acc
  }, {} as Record<string, { total: number, found: number }>)
  
  results.forEach(result => {
    if (result.percentage !== null) {
      byCategory[result.category].found++
    }
  })
  
  // Display results summary
  console.log(`\n${colors.bright}${colors.cyan}📊 RESULTS SUMMARY${colors.reset}`)
  console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}\n`)
  
  // Success rate by category
  console.log(`${colors.bright}Success Rate by Category:${colors.reset}`)
  Object.entries(byCategory).forEach(([category, stats]) => {
    const rate = ((stats.found / stats.total) * 100).toFixed(0)
    const color = stats.found === stats.total ? colors.green : stats.found > 0 ? colors.yellow : colors.red
    console.log(`  ${category}: ${color}${stats.found}/${stats.total} (${rate}%)${colors.reset}`)
  })
  
  // Overall statistics
  console.log(`\n${colors.bright}Overall Statistics:${colors.reset}`)
  console.log(`  Total movies tested: ${testMovies.length}`)
  console.log(`  ${colors.green}Successfully found: ${successful.length}${colors.reset}`)
  console.log(`  ${colors.red}Not found: ${results.length - successful.length}${colors.reset}`)
  console.log(`  Success rate: ${((successful.length / results.length) * 100).toFixed(1)}%`)
  console.log(`  Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`)
  console.log(`  Estimated cost: ~$${(results.reduce((sum, r) => sum + r.attempts, 0) * 0.0006).toFixed(2)}`)
  
  // Detailed results table
  console.log(`\n${colors.bright}${colors.cyan}📋 DETAILED RESULTS${colors.reset}`)
  console.log(`${colors.cyan}${'='.repeat(80)}${colors.reset}`)
  console.log(`${colors.bright}Movie Title                              Year   Category    % Liked   Attempts${colors.reset}`)
  console.log(`${'-'.repeat(80)}`)
  
  results.forEach(result => {
    const title = result.title.padEnd(40)
    const year = result.year.toString().padEnd(6)
    const category = result.category.padEnd(11)
    const percentage = result.percentage !== null 
      ? `${colors.green}${result.percentage.toString().padStart(3)}%${colors.reset}` 
      : `${colors.red}Not found${colors.reset}`
    const attempts = result.attempts.toString().padStart(8)
    
    console.log(`${title} ${year} ${category} ${percentage}     ${attempts}`)
  })
  
  // Failed movies detail
  const failed = results.filter(r => r.percentage === null)
  if (failed.length > 0) {
    console.log(`\n${colors.bright}${colors.red}❌ Movies without data:${colors.reset}`)
    failed.forEach(movie => {
      console.log(`  - "${movie.title}" (${movie.year})`)
    })
  }
  
  // Successful queries analysis
  console.log(`\n${colors.bright}${colors.blue}🔍 Successful Query Patterns:${colors.reset}`)
  const queryPatterns = successful.reduce((acc, result) => {
    const pattern = result.successfulQuery?.includes('(') ? 'parentheses' :
                   result.successfulQuery?.includes(':') ? 'with_subtitle' :
                   result.successfulQuery?.endsWith('movie') ? 'standard' :
                   'title_year_only'
    acc[pattern] = (acc[pattern] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  Object.entries(queryPatterns).forEach(([pattern, count]) => {
    console.log(`  ${pattern}: ${count} times`)
  })
}

// Run the test
console.clear()
runComprehensiveTest().catch(console.error)