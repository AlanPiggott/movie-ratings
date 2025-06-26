#!/usr/bin/env tsx

// Script to retry problematic movies with special handling

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// DataForSEO credentials
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN!
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD!
const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')

// Load failed movies
const FAILED_FILE = pathJoin(process.cwd(), 'data', 'failed-movies.json')
const failedMovies = JSON.parse(readFileSync(FAILED_FILE, 'utf-8'))

// Special handling for problematic titles
function createQueryVariations(movie: any): string[] {
  const { title, original_title, year } = movie
  const queries: string[] = []
  
  // Handle special characters
  const cleanTitle = title
    .replace(/é/g, 'e')
    .replace(/è/g, 'e')
    .replace(/ê/g, 'e')
    .replace(/ë/g, 'e')
    .replace(/á/g, 'a')
    .replace(/à/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/â/g, 'a')
    .replace(/ñ/g, 'n')
    .replace(/ö/g, 'o')
    .replace(/ô/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ù/g, 'u')
    .replace(/û/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/:/g, '')  // Remove colons for some searches
    .replace(/['']/g, '') // Remove smart quotes
  
  // Primary queries
  queries.push(`${title} ${year} movie`)
  queries.push(`${cleanTitle} ${year} movie`)
  
  // For titles with colons, try without subtitle
  if (title.includes(':')) {
    const mainTitle = title.split(':')[0].trim()
    queries.push(`${mainTitle} ${year} movie`)
    
    const cleanMainTitle = cleanTitle.split(' ')[0]
    queries.push(`${cleanMainTitle} ${year} movie`)
  }
  
  // Try with quotes
  queries.push(`"${title}" ${year}`)
  queries.push(`"${cleanTitle}" ${year}`)
  
  // Use original title if different
  if (original_title && original_title !== title) {
    queries.push(`${original_title} ${year} movie`)
    const cleanOriginal = original_title
      .replace(/é/g, 'e')
      .replace(/è/g, 'e')
      .replace(/['']/g, '')
    queries.push(`${cleanOriginal} ${year} movie`)
  }
  
  // Remove duplicates
  return [...new Set(queries)]
}

// Extract percentage with all patterns
function extractPercentage(html: string): number | null {
  const patterns = [
    /(\d{1,3})%\s*liked\s*this\s*(movie|film)/gi,
    /(\d{1,3})%\s*of\s*(?:Google\s*)?users\s*liked/gi,
    />(\d{1,3})%\s*liked\s*this/gi,
    /(\d{1,3})%\s*liked/gi,
    /class="[^"]*srBp4[^"]*"[^>]*>\s*(\d{1,3})%/gi
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

// Fetch with enhanced retry logic
async function fetchWithEnhancedRetry(movie: any): Promise<number | null> {
  const queries = createQueryVariations(movie)
  console.log(`\n🎬 Retrying: ${movie.title} (${movie.year})`)
  console.log(`   Generated ${queries.length} query variations`)
  
  for (const query of queries) {
    console.log(`   🔍 Trying: "${query}"`)
    
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
      
      // Wait longer for problematic movies
      console.log(`   ⏳ Waiting 10 seconds...`)
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      // Try to get HTML multiple times
      for (let attempt = 1; attempt <= 5; attempt++) {
        const htmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
          method: 'GET',
          headers: { 'Authorization': authHeader }
        })
        
        const htmlData = await htmlResponse.json()
        const html = htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html
        
        if (html) {
          const percentage = extractPercentage(html)
          if (percentage !== null) {
            console.log(`   ✅ SUCCESS: Found ${percentage}% with query "${query}"`)
            return percentage
          }
        }
        
        if (attempt < 5) {
          console.log(`   ⏳ No data yet, waiting 3 more seconds...`)
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error}`)
    }
    
    // Rate limit between queries
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  console.log(`   ❌ Failed all variations for ${movie.title}`)
  return null
}

// Main retry function
async function retryProblematicMovies() {
  console.log('🔧 Retrying Problematic Movies with Enhanced Handling')
  console.log('=====================================================\n')
  
  // Focus on known problematic movies
  const knownProblematic = [
    'Léon: The Professional',
    'Inception',
    'Les Misérables',
    'Amélie',
    'La La Land',
    'Crouching Tiger, Hidden Dragon',
    'Pan\'s Labyrinth',
    'Life Is Beautiful',
    'The King\'s Speech',
    'Slumdog Millionaire'
  ]
  
  // Get movies that match our problematic list
  const moviesToRetry = Object.values(failedMovies)
    .filter((failed: any) => 
      knownProblematic.some(title => 
        failed.movie.title.toLowerCase().includes(title.toLowerCase()) ||
        title.toLowerCase().includes(failed.movie.title.toLowerCase())
      )
    )
    .slice(0, 20) // Limit to 20 for testing
  
  console.log(`Found ${moviesToRetry.length} problematic movies to retry\n`)
  
  let successCount = 0
  
  for (const failedEntry of moviesToRetry) {
    const movie = (failedEntry as any).movie
    
    const percentage = await fetchWithEnhancedRetry(movie)
    
    if (percentage !== null) {
      // Update database
      try {
        const { error } = await supabase
          .from('media_items')
          .update({ also_liked_percentage: percentage })
          .eq('tmdb_id', movie.tmdbId)
          .eq('media_type', movie.mediaType)
        
        if (!error) {
          console.log(`   💾 Updated database successfully\n`)
          successCount++
        } else {
          console.log(`   ❌ Database update failed: ${error.message}\n`)
        }
      } catch (error) {
        console.log(`   ❌ Error updating database: ${error}\n`)
      }
    }
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 3000))
  }
  
  console.log('\n📊 SUMMARY')
  console.log('==========')
  console.log(`Total retried: ${moviesToRetry.length}`)
  console.log(`Successful: ${successCount}`)
  console.log(`Failed: ${moviesToRetry.length - successCount}`)
  console.log(`Success rate: ${((successCount / moviesToRetry.length) * 100).toFixed(1)}%`)
}

// Run it
retryProblematicMovies().catch(console.error)