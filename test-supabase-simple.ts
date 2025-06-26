// Simple test file that bypasses environment validation
// Run with: npx tsx test-supabase-simple.ts

import { createClient } from '@supabase/supabase-js'

// YOU NEED TO FILL THESE IN!
// Get these from your Supabase dashboard: Settings > API
const SUPABASE_URL = 'https://odydmpdogagroxlrhipb.supabase.co' // <-- REPLACE THIS
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keWRtcGRvZ2Fncm94bHJoaXBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMjA3NTcsImV4cCI6MjA2NTY5Njc1N30.MbEnZxAeFVeuqBGrfnqgo4pwTskdWezWLVBiNY9XN-Q'

async function testConnection() {
  console.log('Testing Supabase connection...\n')

  // Check if you've updated the values
  if (SUPABASE_URL.includes('your-project-id')) {
    console.error('❌ ERROR: You need to update the SUPABASE_URL!')
    console.error('👉 Go to your Supabase dashboard > Settings > API')
    console.error('👉 Copy the "Project URL" and paste it above\n')
    return
  }

  if (SUPABASE_ANON_KEY.includes('your-anon-key')) {
    console.error('❌ ERROR: You need to update the SUPABASE_ANON_KEY!')
    console.error('👉 Go to your Supabase dashboard > Settings > API')
    console.error('👉 Copy the "anon public" key and paste it above\n')
    return
  }

  try {
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // Test 1: Check if we can connect
    const { data: genres, error } = await supabase
      .from('genres')
      .select('*')
      .limit(5)

    if (error) {
      console.error('❌ Connection failed:', error.message)
      console.error('\nPossible issues:')
      console.error('1. Check if your URL and key are correct')
      console.error('2. Make sure you ran the SQL migration')
      console.error('3. Check if your project is still starting up')
      return
    }

    console.log('✅ Connected to Supabase successfully!')
    console.log(`\n📚 Found ${genres.length} genres:`)
    genres.forEach(genre => {
      console.log(`   - ${genre.name}`)
    })

    // Test 2: Check media_items table
    const { count } = await supabase
      .from('media_items')
      .select('*', { count: 'exact', head: true })

    console.log(`\n🎬 Media items in database: ${count || 0}`)

    console.log('\n🎉 Everything looks good! Your Supabase setup is complete.')
    console.log('\n📝 Next steps:')
    console.log('1. Copy these values to your .env.local file:')
    console.log(`   NEXT_PUBLIC_SUPABASE_URL="${SUPABASE_URL}"`)
    console.log(`   NEXT_PUBLIC_SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY}"`)
    console.log('2. Also add your service role key (found in Settings > API > service_role)')
    console.log('3. Then you can start developing your app!')

  } catch (err) {
    console.error('❌ Unexpected error:', err)
  }
}

testConnection()