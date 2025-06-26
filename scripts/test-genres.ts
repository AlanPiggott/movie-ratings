import { supabase } from '../lib/supabase'
import { slugify } from '../lib/utils'

async function testGenreRoutes() {
  console.log('Testing genre functionality...\n')

  try {
    // 1. Test fetching all genres
    console.log('1. Fetching all genres...')
    const { data: genres, error: genreError } = await supabase
      .from('genres')
      .select('*')
      .order('name')

    if (genreError) {
      console.error('Error fetching genres:', genreError)
      return
    }

    console.log(`Found ${genres?.length || 0} genres`)
    
    // Show first 5 genres with their slugs
    genres?.slice(0, 5).forEach(genre => {
      console.log(`  - ${genre.name} → /${slugify(genre.name)}`)
    })

    // 2. Test genre with media count
    console.log('\n2. Testing genre media counts...')
    const { data: genreWithMedia, error: mediaError } = await supabase
      .from('genres')
      .select(`
        *,
        media_genres(
          media_item:media_items(media_type)
        )
      `)
      .eq('name', 'Action')
      .single()

    if (!mediaError && genreWithMedia) {
      const mediaItems = genreWithMedia.media_genres || []
      const movieCount = mediaItems.filter((mg: any) => 
        mg.media_item?.media_type === 'MOVIE'
      ).length
      const tvShowCount = mediaItems.filter((mg: any) => 
        mg.media_item?.media_type === 'TV_SHOW'
      ).length

      console.log(`Action genre:`)
      console.log(`  - Movies: ${movieCount}`)
      console.log(`  - TV Shows: ${tvShowCount}`)
      console.log(`  - Total: ${movieCount + tvShowCount}`)
    }

    // 3. Test fetching media by genre
    console.log('\n3. Testing media fetch by genre...')
    const testGenre = genres?.[0]
    if (testGenre) {
      const { data: mediaItems, error: fetchError, count } = await supabase
        .from('media_items')
        .select(`
          *,
          media_genres!inner(
            genre:genres(*)
          )
        `, { count: 'exact' })
        .eq('media_genres.genre_id', testGenre.id)
        .eq('media_type', 'MOVIE')
        .order('popularity', { ascending: false })
        .limit(5)

      if (!fetchError) {
        console.log(`\nTop 5 movies in "${testGenre.name}" genre:`)
        mediaItems?.forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.title} (${item.release_date?.substring(0, 4) || 'N/A'})`)
          if (item.also_liked_percentage) {
            console.log(`     Audience Score: ${item.also_liked_percentage}%`)
          }
        })
        console.log(`\nTotal movies in this genre: ${count}`)
      }
    }

    // 4. Test slugification
    console.log('\n4. Testing genre slugification:')
    const testCases = [
      'Science Fiction',
      'TV Movie',
      'War & Politics',
      'Sci-Fi & Fantasy',
      'Kids',
      'Action & Adventure'
    ]

    testCases.forEach(name => {
      console.log(`  "${name}" → "${slugify(name)}"`)
    })

    console.log('\n✅ Genre testing complete!')
    
    // URLs to test
    console.log('\n📍 Test these URLs in your browser:')
    console.log('  - http://localhost:3000/genres')
    console.log('  - http://localhost:3000/movie/action')
    console.log('  - http://localhost:3000/movie/science-fiction')
    console.log('  - http://localhost:3000/tv/drama')
    console.log('  - http://localhost:3000/tv/sci-fi-fantasy')

  } catch (error) {
    console.error('Error during testing:', error)
  }
}

// Run the test
testGenreRoutes()