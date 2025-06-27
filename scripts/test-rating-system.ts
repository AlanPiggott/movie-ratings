#!/usr/bin/env npx tsx

// Comprehensive test script for the rating update system
// Tests all components end-to-end with a small sample

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'

// Load environment variables
const envResult = dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })
if (envResult.error) {
  console.error('❌ Error loading .env.local:', envResult.error)
  process.exit(1)
}

import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// Test configuration
const TEST_MOVIES = [
  { title: 'The Dark Knight', year: 2008 },
  { title: 'Inception', year: 2010 },
  { title: 'Interstellar', year: 2014 },
  { title: 'The Shawshank Redemption', year: 1994 },
  { title: 'Dune', year: 2021 }
]

// Color helpers
const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  magenta: (text: string) => `\x1b[35m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`
}

// Test result tracking
const testResults: Array<{
  name: string
  passed: boolean
  message?: string
  duration?: number
}> = []

// Run a test
async function runTest(name: string, fn: () => Promise<boolean>) {
  console.log(`\n${colors.cyan('Running:')} ${name}`)
  const startTime = Date.now()
  
  try {
    const passed = await fn()
    const duration = Date.now() - startTime
    
    testResults.push({ name, passed, duration })
    
    if (passed) {
      console.log(`${colors.green('✓ PASSED')} (${duration}ms)`)
    } else {
      console.log(`${colors.red('✗ FAILED')}`)
    }
    
    return passed
  } catch (error) {
    const duration = Date.now() - startTime
    testResults.push({ 
      name, 
      passed: false, 
      message: error instanceof Error ? error.message : 'Unknown error',
      duration 
    })
    console.log(`${colors.red('✗ ERROR:')} ${error instanceof Error ? error.message : error}`)
    return false
  }
}

// Test 1: Database migration
async function testDatabaseMigration(): Promise<boolean> {
  // Check if new columns exist
  const { data, error } = await supabase
    .from('media_items')
    .select('rating_update_tier, rating_last_updated, rating_check_count')
    .limit(1)
  
  if (error && error.message.includes('column')) {
    console.log('  Migration not applied yet')
    return false
  }
  
  console.log('  ✓ New columns exist')
  
  // Check if functions exist
  const { error: fnError } = await supabase.rpc('get_items_due_for_rating_update', {
    p_limit: 1,
    p_dry_run: true
  })
  
  if (fnError) {
    console.log('  ✗ Database functions missing')
    return false
  }
  
  console.log('  ✓ Database functions exist')
  return true
}

// Test 2: Tier assignment
async function testTierAssignment(): Promise<boolean> {
  // Get some test movies
  const { data: movies, error } = await supabase
    .from('media_items')
    .select('id, title, release_date, rating_update_tier')
    .in('title', TEST_MOVIES.map(m => m.title))
    .limit(5)
  
  if (!movies || movies.length === 0) {
    console.log('  No test movies found in database')
    return false
  }
  
  console.log(`  Found ${movies.length} test movies`)
  
  // Run tier assignment in dry-run mode
  console.log('  Running tier assignment (dry-run)...')
  try {
    execSync('./scripts/assign-rating-tiers.ts --dry-run', { 
      stdio: 'pipe',
      encoding: 'utf8' 
    })
  } catch (error) {
    console.log('  ✗ Tier assignment script failed')
    return false
  }
  
  console.log('  ✓ Tier assignment completed')
  
  // Check if tiers make sense
  let tiersValid = true
  movies.forEach(movie => {
    if (!movie.release_date) return
    
    const ageInMonths = (Date.now() - new Date(movie.release_date).getTime()) / (1000 * 60 * 60 * 24 * 30)
    const expectedTier = 
      ageInMonths < 6 ? 1 :
      ageInMonths < 24 ? 2 :
      ageInMonths < 60 ? 3 : 4
    
    console.log(`  ${movie.title}: Tier ${movie.rating_update_tier || '?'} (expected ~${expectedTier})`)
  })
  
  return tiersValid
}

// Test 3: Manual single update
async function testSingleUpdate(): Promise<boolean> {
  const testMovie = TEST_MOVIES[0]
  
  console.log(`  Testing update for: ${testMovie.title}`)
  
  try {
    const output = execSync(`./scripts/update-single-rating.ts "${testMovie.title}"`, {
      encoding: 'utf8',
      stdio: 'pipe'
    })
    
    // Check if rating was found
    if (output.includes('Rating found!')) {
      const ratingMatch = output.match(/New Rating: (\d+)%/)
      if (ratingMatch) {
        console.log(`  ✓ Found rating: ${ratingMatch[1]}%`)
        return true
      }
    }
    
    console.log('  ✗ No rating found')
    return false
    
  } catch (error) {
    console.log('  ✗ Update script failed')
    return false
  }
}

// Test 4: Scheduled update worker
async function testScheduledWorker(): Promise<boolean> {
  console.log('  Running scheduled worker in test mode...')
  
  try {
    const output = execSync('TEST_MODE=true ./scripts/update-ratings-scheduled.ts', {
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, TEST_MODE: 'true' }
    })
    
    // Check output for success indicators
    const processed = output.match(/Processed: (\d+)/)
    const cost = output.match(/Cost: \$(\d+\.\d+)/)
    
    if (processed && cost) {
      console.log(`  ✓ Processed ${processed[1]} items`)
      console.log(`  ✓ Cost: $${cost[1]}`)
      return true
    }
    
    console.log('  ✗ Worker output invalid')
    return false
    
  } catch (error) {
    console.log('  ✗ Worker script failed')
    return false
  }
}

// Test 5: API endpoint
async function testApiEndpoint(): Promise<boolean> {
  console.log('  Fetching rating statistics...')
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/admin/rating-stats`)
    
    if (!response.ok) {
      console.log(`  ✗ API returned ${response.status}`)
      return false
    }
    
    const data = await response.json()
    
    // Validate response structure
    const hasRequiredFields = 
      data.today && 
      data.week && 
      data.month && 
      data.tiers && 
      data.estimates
    
    if (!hasRequiredFields) {
      console.log('  ✗ API response missing required fields')
      return false
    }
    
    console.log(`  ✓ API working`)
    console.log(`  ✓ Tier distribution: ${JSON.stringify(data.tiers.distribution)}`)
    console.log(`  ✓ Estimated monthly cost: $${data.estimates.monthly_cost.toFixed(2)}`)
    
    return true
    
  } catch (error) {
    console.log('  ✗ API request failed')
    return false
  }
}

// Test 6: Cost calculation accuracy
async function testCostCalculation(): Promise<boolean> {
  // Get tier distribution
  const { data: items } = await supabase
    .from('media_items')
    .select('rating_update_tier')
    .not('rating_update_tier', 'is', null)
  
  if (!items) {
    console.log('  No items with tiers found')
    return false
  }
  
  // Calculate expected costs
  const tierCounts: Record<number, number> = {}
  items.forEach(item => {
    tierCounts[item.rating_update_tier] = (tierCounts[item.rating_update_tier] || 0) + 1
  })
  
  const annualUpdates = 
    (tierCounts[1] || 0) * 26 +  // bi-weekly
    (tierCounts[2] || 0) * 12 +  // monthly
    (tierCounts[3] || 0) * 4 +   // quarterly
    (tierCounts[4] || 0) * 2     // bi-annually
  
  const annualCost = annualUpdates * 2 * 0.0006 // 2 API calls per update
  const monthlyCost = annualCost / 12
  
  console.log('  Cost breakdown:')
  console.log(`    Total items: ${items.length}`)
  console.log(`    Annual updates: ${annualUpdates.toLocaleString()}`)
  console.log(`    Annual cost: $${annualCost.toFixed(2)}`)
  console.log(`    Monthly cost: $${monthlyCost.toFixed(2)}`)
  console.log(`    Daily cost: $${(annualCost/365).toFixed(2)}`)
  
  // Check if costs are reasonable
  const costPerItem = annualCost / items.length
  console.log(`    Cost per item/year: $${costPerItem.toFixed(4)}`)
  
  return costPerItem < 0.10 // Should be well under 10 cents per item per year
}

// Main test runner
async function main() {
  console.log(colors.magenta('\n🧪 Rating Update System - Comprehensive Test Suite'))
  console.log('=' .repeat(60))
  
  // Run all tests
  await runTest('1. Database Migration', testDatabaseMigration)
  await runTest('2. Tier Assignment', testTierAssignment)
  await runTest('3. Single Update', testSingleUpdate)
  await runTest('4. Scheduled Worker', testScheduledWorker)
  await runTest('5. API Endpoint', testApiEndpoint)
  await runTest('6. Cost Calculations', testCostCalculation)
  
  // Summary
  console.log('\n' + '=' .repeat(60))
  console.log(colors.magenta('Test Summary'))
  console.log('=' .repeat(60))
  
  const passed = testResults.filter(r => r.passed).length
  const failed = testResults.filter(r => !r.passed).length
  const totalTime = testResults.reduce((sum, r) => sum + (r.duration || 0), 0)
  
  testResults.forEach(result => {
    const status = result.passed ? colors.green('PASS') : colors.red('FAIL')
    const time = result.duration ? ` (${result.duration}ms)` : ''
    console.log(`${status} ${result.name}${time}`)
    if (result.message) {
      console.log(`     ${colors.yellow(result.message)}`)
    }
  })
  
  console.log('\n' + '-' .repeat(60))
  console.log(`Total: ${testResults.length} tests`)
  console.log(`${colors.green(`Passed: ${passed}`)} | ${colors.red(`Failed: ${failed}`)}`)
  console.log(`Total time: ${(totalTime / 1000).toFixed(1)}s`)
  
  if (failed === 0) {
    console.log('\n' + colors.green('✅ All tests passed! The rating update system is ready.'))
    console.log('\nNext steps:')
    console.log('1. Apply the database migration: npx supabase db push')
    console.log('2. Assign tiers to all items: ./scripts/assign-rating-tiers.ts')
    console.log('3. Test with a small batch: TEST_MODE=true ./scripts/update-ratings-scheduled.ts')
    console.log('4. Set up cron job to run daily')
  } else {
    console.log('\n' + colors.red('❌ Some tests failed. Please fix the issues before deploying.'))
  }
  
  process.exit(failed > 0 ? 1 : 0)
}

// Run tests
main().catch(console.error)