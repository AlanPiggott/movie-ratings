#!/usr/bin/env tsx

// Script to retry specific movies you know have Google % data

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// DataForSEO credentials
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN!
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD!
const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')

// ADD MOVIES HERE that you've verified have Google % data
const moviesToRetry = [
  { title: "Léon: The Professional", cleanTitle: "Leon The Professional", year: 1994 },
  { title: "Inception", cleanTitle: "Inception", year: 2010 },
  { title: "Les Misérables", cleanTitle: "Les Miserables", year: 2012 },
  { title: "Amélie", cleanTitle: "Amelie", year: 2001 },
  { title: "The King's Speech", cleanTitle: "The Kings Speech", year: 2010 },
  // Add more movies here as needed
]

// Extract percentage
function extractPercentage(html: string): number | null {
  const patterns = [
    /(\d{1,3})%\s*liked\s*this\s*(movie|film)/gi,
    /(\d{1,3})%\s*of\s*(?:Google\s*)?users\s*liked/gi,
    />(\d{1,3})%\s*liked\s*this/gi,
    /(\d{1,3})%\s*liked/gi
  ]
  
  for (const pattern of patterns) {
    const matches = html.match(pattern)
    if (matches) {
      const percentMatch = matches[0].match(/(\d{1,3})/)
      if (percentMatch) {
        const percentage = parseInt(percentMatch[1])
        if (percentage >= 0 && percentage <= 100) {
          return percentage
        }
      }
    }
  }
  return null
}

async function retryMovie(movie: any) {
  console.log(`\n🎬 Processing: ${movie.title} (${movie.year})`)
  
  // Try both original and clean title
  const queries = [
    `${movie.cleanTitle} ${movie.year} movie`,
    `${movie.title} ${movie.year} movie`,
    `"${movie.cleanTitle}" ${movie.year}`,
    `${movie.cleanTitle} movie ${movie.year}`
  ]
  
  for (const query of queries) {
    console.log(`   Trying: "${query}"`)
    
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
        console.log('   ❌ Failed to create task')
        continue
      }
      
      const taskId = taskData.tasks[0].id
      console.log(`   ⏳ Task created, waiting 10 seconds...`)
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      // Get HTML
      const htmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
        method: 'GET',
        headers: { 'Authorization': authHeader }
      })
      
      const htmlData = await htmlResponse.json()
      const html = htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html
      
      if (html) {
        const percentage = extractPercentage(html)
        if (percentage !== null) {
          console.log(`   ✅ Found: ${percentage}%`)
          
          // Find in database and update
          const { data: movies } = await supabase
            .from('media_items')
            .select('tmdb_id, media_type')
            .eq('title', movie.title)
            .eq('release_date', `${movie.year}-01-01`)
            .gte('release_date', `${movie.year}-01-01`)
            .lte('release_date', `${movie.year}-12-31`)
          
          if (movies && movies.length > 0) {
            const { error } = await supabase
              .from('media_items')
              .update({ also_liked_percentage: percentage })
              .eq('tmdb_id', movies[0].tmdb_id)
              .eq('media_type', movies[0].media_type)
            
            if (!error) {
              console.log(`   💾 Updated in database!`)
              return true
            } else {
              console.log(`   ❌ Database error: ${error.message}`)
            }
          } else {
            console.log(`   ⚠️  Movie not found in database`)
          }
          
          return true
        }
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 2000))
      
    } catch (error) {
      console.log(`   ❌ Error: ${error}`)
    }
  }
  
  console.log(`   ❌ Failed to get data for ${movie.title}`)
  return false
}

async function main() {
  console.log('🔧 Retrying Specific Movies with Known Google % Data')
  console.log('===================================================')
  
  let successCount = 0
  
  for (const movie of moviesToRetry) {
    const success = await retryMovie(movie)
    if (success) successCount++
    
    // Rate limit between movies
    await new Promise(resolve => setTimeout(resolve, 3000))
  }
  
  console.log('\n📊 Summary:')
  console.log(`   Total: ${moviesToRetry.length}`)
  console.log(`   Success: ${successCount}`)
  console.log(`   Failed: ${moviesToRetry.length - successCount}`)
}

main().catch(console.error)