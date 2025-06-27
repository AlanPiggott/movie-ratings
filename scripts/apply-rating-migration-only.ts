#!/usr/bin/env npx tsx

// Script to apply ONLY the rating tracking migration to the database

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

async function main() {
  console.log('🔄 Applying rating tracking migration...\n')
  
  try {
    // First check if the migration was already applied
    const { data: testCheck, error: checkError } = await supabase
      .from('media_items')
      .select('id')
      .limit(1)
    
    if (checkError) {
      console.error('❌ Error connecting to database:', checkError.message)
      process.exit(1)
    }
    
    // Try to select the new columns
    const { error: columnError } = await supabase
      .from('media_items')
      .select('rating_update_tier')
      .limit(1)
    
    if (!columnError) {
      console.log('✅ Migration already applied - columns exist!')
      
      // Verify function exists too
      const { error: fnError } = await supabase.rpc('get_items_due_for_rating_update', {
        p_limit: 1,
        p_dry_run: true
      })
      
      if (!fnError) {
        console.log('✅ Database functions also exist')
        console.log('\n🎉 System is ready to use!')
        process.exit(0)
      }
    }
    
    console.log('📝 Migration not yet applied. Please run the following:')
    console.log('\n1. Go to Supabase Dashboard → SQL Editor')
    console.log('2. Copy and paste the contents of:')
    console.log('   supabase/migrations/006_add_rating_tracking.sql')
    console.log('3. Run the SQL')
    console.log('\nOr use Supabase CLI:')
    console.log('   npx supabase migration up --file supabase/migrations/006_add_rating_tracking.sql')
    
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main().catch(console.error)