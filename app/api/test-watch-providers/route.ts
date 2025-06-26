import { NextResponse } from 'next/server'
import { tmdbService } from '@/services/tmdb.service'
import { processWatchProviders } from '@/lib/utils/watch-providers'

export async function GET() {
  try {
    // Test with The Dark Knight
    const movieId = 155
    const movieDetails = await tmdbService.getMovieDetails(movieId)
    
    let processedProviders = null
    const detailsWithProviders = movieDetails as any
    if (detailsWithProviders?.['watch/providers']?.results?.US) {
      const mediaInfo = {
        title: 'The Dark Knight',
        year: 2008,
        mediaType: 'movie' as const,
        tmdbId: movieId
      }
      
      processedProviders = processWatchProviders(
        detailsWithProviders['watch/providers'].results.US,
        mediaInfo
      )
    }
    
    return NextResponse.json({
      movie: 'The Dark Knight',
      tmdbId: movieId,
      rawProviders: detailsWithProviders?.['watch/providers']?.results?.US || null,
      processedProviders: processedProviders
    })
  } catch (error) {
    console.error('Error testing watch providers:', error)
    return NextResponse.json(
      { error: 'Failed to test watch providers', details: error },
      { status: 500 }
    )
  }
}