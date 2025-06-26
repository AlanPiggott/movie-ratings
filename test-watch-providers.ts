import { tmdbService } from './services/tmdb.service'
import { processWatchProviders } from './lib/utils/watch-providers'

async function testWatchProviders() {
  try {
    // Test with a popular movie (The Dark Knight)
    const movieId = 155 // The Dark Knight TMDB ID
    console.log('Fetching details for The Dark Knight...')
    
    const movieDetails = await tmdbService.getMovieDetails(movieId)
    console.log('\nRaw watch providers data:')
    console.log(JSON.stringify(movieDetails['watch/providers'], null, 2))
    
    if (movieDetails['watch/providers']?.results?.US) {
      const mediaInfo = {
        title: 'The Dark Knight',
        year: 2008,
        mediaType: 'movie' as const,
        tmdbId: movieId
      }
      
      const processedProviders = processWatchProviders(
        movieDetails['watch/providers'].results.US,
        mediaInfo
      )
      
      console.log('\nProcessed watch providers:')
      console.log(JSON.stringify(processedProviders, null, 2))
    } else {
      console.log('\nNo US watch providers found')
    }
    
    // Test with a TV show (Breaking Bad)
    const tvId = 1396 // Breaking Bad TMDB ID
    console.log('\n\nFetching details for Breaking Bad...')
    
    const tvDetails = await tmdbService.getTVDetails(tvId)
    console.log('\nRaw watch providers data:')
    console.log(JSON.stringify(tvDetails['watch/providers'], null, 2))
    
    if (tvDetails['watch/providers']?.results?.US) {
      const mediaInfo = {
        title: 'Breaking Bad',
        year: 2008,
        mediaType: 'tv' as const,
        tmdbId: tvId
      }
      
      const processedProviders = processWatchProviders(
        tvDetails['watch/providers'].results.US,
        mediaInfo
      )
      
      console.log('\nProcessed watch providers:')
      console.log(JSON.stringify(processedProviders, null, 2))
    } else {
      console.log('\nNo US watch providers found')
    }
    
  } catch (error) {
    console.error('Error testing watch providers:', error)
  }
}

testWatchProviders()