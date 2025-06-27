#!/usr/bin/env npx tsx

// Scheduled rating update worker
// This script runs daily to update movie/TV ratings based on tier assignments

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

// Configuration
const CONFIG = {
  BATCH_SIZE: parseInt(process.env.RATING_UPDATE_BATCH_SIZE || '100'),
  DAILY_LIMIT: parseInt(process.env.RATING_UPDATE_DAILY_LIMIT || '1000'),
  CONCURRENT_ITEMS: 6,  // Process 6 items at once
  RATE_LIMIT_PER_SEC: 18,
  TASK_COMPLETION_WAIT: 5000,
  ENABLED: process.env.RATING_UPDATE_ENABLED !== 'false',
  DRY_RUN: process.argv.includes('--dry-run'),
  TEST_MODE: process.env.TEST_MODE === 'true' || process.argv.includes('--test')
}

// Stats tracking
const stats = {
  processed: 0,
  updated: 0,
  unchanged: 0,
  failed: 0,
  apiCalls: 0,
  cost: 0,
  startTime: Date.now()
}

// Rate limiting
const requestTimestamps: number[] = []

// Check rate limit
async function checkRateLimit() {
  const now = Date.now()
  const oneSecondAgo = now - 1000
  
  // Remove old timestamps
  while (requestTimestamps.length > 0 && requestTimestamps[0] < oneSecondAgo) {
    requestTimestamps.shift()
  }
  
  // If we're at the limit, wait
  if (requestTimestamps.length >= CONFIG.RATE_LIMIT_PER_SEC) {
    const oldestTimestamp = requestTimestamps[0]
    const waitTime = Math.max(0, 1000 - (now - oldestTimestamp))
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }
  
  requestTimestamps.push(Date.now())
}

// Clean title for special characters
function cleanTitle(title: string): string {
  return title
    .replace(/['']/g, '')
    .replace(/[éèêë]/g, 'e')
    .replace(/[áàäâ]/g, 'a')
    .replace(/[ñ]/g, 'n')
    .replace(/[öô]/g, 'o')
    .replace(/[üùû]/g, 'u')
    .replace(/[ç]/g, 'c')
}

// Search for rating using DataForSEO
async function searchGoogleForPercentage(item: any): Promise<number | null> {
  if (CONFIG.DRY_RUN) {
    // Simulate API call in dry run
    stats.apiCalls += 2
    return Math.floor(Math.random() * 30) + 70 // Random 70-100%
  }
  
  const auth = Buffer.from(
    `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
  ).toString('base64')
  
  // Build queries
  const queries: string[] = []
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
      if (cleanedTitle !== item.title) {
        queries.push(`${cleanedTitle} ${year} movie`)
      }
    }
    queries.push(`${item.title} movie`)
  }
  
  // Try queries until we find a result
  for (const query of queries) {
    await checkRateLimit()
    stats.apiCalls++
    
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
      
      if (createResponse.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 5000))
        continue
      }
      
      const createData = await createResponse.json()
      if (createData.status_code !== 20000 || !createData.tasks?.[0]?.id) {
        continue
      }
      
      const taskId = createData.tasks[0].id
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, CONFIG.TASK_COMPLETION_WAIT))
      
      // Fetch HTML
      await checkRateLimit()
      stats.apiCalls++
      
      const htmlResponse = await fetch(
        `https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`,
        {
          method: 'GET',
          headers: { 'Authorization': 'Basic ' + auth }
        }
      )
      
      if (htmlResponse.status === 429) {
        await new Promise(resolve => setTimeout(resolve, 5000))
        continue
      }
      
      const htmlData = await htmlResponse.json()
      if (htmlData.status_code !== 20000) continue
      
      const html = htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html
      if (!html) continue
      
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
                return percentage
              }
            }
          }
        }
      }
      
    } catch (error) {
      // Continue to next query
    }
  }
  
  return null
}

// Process a single item
async function processItem(item: any): Promise<void> {
  const emoji = item.media_type === 'MOVIE' ? '🎬' : '📺'
  const yearStr = item.release_date ? ` (${new Date(item.release_date).getFullYear()})` : ''
  
  try {
    // Fetch new rating
    const newRating = await searchGoogleForPercentage(item)
    
    if (newRating !== null) {
      const changed = newRating !== item.also_liked_percentage
      
      if (!CONFIG.DRY_RUN) {
        // Update database
        await supabase.rpc('record_rating_update', {
          p_media_id: item.id,
          p_new_rating: newRating,
          p_previous_rating: item.also_liked_percentage
        })
      }
      
      if (changed) {
        stats.updated++
        console.log(`${emoji} ${item.title}${yearStr}: ${item.also_liked_percentage || '?'}% → ${newRating}% ✅`)
      } else {
        stats.unchanged++
        if (CONFIG.TEST_MODE) {
          console.log(`${emoji} ${item.title}${yearStr}: ${newRating}% (unchanged)`)
        }
      }
    } else {
      stats.failed++
      console.log(`${emoji} ${item.title}${yearStr}: No rating found ❌`)
    }
    
  } catch (error) {
    stats.failed++
    console.error(`${emoji} ${item.title}${yearStr}: Error - ${error instanceof Error ? error.message : 'Unknown'}`)
  } finally {
    stats.processed++
    stats.cost = stats.apiCalls * 0.0006
  }
}

// Process items concurrently
async function processItemsConcurrently(items: any[]) {
  const processing = new Set<Promise<void>>()
  
  for (const item of items) {
    // Check daily limit
    if (stats.processed >= CONFIG.DAILY_LIMIT) {
      console.log('\n⚠️  Daily limit reached')
      break
    }
    
    // Wait if at concurrency limit
    while (processing.size >= CONFIG.CONCURRENT_ITEMS) {
      await Promise.race(processing)
    }
    
    // Start processing
    const promise = processItem(item).then(() => {
      processing.delete(promise)
    })
    
    processing.add(promise)
  }
  
  // Wait for remaining items
  await Promise.all(processing)
}

// Log today's update to database
async function logUpdateRun(errorDetails?: any) {
  if (CONFIG.DRY_RUN) return
  
  const runtime = Math.round((Date.now() - stats.startTime) / 1000)
  
  await supabase
    .from('rating_update_logs')
    .upsert({
      run_date: new Date().toISOString().split('T')[0],
      items_updated: stats.updated + stats.unchanged,
      items_failed: stats.failed,
      api_calls_made: stats.apiCalls,
      total_cost: stats.cost,
      runtime_seconds: runtime,
      error_details: errorDetails
    }, {
      onConflict: 'run_date'
    })
}

// Main function
async function main() {
  console.log('🎬 Scheduled Rating Update Worker')
  console.log('=================================\n')
  
  if (!CONFIG.ENABLED) {
    console.log('❌ Rating updates are disabled (RATING_UPDATE_ENABLED=false)')
    process.exit(0)
  }
  
  if (CONFIG.DRY_RUN) {
    console.log('🧪 DRY RUN MODE - No actual API calls or updates\n')
  }
  
  if (CONFIG.TEST_MODE) {
    console.log('🧪 TEST MODE - Processing only 10 items\n')
  }
  
  try {
    // Get items due for update
    const limit = CONFIG.TEST_MODE ? 10 : CONFIG.BATCH_SIZE
    const { data: items, error } = await supabase.rpc('get_items_due_for_rating_update', {
      p_limit: limit,
      p_dry_run: false
    })
    
    if (error) {
      console.error('Error fetching items:', error)
      await logUpdateRun({ fetch_error: error.message })
      process.exit(1)
    }
    
    if (!items || items.length === 0) {
      console.log('✅ No items due for update')
      await logUpdateRun()
      process.exit(0)
    }
    
    console.log(`📊 Found ${items.length} items due for update\n`)
    
    // Show tier distribution
    const tierCounts: Record<number, number> = {}
    items.forEach(item => {
      tierCounts[item.rating_update_tier] = (tierCounts[item.rating_update_tier] || 0) + 1
    })
    
    console.log('Distribution by tier:')
    Object.entries(tierCounts).forEach(([tier, count]) => {
      console.log(`  Tier ${tier}: ${count} items`)
    })
    console.log()
    
    // Process items
    console.log('🔄 Starting updates...\n')
    await processItemsConcurrently(items)
    
    // Log run
    await logUpdateRun()
    
    // Summary
    const runtime = Math.round((Date.now() - stats.startTime) / 1000)
    console.log('\n' + '='.repeat(50))
    console.log('✅ Update Complete!')
    console.log('='.repeat(50))
    console.log(`Processed: ${stats.processed}`)
    console.log(`Updated: ${stats.updated} (rating changed)`)
    console.log(`Unchanged: ${stats.unchanged} (rating same)`)
    console.log(`Failed: ${stats.failed}`)
    console.log(`API calls: ${stats.apiCalls}`)
    console.log(`Cost: $${stats.cost.toFixed(4)}`)
    console.log(`Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`)
    console.log(`Performance: ${(stats.processed / runtime * 60).toFixed(1)} items/min`)
    
  } catch (error) {
    console.error('Fatal error:', error)
    await logUpdateRun({ fatal_error: error instanceof Error ? error.message : 'Unknown' })
    process.exit(1)
  }
}

// Run the script
main().catch(console.error)