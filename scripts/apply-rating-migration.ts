#!/usr/bin/env npx tsx

// Script to apply the rating tracking migration to the database

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
import { readFileSync } from 'fs'

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
    // Read the migration file
    const migrationPath = pathJoin(process.cwd(), 'supabase/migrations/006_add_rating_tracking.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')
    
    console.log('📄 Migration file loaded')
    console.log(`   Size: ${migrationSQL.length} characters`)
    console.log(`   Lines: ${migrationSQL.split('\n').length}\n`)
    
    // Execute the migration
    console.log('⚡ Executing migration...')
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    }).single()
    
    if (error) {
      // If exec_sql doesn't exist, try direct query (won't work with service key)
      console.error('❌ Migration failed:', error.message)
      console.log('\n💡 To apply this migration:')
      console.log('   1. Use Supabase Dashboard SQL Editor')
      console.log('   2. Or run: npx supabase db push')
      console.log('   3. Or apply directly to your database')
      process.exit(1)
    }
    
    console.log('✅ Migration applied successfully!\n')
    
    // Verify the migration
    console.log('🔍 Verifying migration...')
    
    // Check if columns exist
    const { data: testItem, error: columnError } = await supabase
      .from('media_items')
      .select('id, rating_update_tier, rating_last_updated')
      .limit(1)
      .single()
    
    if (columnError && columnError.message.includes('column')) {
      console.error('❌ Columns not found - migration may have failed')
      process.exit(1)
    }
    
    console.log('✅ New columns verified')
    
    // Check if function exists
    const { error: fnError } = await supabase.rpc('get_items_due_for_rating_update', {
      p_limit: 1,
      p_dry_run: true
    })
    
    if (fnError) {
      console.error('❌ Functions not found - migration may have partially failed')
      process.exit(1)
    }
    
    console.log('✅ Database functions verified')
    console.log('\n🎉 Migration completed successfully!')
    
  } catch (error) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main().catch(console.error)