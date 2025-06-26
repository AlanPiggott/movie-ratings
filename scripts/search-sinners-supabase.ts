import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = 'https://odydmpdogagroxlrhipb.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keWRtcGRvZ2Fncm94bHJoaXBiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDEyMDc1NywiZXhwIjoyMDY1Njk2NzU3fQ.rTD1Dsqv5VHEu82uzruH2RX3sr9AuzMzk15zNA6s_WI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function searchForSinners() {
  try {
    console.log('Searching for movie "Sinners" in the database...\n')
    
    // Search for movies with "Sinners" in the title
    const { data: results, error } = await supabase
      .from('media_items')
      .select(`
        *,
        media_genres (
          genres (
            name
          )
        )
      `)
      .ilike('title', '%Sinners%')
      .eq('media_type', 'MOVIE')
      .order('release_date', { ascending: false })
    
    if (error) {
      console.error('Error searching database:', error)
      return
    }
    
    if (!results || results.length === 0) {
      console.log('No movies found with "Sinners" in the title.')
    } else {
      console.log(`Found ${results.length} movie(s) with "Sinners" in the title:\n`)
      
      results.forEach((movie, index) => {
        console.log(`${index + 1}. ${movie.title}`)
        console.log(`   ID: ${movie.id}`)
        console.log(`   TMDB ID: ${movie.tmdbId}`)
        console.log(`   Release Date: ${movie.releaseDate ? new Date(movie.releaseDate).toLocaleDateString() : 'N/A'}`)
        console.log(`   Also Liked Percentage: ${movie.alsoLikedPercentage !== null ? movie.alsoLikedPercentage + '%' : 'Not available'}`)
        console.log(`   Overview: ${movie.overview ? movie.overview.substring(0, 150) + '...' : 'No overview available'}`)
        console.log(`   Genres: ${movie.media_genres?.map((mg: any) => mg.genres?.name).filter(Boolean).join(', ') || 'No genres'}`)
        console.log(`   Vote Average: ${movie.voteAverage || 'N/A'}`)
        console.log(`   Vote Count: ${movie.voteCount || 'N/A'}`)
        console.log(`   Popularity: ${movie.popularity || 'N/A'}`)
        console.log(`   Runtime: ${movie.runtime ? movie.runtime + ' minutes' : 'N/A'}`)
        console.log(`   Status: ${movie.status || 'N/A'}`)
        console.log(`   Last Searched: ${movie.lastSearched ? new Date(movie.lastSearched).toLocaleString() : 'Never'}`)
        console.log(`   Search Count: ${movie.searchCount}`)
        console.log('-'.repeat(80))
      })
    }
    
    // Also try exact match
    console.log('\nSearching for exact match "Sinners"...')
    const { data: exactMatch, error: exactError } = await supabase
      .from('media_items')
      .select(`
        *,
        media_genres (
          genres (
            name
          )
        )
      `)
      .eq('title', 'Sinners')
      .eq('media_type', 'MOVIE')
      .single()
    
    if (exactError && exactError.code !== 'PGRST116') {
      console.error('Error searching for exact match:', exactError)
    } else if (exactMatch) {
      console.log('\nFound exact match:')
      console.log(`Title: ${exactMatch.title}`)
      console.log(`ID: ${exactMatch.id}`)
      console.log(`TMDB ID: ${exactMatch.tmdbId}`)
      console.log(`Also Liked Percentage: ${exactMatch.alsoLikedPercentage !== null ? exactMatch.alsoLikedPercentage + '%' : 'Not available'}`)
    } else {
      console.log('No exact match found for "Sinners"')
    }
    
  } catch (error) {
    console.error('Error searching for movie:', error)
  }
}

searchForSinners()