// Simple test that bypasses environment validation
// Run with: SKIP_ENV_VALIDATION=true npx tsx test-simple-flow.ts

import { createClient } from '@supabase/supabase-js'

// Your credentials (already filled in from .env.local)
const SUPABASE_URL = 'https://odydmpdogagroxlrhipb.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keWRtcGRvZ2Fncm94bHJoaXBiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDEyMDc1NywiZXhwIjoyMDY1Njk2NzU3fQ.rTD1Dsqv5VHEu82uzruH2RX3sr9AuzMzk15zNA6s_WI'
const TMDB_API_KEY = 'f2ce2d9951bc015ad27f8c9661c62bfc'

async function testFlow() {
  console.log('🎬 Simple Movie Test Flow\n')

  // Create Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  try {
    // Step 1: Search TMDB for a movie
    console.log('1️⃣ Searching TMDB for "The Dark Knight"...')
    
    const tmdbResponse = await fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=The%20Dark%20Knight`
    )
    const tmdbData = await tmdbResponse.json()
    
    if (!tmdbData.results || tmdbData.results.length === 0) {
      console.error('❌ No results from TMDB')
      return
    }

    const movie = tmdbData.results[0]
    console.log(`✅ Found: ${movie.title || movie.name}`)
    console.log(`   TMDB ID: ${movie.id}`)
    console.log(`   Type: ${movie.media_type}`)
    console.log(`   Year: ${movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}`)
    console.log(`   Rating: ${movie.vote_average}/10`)

    // Step 2: Check if movie exists in database
    console.log('\n2️⃣ Checking database...')
    
    const { data: existingMovie } = await supabase
      .from('media_items')
      .select('*')
      .eq('tmdb_id', movie.id)
      .single()

    if (existingMovie) {
      console.log('✅ Movie already in database!')
      console.log(`   ID: ${existingMovie.id}`)
      console.log(`   Also Liked: ${existingMovie.also_liked_percentage ? existingMovie.also_liked_percentage + '%' : 'Not yet fetched'}`)
      console.log(`   Search Count: ${existingMovie.search_count}`)
    } else {
      // Step 3: Add to database
      console.log('\n3️⃣ Adding to database...')
      
      const { data: newMovie, error } = await supabase
        .from('media_items')
        .insert({
          tmdb_id: movie.id,
          media_type: movie.media_type === 'movie' ? 'MOVIE' : 'TV_SHOW',
          title: movie.title || movie.name,
          release_date: movie.release_date || movie.first_air_date,
          poster_path: movie.poster_path,
          overview: movie.overview,
          popularity: movie.popularity,
          vote_average: movie.vote_average,
          vote_count: movie.vote_count,
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Error adding to database:', error)
        return
      }

      console.log('✅ Added to database!')
      console.log(`   ID: ${newMovie.id}`)
    }

    // Step 4: Test DataForSEO
    console.log('\n4️⃣ Testing DataForSEO sentiment fetch...')
    console.log('   (This would fetch Google\'s "% liked" score)')
    
    // We'll simulate this since it costs money per request
    console.log('   ⚠️  Skipping actual API call to save costs')
    console.log('   💡 In production, this would search Google for sentiment')

    // Step 5: Show how to access via API
    console.log('\n5️⃣ How to access this movie:')
    console.log('   When server is running (npm run dev):')
    console.log(`   - API: http://localhost:3000/api/media/${existingMovie?.id || 'MOVIE_ID'}`)
    console.log(`   - Web: http://localhost:3000/media/${existingMovie?.id || 'MOVIE_ID'}`)
    
    // Show some stats
    console.log('\n📊 Database Stats:')
    const { count: movieCount } = await supabase
      .from('media_items')
      .select('*', { count: 'exact', head: true })
      .eq('media_type', 'MOVIE')
    
    const { count: tvCount } = await supabase
      .from('media_items')
      .select('*', { count: 'exact', head: true })
      .eq('media_type', 'TV_SHOW')
    
    console.log(`   Movies: ${movieCount || 0}`)
    console.log(`   TV Shows: ${tvCount || 0}`)
    console.log(`   Total: ${(movieCount || 0) + (tvCount || 0)}`)

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testFlow()
  .then(() => {
    console.log('\n✅ Test completed!')
    process.exit(0)
  })
  .catch(error => {
    console.error('❌ Test failed:', error)
    process.exit(1)
  })