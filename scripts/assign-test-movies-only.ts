#!/usr/bin/env npx tsx

// Quick script to assign tiers to just test movies

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'

const envResult = dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })
if (envResult.error) {
  console.error('❌ Error loading .env.local:', envResult.error)
  process.exit(1)
}

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const TEST_MOVIES = [
  'The Dark Knight',
  'Inception', 
  'Interstellar',
  'The Shawshank Redemption',
  'Dune'
]

async function main() {
  console.log('Assigning tiers to test movies...\n')
  
  // Get test movies
  const { data: movies, error } = await supabase
    .from('media_items')
    .select('*')
    .in('title', TEST_MOVIES)
  
  if (!movies) {
    console.error('No test movies found')
    return
  }
  
  console.log(`Found ${movies.length} test movies`)
  
  // Assign tiers based on age
  for (const movie of movies) {
    let tier = 4 // default
    
    if (movie.release_date) {
      const ageInMonths = (Date.now() - new Date(movie.release_date).getTime()) / (1000 * 60 * 60 * 24 * 30)
      
      if (ageInMonths < 6) tier = 1
      else if (ageInMonths < 24) tier = 2
      else if (ageInMonths < 60) tier = 3
      else tier = 4
    }
    
    const { error: updateError } = await supabase
      .from('media_items')
      .update({ 
        rating_update_tier: tier,
        rating_update_priority: 1 // High priority for test movies
      })
      .eq('id', movie.id)
    
    if (!updateError) {
      console.log(`✓ ${movie.title} → Tier ${tier}`)
    }
  }
  
  console.log('\nDone!')
}

main().catch(console.error)