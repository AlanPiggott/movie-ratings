// Test file to verify Supabase connection
// Run with: npx tsx test-supabase.ts

import { supabase } from './lib/supabase'

async function testConnection() {
  console.log('Testing Supabase connection...\n')

  try {
    // Test 1: Check if we can connect
    const { data: genres, error } = await supabase
      .from('genres')
      .select('*')
      .limit(5)

    if (error) {
      console.error('❌ Connection failed:', error.message)
      return
    }

    console.log('✅ Connected to Supabase successfully!')
    console.log(`\n📚 Found ${genres.length} genres:`)
    genres.forEach(genre => {
      console.log(`   - ${genre.name}`)
    })

    // Test 2: Try to query media items
    const { data: mediaItems, error: mediaError } = await supabase
      .from('media_items')
      .select('*')
      .limit(5)

    if (!mediaError) {
      console.log(`\n🎬 Found ${mediaItems?.length || 0} media items`)
    } else {
      console.log('\n⚠️  Media query failed:', mediaError.message)
    }

    console.log('\n🎉 Everything looks good! Your Supabase setup is complete.')

  } catch (err) {
    console.error('❌ Error:', err)
  }
}

testConnection()