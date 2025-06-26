#!/usr/bin/env tsx

import { supabaseAdmin } from '../lib/supabase'
import fs from 'fs'
import path from 'path'

async function applyMigration() {
  console.log('🔄 Applying database migration...')
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/003_add_media_metadata.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Migration SQL:')
    console.log(migrationSQL)
    console.log('\n')
    
    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    // Execute each statement
    for (const statement of statements) {
      console.log(`⏳ Executing: ${statement.substring(0, 50)}...`)
      
      const { error } = await supabaseAdmin.rpc('exec_sql', {
        sql: statement + ';'
      }).catch(err => ({ error: err }))
      
      if (error) {
        // Try direct execution as fallback
        console.log('📝 Trying alternative method...')
        
        // For ALTER TABLE and CREATE INDEX, we can't use RPC
        // You'll need to run these manually in Supabase SQL Editor
        console.warn(`⚠️  Please run this statement manually in Supabase SQL Editor:`)
        console.warn(statement + ';')
        console.warn('')
      } else {
        console.log('✅ Success!')
      }
    }
    
    console.log('\n✨ Migration instructions complete!')
    console.log('\n📝 Please go to your Supabase Dashboard SQL Editor and run the following statements:')
    console.log('https://supabase.com/dashboard/project/odydmpdogagroxlrhipb/editor')
    console.log('\n--- COPY BELOW ---\n')
    console.log(migrationSQL)
    console.log('\n--- END ---')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
  }
}

// Run the migration
applyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Fatal error:', error)
    process.exit(1)
  })