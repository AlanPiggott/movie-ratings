#!/usr/bin/env npx tsx

// Script to manually update a single movie's rating
// Useful for testing and debugging the rating update system

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'

// Load environment variables
const envResult = dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })
if (envResult.error) {
  console.error('❌ Error loading .env.local:', envResult.error)
  process.exit(1)
}

import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Clean title for special characters (from the production code)
function cleanTitle(title: string): string {
  return title
    .replace(/['']/g, '') // Remove smart quotes
    .replace(/[éèêë]/g, 'e')
    .replace(/[áàäâ]/g, 'a')
    .replace(/[ñ]/g, 'n')
    .replace(/[öô]/g, 'o')
    .replace(/[üùû]/g, 'u')
    .replace(/[ç]/g, 'c')
}

// Search for rating using DataForSEO
async function searchGoogleForPercentage(item: any): Promise<number | null> {
  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64')
  
  // Build queries based on media type
  const queries: string[] = []
  const mediaTypeStr = item.media_type === 'TV_SHOW' ? 'tv show' : 'movie'
  const cleanedTitle = cleanTitle(item.title)
  const year = item.release_date ? new Date(item.release_date).getFullYear() : null
  
  if (item.media_type === 'TV_SHOW') {
    if (year) {
      queries.push(`${item.title} ${year} tv show`)
      queries.push(`${item.title} (${year}) tv show`)
      if (cleanedTitle !== item.title) {
        queries.push(`${cleanedTitle} ${year} tv show`)
      }
    }
    queries.push(`${item.title} tv show`)
  } else {
    if (year) {
      queries.push(`${item.title} ${year} movie`)
      queries.push(`${item.title} (${year}) movie`)
      queries.push(`"${item.title}" ${year} film`)
      if (cleanedTitle !== item.title) {
        queries.push(`${cleanedTitle} ${year} movie`)
      }
    }
    queries.push(`${item.title} movie`)
  }
  
  console.log(`🔍 Trying ${queries.length} search queries...`)
  
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i]
    console.log(`  Query ${i + 1}: "${query}"`)
    
    try {
      // Create task
      const createResponse = await fetch('https://api.dataforseo.com/v3/serp/google/organic/task_post', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + auth,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{
          language_code: 'en',
          location_code: 2840,
          keyword: query,
          device: 'desktop',
          os: 'windows'
        }])
      })
      
      const createData = await createResponse.json()
      if (createData.status_code !== 20000 || !createData.tasks?.[0]?.id) {
        console.log(`    ❌ Failed to create task`)
        continue
      }
      
      const taskId = createData.tasks[0].id
      console.log(`    ✓ Task created: ${taskId}`)
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      // Fetch HTML
      const htmlResponse = await fetch(
        `https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`,
        {
          method: 'GET',
          headers: { 'Authorization': 'Basic ' + auth }
        }
      )
      
      const htmlData = await htmlResponse.json()
      if (htmlData.status_code !== 20000) {
        console.log(`    ❌ Failed to fetch results`)
        continue
      }
      
      const html = htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html
      if (!html) {
        console.log(`    ❌ No HTML content`)
        continue
      }
      
      // Extract percentage
      const patterns = [
        /(\d{1,3})%\s*liked\s*this\s*(movie|film|show|series)/gi,
        /(\d{1,3})%\s*of\s*(?:Google\s*)?users\s*liked/gi,
        />(\d{1,3})%\s*liked\s*this/gi,
        /class="[^"]*srBp4[^"]*"[^>]*>\s*(\d{1,3})%/gi,
        /(\d{1,3})%\s*liked/gi
      ]
      
      for (const pattern of patterns) {
        const matches = html.match(pattern)
        if (matches) {
          for (const match of matches) {
            const percentMatch = match.match(/(\d{1,3})/)
            if (percentMatch) {
              const percentage = parseInt(percentMatch[1])
              if (percentage >= 0 && percentage <= 100) {
                console.log(`    ✅ Found rating: ${percentage}%`)
                return percentage
              }
            }
          }
        }
      }
      
      console.log(`    ❌ No rating found in HTML`)
      
    } catch (error) {
      console.log(`    ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`)
    }
  }
  
  return null
}

// Main function
async function main() {
  const searchQuery = process.argv.slice(2).join(' ')
  
  if (!searchQuery) {
    console.log('Usage: ./update-single-rating.ts <movie/show title>')
    console.log('Example: ./update-single-rating.ts "The Dark Knight"')
    process.exit(1)
  }
  
  console.log('🎬 Single Rating Update Tool')
  console.log('===========================\n')
  console.log(`Searching for: "${searchQuery}"\n`)
  
  try {
    // Search for the item
    const { data: items, error: searchError } = await supabase
      .from('media_items')
      .select('*')
      .ilike('title', `%${searchQuery}%`)
      .limit(10)
    
    if (searchError || !items || items.length === 0) {
      console.log('❌ No matching items found')
      process.exit(1)
    }
    
    if (items.length === 1) {
      console.log(`✅ Found: ${items[0].title} (${items[0].media_type})\n`)
    } else {
      console.log('Multiple matches found:\n')
      items.forEach((item, index) => {
        const year = item.release_date ? new Date(item.release_date).getFullYear() : 'N/A'
        console.log(`${index + 1}. ${item.title} (${year}) - ${item.media_type}`)
      })
      
      // For now, just use the first result
      console.log('\nUsing first result...\n')
    }
    
    const item = items[0]
    const yearStr = item.release_date ? ` (${new Date(item.release_date).getFullYear()})` : ''
    
    // Display current info
    console.log('📊 Current Information:')
    console.log(`  Title: ${item.title}${yearStr}`)
    console.log(`  Type: ${item.media_type}`)
    console.log(`  Current Rating: ${item.also_liked_percentage !== null ? `${item.also_liked_percentage}%` : 'Not set'}`)
    console.log(`  Last Updated: ${item.rating_last_updated || 'Never'}`)
    console.log(`  Update Tier: ${item.rating_update_tier || 'Not assigned'}`)
    console.log(`  Check Count: ${item.rating_check_count || 0}`)
    console.log(`  Unchanged Count: ${item.rating_unchanged_count || 0}`)
    console.log()
    
    // Fetch new rating
    console.log('🔄 Fetching updated rating from Google...\n')
    const startTime = Date.now()
    const newRating = await searchGoogleForPercentage(item)
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    
    console.log(`\n⏱️  Search completed in ${duration}s`)
    console.log(`💰 Cost: $${(2 * 0.0006).toFixed(4)} (2 API calls)\n`)
    
    if (newRating !== null) {
      const changed = newRating !== item.also_liked_percentage
      console.log('✅ Rating found!')
      console.log(`  New Rating: ${newRating}%`)
      console.log(`  Previous: ${item.also_liked_percentage !== null ? `${item.also_liked_percentage}%` : 'Not set'}`)
      console.log(`  Changed: ${changed ? 'Yes' : 'No'}\n`)
      
      // Update database
      console.log('💾 Updating database...')
      
      const { error: updateError } = await supabase.rpc('record_rating_update', {
        p_media_id: item.id,
        p_new_rating: newRating,
        p_previous_rating: item.also_liked_percentage
      })
      
      if (updateError) {
        console.error('❌ Error updating database:', updateError)
      } else {
        console.log('✅ Database updated successfully!')
      }
    } else {
      console.log('❌ No rating found')
      console.log('This could mean:')
      console.log('  - The movie/show doesn\'t have Google ratings')
      console.log('  - The search queries need adjustment')
      console.log('  - The HTML extraction patterns need updating')
    }
    
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

// Run the script
main().catch(console.error)