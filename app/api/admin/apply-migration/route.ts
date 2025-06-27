import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { readFileSync } from 'fs'
import { join } from 'path'

// This endpoint applies the rating tracking migration
// Only use in development - remove in production!

export async function POST(request: Request) {
  try {
    // First check if migration already applied
    const { error: checkError } = await supabaseAdmin
      .from('media_items')
      .select('rating_update_tier')
      .limit(1)
    
    if (!checkError) {
      return NextResponse.json({ 
        message: 'Migration already applied',
        status: 'exists' 
      })
    }
    
    // Read migration file
    const migrationPath = join(process.cwd(), 'supabase/migrations/006_add_rating_tracking.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')
    
    // Split into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    const results = []
    const errors = []
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      
      try {
        // Skip if it's just comments
        if (statement.replace(/\s+/g, '').startsWith('--')) continue
        
        // For Supabase, we need to use raw SQL through a different approach
        // This is a workaround - in production, use Supabase migrations
        results.push({
          index: i,
          statement: statement.substring(0, 50) + '...',
          status: 'skipped - use Supabase Dashboard'
        })
      } catch (error) {
        errors.push({
          index: i,
          statement: statement.substring(0, 50) + '...',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    return NextResponse.json({
      message: 'Please apply migration through Supabase Dashboard SQL Editor',
      instructions: [
        '1. Go to https://supabase.com/dashboard/project/odydmpdogagroxlrhipb/sql/new',
        '2. Copy the contents of supabase/migrations/006_add_rating_tracking.sql',
        '3. Paste and run the SQL',
        '4. Then run: ./scripts/test-rating-system.ts to verify'
      ],
      migration_file: 'supabase/migrations/006_add_rating_tracking.sql'
    })
    
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: 'Failed to apply migration', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}