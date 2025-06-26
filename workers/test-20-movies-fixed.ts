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
  
  // Strategy 2: With parentheses (this worked for Forrest Gump!)
  queries.push(`${title} (${year}) movie`)
  
  // Strategy 3: Without subtitle (if has colon)
  if (title.includes(':')) {
    const mainTitle = title.split(':')[0].trim()
    queries.push(`${mainTitle} ${year} movie`)
  }
  
  // Strategy 4: Just title and year
  queries.push(`${title} ${year}`)
  
  // Remove duplicates
  return [...new Set(queries)]
}

// Extract percentage from HTML - FIXED with global flags and all patterns
function extractPercentage(html: string): { percentage: number | null, context: string | null } {
  const patterns = [
    // Most common patterns - WITH GLOBAL FLAGS
    /(\d{1,3})%\s*liked\s*this\s*(movie|film)/gi,
    /(\d{1,3})%\s*of\s*(?:Google\s*)?users\s*liked/gi,
    
    // Knowledge panel specific
    />(\d{1,3})%\s*liked\s*this/gi,
    /class="[^"]*srBp4[^"]*"[^>]*>\s*(\d{1,3})%/gi,
    
    // General patterns
    /(\d{1,3})%\s*liked/gi,
    /liked\s*by\s*(\d{1,3})%/gi,
    
    // Audience score
    /audience\s*score[:\s]*(\d{1,3})%/gi,
    
    // Additional patterns from comprehensive version
    /(\d{1,3})%\s*positive/gi,
    /(\d{1,3})\s*%\s*liked/gi,
    /(\d{1,3})\s*percent\s*liked/gi,
    /google\s*users[:\s]*(\d{1,3})%\s*liked/gi,
    /(\d{1,3})%\s*of\s*google\s*users/gi
  ]
  
  // Try each pattern
  for (const pattern of patterns) {
    const matches = html.match(pattern)
    if (matches) {
      // Check ALL matches (not just the first)
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

// Process a single movie with retries
async function processMovie(movie: typeof testMovies[0], authHeader: string): Promise<any> {
  const queries = buildSearchQueries(movie)
  
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i]
    
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
            ...movie,
            percentage: result.percentage,
            context: result.context,
            successfulQuery: query,
            attempts: i + 1,
            found: true
          }
        }
      }
      
      // Wait before retry
      if (i < queries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      
    } catch (error) {
      console.error(`Error with query "${query}":`, error)
    }
  }
  
  return {
    ...movie,
    percentage: null,
    context: null,
    successfulQuery: null,
    attempts: queries.length,
    found: false
  }
}

// Process movies in batches with proper retry logic
async function processBatch(movies: typeof testMovies, batchNum: number): Promise<any[]> {
  const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
  
  console.log(`\n📦 Processing Batch ${batchNum} (${movies.length} movies)...`)
  
  const results = []
  
  for (const movie of movies) {
    console.log(`   Processing: ${movie.title} (${movie.year})...`)
    const result = await processMovie(movie, authHeader)
    
    if (result.found) {
      console.log(`   ✅ Found: ${result.percentage}% - Query: "${result.successfulQuery}"`)
    } else {
      console.log(`   ❌ Not found after ${result.attempts} attempts`)
    }
    
    results.push(result)
    
    // Rate limiting between movies
    await new Promise(resolve => setTimeout(resolve, 1500))
  }
  
  return results
}

// Main test function
async function runFixedTest() {
  console.log('🎬 Fixed Comprehensive Movie Test')
  console.log('=================================')
  console.log('Combining reliability + batch processing\n')
  
  const startTime = Date.now()
  const batchSize = 5
  const allResults = []
  
  // Process in batches
  for (let i = 0; i < testMovies.length; i += batchSize) {
    const batch = testMovies.slice(i, i + batchSize)
    const results = await processBatch(batch, Math.floor(i / batchSize) + 1)
    allResults.push(...results)
    
    // Wait between batches
    if (i + batchSize < testMovies.length) {
      console.log('\n⏳ Waiting 3 seconds before next batch...')
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  }
  
  // Display final results
  const runtime = Math.round((Date.now() - startTime) / 1000)
  const successful = allResults.filter(r => r.found)
  
  console.log('\n\n📊 FINAL RESULTS')
  console.log('================\n')
  
  // Show all results with details
  console.log('Movie Title                              Year   % Liked   Query Used')
  console.log('─'.repeat(80))
  
  allResults.forEach(result => {
    const title = result.title.padEnd(40)
    const year = result.year.toString().padEnd(6)
    const percentage = result.found 
      ? `✅ ${result.percentage.toString().padStart(3)}%` 
      : '❌ Not found'
    const query = result.successfulQuery || `(tried ${result.attempts} queries)`
    
    console.log(`${title} ${year} ${percentage.padEnd(15)} ${query}`)
  })
  
  // Category breakdown
  console.log('\n\n📈 RESULTS BY CATEGORY')
  console.log('=====================')
  
  const categories = ['Classic', 'Franchise', 'Sequel', 'Number', 'Recent', 'Ambiguous']
  for (const category of categories) {
    const categoryMovies = allResults.filter(m => m.category === category)
    const found = categoryMovies.filter(m => m.found).length
    const rate = ((found / categoryMovies.length) * 100).toFixed(0)
    console.log(`\n${category}: ${found}/${categoryMovies.length} (${rate}%)`)
    
    categoryMovies.forEach(movie => {
      const status = movie.found 
        ? `✅ ${movie.percentage}% - "${movie.successfulQuery}"`
        : '❌ Not found'
      console.log(`  ${movie.title}: ${status}`)
    })
  }
  
  // Summary
  console.log('\n\n📈 SUMMARY')
  console.log('==========')
  console.log(`Total movies tested: ${allResults.length}`)
  console.log(`Successfully found: ${successful.length} (${(successful.length/allResults.length*100).toFixed(1)}%)`)
  console.log(`Not found: ${allResults.length - successful.length}`)
  console.log(`Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`)
  
  // Query pattern analysis
  const queryPatterns = successful.reduce((acc, result) => {
    const pattern = result.successfulQuery?.includes('(') ? 'with_parentheses' :
                   result.successfulQuery?.includes('movie') ? 'standard_format' :
                   'title_year_only'
    acc[pattern] = (acc[pattern] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  
  console.log('\n🔍 Successful Query Patterns:')
  Object.entries(queryPatterns).forEach(([pattern, count]) => {
    console.log(`  ${pattern}: ${count} times`)
  })
  
  // Total attempts
  const totalAttempts = allResults.reduce((sum, r) => sum + r.attempts, 0)
  console.log(`\n💰 Estimated cost: ~$${(totalAttempts * 0.0006).toFixed(2)}`)
}

// Run the test
runFixedTest().catch(console.error)