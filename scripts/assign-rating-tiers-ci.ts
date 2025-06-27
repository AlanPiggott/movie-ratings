#!/usr/bin/env node

// Script to assign rating update tiers to all media items - CI-compatible version
// Run this initially and periodically to reassign tiers as content ages

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
import { existsSync } from 'fs'

// Check if we're in CI environment
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'

// Load environment variables only if .env.local exists (not in CI)
if (!isCI) {
  const envPath = pathJoin(process.cwd(), '.env.local')
  if (existsSync(envPath)) {
    const envResult = dotenvConfig({ path: envPath })
    if (envResult.error) {
      console.error('⚠️  Warning: Could not load .env.local:', envResult.error.message)
    }
  }
}

// Check required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_KEY'
]

const missingEnvVars = requiredEnvVars.filter(key => !process.env[key])
if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars)
  console.error('   Make sure these are set in GitHub Secrets or .env.local')
  process.exit(1)
}

import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Configuration
const TIERS = {
  NEW_RELEASE: 1,      // < 6 months old
  RECENT: 2,           // 6 months - 2 years
  ESTABLISHED: 3,      // 2-5 years
  CLASSIC: 4,          // 5+ years
  NEVER_UPDATE: 5      // Very old with high vote count
}

// Stats tracking
const stats = {
  total: 0,
  tier1: 0,
  tier2: 0,
  tier3: 0,
  tier4: 0,
  tier5: 0,
  errors: 0,
  updated: 0
}

// Calculate age in months from release date
function getAgeInMonths(releaseDate: string | null): number | null {
  if (!releaseDate) return null
  
  const release = new Date(releaseDate)
  const now = new Date()
  const months = (now.getFullYear() - release.getFullYear()) * 12 + 
                 (now.getMonth() - release.getMonth())
  
  return months
}

// Determine tier based on age and other factors
function determineTier(item: any): number {
  const ageInMonths = getAgeInMonths(item.release_date)
  
  // No release date - default to tier 4
  if (ageInMonths === null) {
    return TIERS.CLASSIC
  }
  
  // Check for "never update" criteria
  // Old content with tons of votes that won't change
  if (ageInMonths > 60 && item.vote_count > 10000) {
    return TIERS.NEVER_UPDATE
  }
  
  // Age-based tiers
  if (ageInMonths < 6) {
    return TIERS.NEW_RELEASE
  } else if (ageInMonths < 24) {
    return TIERS.RECENT
  } else if (ageInMonths < 60) {
    return TIERS.ESTABLISHED
  } else {
    return TIERS.CLASSIC
  }
}

// Process a batch of items
async function processBatch(items: any[]): Promise<void> {
  const updates = items.map(item => {
    const tier = determineTier(item)
    
    // Track stats
    stats[`tier${tier}` as keyof typeof stats]++
    
    return {
      id: item.id,
      rating_update_tier: tier,
      // Set priority based on search popularity
      rating_update_priority: item.search_count > 100 ? 1 : 0
    }
  })
  
  // Batch update
  for (const update of updates) {
    const { error } = await supabase
      .from('media_items')
      .update({
        rating_update_tier: update.rating_update_tier,
        rating_update_priority: update.rating_update_priority
      })
      .eq('id', update.id)
    
    if (error) {
      console.error(`Error updating ${update.id}:`, error)
      stats.errors++
    } else {
      stats.updated++
    }
  }
}

// Main function
async function main() {
  console.log('🎬 Rating Tier Assignment Script')
  console.log('================================\n')
  
  if (isCI) {
    console.log('📍 Running in CI environment (GitHub Actions)\n')
  }
  
  const isDryRun = process.argv.includes('--dry-run')
  if (isDryRun) {
    console.log('🧪 DRY RUN MODE - No changes will be made\n')
  }
  
  try {
    // Count total items
    const { count } = await supabase
      .from('media_items')
      .select('*', { count: 'exact', head: true })
    
    console.log(`📊 Total media items: ${count}\n`)
    stats.total = count || 0
    
    // Process in batches
    const batchSize = 1000
    let offset = 0
    
    while (offset < stats.total) {
      console.log(`Processing batch ${offset}-${offset + batchSize}...`)
      
      const { data: items, error } = await supabase
        .from('media_items')
        .select('id, release_date, vote_count, search_count, media_type, title')
        .range(offset, offset + batchSize - 1)
        .order('id')
      
      if (error) {
        console.error('Error fetching batch:', error)
        break
      }
      
      if (!items || items.length === 0) break
      
      if (isDryRun) {
        // Just calculate tiers without updating
        items.forEach(item => {
          const tier = determineTier(item)
          stats[`tier${tier}` as keyof typeof stats]++
        })
      } else {
        await processBatch(items)
      }
      
      offset += batchSize
      
      // Show progress
      if (offset % 5000 === 0) {
        const progress = ((offset / stats.total) * 100).toFixed(1)
        console.log(`Progress: ${progress}% complete`)
      }
    }
    
    // Display results
    console.log('\n✅ Tier Assignment Complete!')
    console.log('============================\n')
    console.log('📊 Distribution by Tier:')
    console.log(`  Tier 1 (New, <6 months):     ${stats.tier1} (${((stats.tier1/stats.total)*100).toFixed(1)}%)`)
    console.log(`  Tier 2 (Recent, 6m-2y):      ${stats.tier2} (${((stats.tier2/stats.total)*100).toFixed(1)}%)`)
    console.log(`  Tier 3 (Established, 2-5y):  ${stats.tier3} (${((stats.tier3/stats.total)*100).toFixed(1)}%)`)
    console.log(`  Tier 4 (Classic, 5y+):       ${stats.tier4} (${((stats.tier4/stats.total)*100).toFixed(1)}%)`)
    console.log(`  Tier 5 (Never update):       ${stats.tier5} (${((stats.tier5/stats.total)*100).toFixed(1)}%)`)
    
    if (!isDryRun) {
      console.log(`\n✅ Updated: ${stats.updated} items`)
      console.log(`❌ Errors: ${stats.errors}`)
    }
    
    // Calculate estimated costs
    const yearlyUpdates = 
      stats.tier1 * 26 +  // bi-weekly
      stats.tier2 * 12 +  // monthly
      stats.tier3 * 4 +   // quarterly
      stats.tier4 * 2     // bi-annually
    
    const yearlyApiCalls = yearlyUpdates * 2 // 2 API calls per update
    const yearlyCost = yearlyApiCalls * 0.0006
    const monthlyCost = yearlyCost / 12
    
    console.log('\n💰 Estimated Costs:')
    console.log(`  Updates per year: ${yearlyUpdates.toLocaleString()}`)
    console.log(`  API calls per year: ${yearlyApiCalls.toLocaleString()}`)
    console.log(`  Cost per year: $${yearlyCost.toFixed(2)}`)
    console.log(`  Cost per month: $${monthlyCost.toFixed(2)}`)
    console.log(`  Cost per day: $${(yearlyCost/365).toFixed(2)}`)
    
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

// Run the script
main().catch(console.error)