#!/usr/bin/env tsx

// Remove Arcane from database for testing

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'

dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function removeArcane() {
  console.log('🗑️  Removing Arcane from database...')
  
  // First find it
  const { data: arcane, error: findError } = await supabase
    .from('media_items')
    .select('id, tmdb_id, title, also_liked_percentage')
    .ilike('title', '%arcane%')
    .eq('media_type', 'TV_SHOW')
  
  if (findError) {
    console.error('Error finding Arcane:', findError)
    return
  }
  
  if (!arcane || arcane.length === 0) {
    console.log('❌ Arcane not found in database')
    return
  }
  
  console.log('Found entries:')
  arcane.forEach(item => {
    console.log(`- ${item.title} (TMDB: ${item.tmdb_id}, Rating: ${item.also_liked_percentage}%)`)
  })
  
  // Delete them
  for (const item of arcane) {
    const { error: deleteError } = await supabase
      .from('media_items')
      .delete()
      .eq('id', item.id)
    
    if (deleteError) {
      console.error(`Error deleting ${item.title}:`, deleteError)
    } else {
      console.log(`✅ Deleted ${item.title}`)
    }
  }
  
  console.log('\n✨ Done! Arcane has been removed from the database')
}

removeArcane().catch(console.error)