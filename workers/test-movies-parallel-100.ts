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

// Test movies with enhanced metadata
const testMovies = [
  // Classic/Easy titles
  { title: "Forrest Gump", year: 1994, category: "Classic" },
  { title: "The Shawshank Redemption", year: 1994, category: "Classic" },
  { title: "Pulp Fiction", year: 1994, category: "Classic" },
  { title: "The Godfather", year: 1972, category: "Classic" },
  { title: "Schindler's List", year: 1993, category: "Classic" },
  
  // Franchise films - with directors for disambiguation
  { title: "Spider-Man: No Way Home", year: 2021, category: "Franchise", director: "Jon Watts" },
  { title: "The Avengers", year: 2012, category: "Franchise", director: "Joss Whedon", altTitle: "Marvel's The Avengers" },
  { title: "Avengers: Endgame", year: 2019, category: "Franchise" },
  { title: "The Dark Knight", year: 2008, category: "Franchise", director: "Christopher Nolan" },
  { title: "Batman Begins", year: 2005, category: "Franchise", director: "Christopher Nolan" },
  
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
  { title: "It", year: 2017, category: "Ambiguous", altTitle: "It Chapter One" },
  { title: "Her", year: 2013, category: "Ambiguous" },
  { title: "Up", year: 2009, category: "Ambiguous" }
]

// Enhanced query strategies
function buildEnhancedQueries(movie: typeof testMovies[0]): string[] {
  const queries = []
  
  // Primary query
  queries.push(`${movie.title} ${movie.year} movie`)
  
  // With parentheses (proven to work)
  queries.push(`${movie.title} (${movie.year}) movie`)
  
  // Alternative title if provided
  if (movie.altTitle) {
    queries.push(`${movie.altTitle} ${movie.year} movie`)
  }
  
  // With director for disambiguation
  if (movie.director) {
    queries.push(`${movie.title} ${movie.year} ${movie.director}`)
  }
  
  // For franchise films, try with "film" instead
  if (movie.category === "Franchise") {
    queries.push(`${movie.title} ${movie.year} film`)
  }
  
  // Remove duplicates
  return [...new Set(queries)]
}

// Extract percentage with all known patterns
function extractPercentage(html: string): number | null {
  // All patterns that have worked
  const patterns = [
    /(\d{1,3})%\s*liked\s*this\s*(movie|film)/gi,
    /(\d{1,3})%\s*of\s*(?:Google\s*)?users\s*liked/gi,
    />(\d{1,3})%\s*liked\s*this/gi,
    /class="[^"]*srBp4[^"]*"[^>]*>\s*(\d{1,3})%/gi,
    /(\d{1,3})%\s*liked/gi,
    /liked\s*by\s*(\d{1,3})%/gi,
    /audience\s*score[:\s]*(\d{1,3})%/gi,
    /(\d{1,3})%\s*positive/gi,
    /google\s*users[:\s]*(\d{1,3})%/gi
  ]
  
  for (const pattern of patterns) {
    const matches = html.match(pattern)
    if (matches) {
      for (const match of matches) {
        const percentMatch = match.match(/(\d{1,3})/)
        if (percentMatch) {
          const percentage = parseInt(percentMatch[1])
          if (percentage >= 0 && percentage <= 100) {
            return percentage
          }
        }
      }
    }
  }
  
  return null
}

// Create a single task
async function createTask(query: string, authHeader: string): Promise<string | null> {
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
    return data.tasks?.[0]?.id || null
  } catch (error) {
    return null
  }
}

// Get HTML for a task
async function getTaskHtml(taskId: string, authHeader: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
      method: 'GET',
      headers: { 'Authorization': authHeader }
    })
    
    const data = await response.json()
    return data.tasks?.[0]?.result?.[0]?.items?.[0]?.html || null
  } catch (error) {
    return null
  }
}

// Process all movies in parallel with smart retries
async function runParallelTest() {
  console.log('🚀 Parallel Movie Test - Targeting 100% Success')
  console.log('==============================================\n')
  
  const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')
  const startTime = Date.now()
  
  // Phase 1: Create all primary tasks in parallel
  console.log('📤 Phase 1: Creating all primary search tasks...')
  const primaryTasks = await Promise.all(
    testMovies.map(async (movie) => {
      const query = `${movie.title} ${movie.year} movie`
      const taskId = await createTask(query, authHeader)
      return { movie, query, taskId, attempt: 1 }
    })
  )
  
  // Wait for tasks to complete
  console.log('⏳ Waiting 10 seconds for tasks to complete...\n')
  await new Promise(resolve => setTimeout(resolve, 10000))
  
  // Phase 2: Fetch all results in parallel
  console.log('📥 Phase 2: Fetching all results...')
  const results = await Promise.all(
    primaryTasks.map(async ({ movie, query, taskId }) => {
      if (!taskId) return { ...movie, percentage: null, found: false }
      
      const html = await getTaskHtml(taskId, authHeader)
      const percentage = html ? extractPercentage(html) : null
      
      return {
        ...movie,
        percentage,
        found: percentage !== null,
        successfulQuery: percentage !== null ? query : null
      }
    })
  )
  
  // Phase 3: Retry failed movies with alternative queries
  const failed = results.filter(r => !r.found)
  if (failed.length > 0) {
    console.log(`\n🔄 Phase 3: Retrying ${failed.length} failed movies with alternative queries...`)
    
    // Create retry tasks
    const retryTasks = []
    for (const movie of failed) {
      const queries = buildEnhancedQueries(movie)
      // Skip the first query (already tried)
      for (const query of queries.slice(1)) {
        const taskId = await createTask(query, authHeader)
        if (taskId) {
          retryTasks.push({ movie, query, taskId })
          break // Only try one alternative at a time
        }
      }
    }
    
    if (retryTasks.length > 0) {
      // Wait for retry tasks
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      // Fetch retry results
      for (const { movie, query, taskId } of retryTasks) {
        const html = await getTaskHtml(taskId, authHeader)
        const percentage = html ? extractPercentage(html) : null
        
        if (percentage !== null) {
          // Update the result
          const index = results.findIndex(r => r.title === movie.title && r.year === movie.year)
          if (index !== -1) {
            results[index] = {
              ...results[index],
              percentage,
              found: true,
              successfulQuery: query
            }
          }
        }
      }
    }
  }
  
  // Display results
  const runtime = Math.round((Date.now() - startTime) / 1000)
  const successful = results.filter(r => r.found)
  
  console.log('\n\n📊 FINAL RESULTS - ALL 20 MOVIES')
  console.log('================================\n')
  
  console.log('Movie                                    Year    % Liked         Query Used')
  console.log('─'.repeat(80))
  
  results.forEach(movie => {
    const title = movie.title.padEnd(40)
    const year = movie.year.toString().padEnd(8)
    const status = movie.found ? `✅ ${movie.percentage?.toString().padStart(3)}%` : '❌ Not found'
    const query = movie.successfulQuery || 'All queries failed'
    console.log(`${title} ${year}${status.padEnd(16)}${query}`)
  })
  
  console.log('\n📈 SUMMARY')
  console.log('==========')
  console.log(`Total movies: ${results.length}`)
  console.log(`Success rate: ${successful.length}/${results.length} (${(successful.length/results.length*100).toFixed(1)}%)`)
  console.log(`Runtime: ${runtime} seconds`)
  
  // Category breakdown
  console.log('\n📊 By Category:')
  const categories = [...new Set(results.map(r => r.category))]
  categories.forEach(category => {
    const catMovies = results.filter(r => r.category === category)
    const catSuccess = catMovies.filter(r => r.found).length
    console.log(`  ${category}: ${catSuccess}/${catMovies.length} (${(catSuccess/catMovies.length*100).toFixed(0)}%)`)
  })
  
  // Failed movies detail
  const finalFailed = results.filter(r => !r.found)
  if (finalFailed.length > 0) {
    console.log('\n❌ Movies without data:')
    finalFailed.forEach(m => {
      console.log(`  - ${m.title} (${m.year})`)
      if (m.altTitle) console.log(`    Alternative title: ${m.altTitle}`)
      if (m.director) console.log(`    Director: ${m.director}`)
    })
  } else {
    console.log('\n✨ 100% SUCCESS! All movies found!')
  }
  
  console.log(`\n💰 Estimated cost: ~$${(results.length * 2 * 0.0006).toFixed(2)}`)
}

// Run the test
runParallelTest().catch(console.error)