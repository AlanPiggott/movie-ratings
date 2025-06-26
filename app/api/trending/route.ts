import { NextRequest, NextResponse } from 'next/server'
import { mediaService } from '@/services/database'
import { tmdbService } from '@/services/tmdb.service'
import type { MediaItemWithGenres } from '@/services/database/media.service'

// Cache for 6 hours
const CACHE_DURATION = 6 * 60 * 60 * 1000
const cache = new Map<string, { data: any; timestamp: number }>()

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeframe = searchParams.get('timeframe') || 'day'
    
    // Validate timeframe
    if (!['day', 'week'].includes(timeframe)) {
      return NextResponse.json(
        { error: 'Invalid timeframe. Use "day" or "week"' },
        { status: 400 }
      )
    }

    // Check cache
    const cacheKey = `trending-${timeframe}`
    const cached = cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data)
    }

    // Fetch trending from TMDB
    let trendingMovies, trendingTv
    try {
      [trendingMovies, trendingTv] = await Promise.all([
        tmdbService.getTrending('movie', timeframe as 'day' | 'week'),
        tmdbService.getTrending('tv', timeframe as 'day' | 'week')
      ])
    } catch (tmdbError) {
      console.error('TMDB API Error:', tmdbError)
      // Return empty results if TMDB fails
      return NextResponse.json({
        movies: [],
        tvShows: [],
        lastUpdated: new Date().toISOString(),
        error: 'TMDB API is not available'
      })
    }

    // Transform and save to database
    const moviePromises = trendingMovies.results.slice(0, 20).map(async (movie) => {
      const transformed = tmdbService.transformSearchResult(movie)
      
      // Save to database to get our internal ID
      const saved = await mediaService.createOrUpdateMedia({
        tmdbId: transformed.tmdbId,
        mediaType: 'MOVIE',
        title: transformed.title,
        releaseDate: transformed.releaseDate,
        posterPath: transformed.posterPath,
        overview: transformed.overview,
        popularity: transformed.popularity,
        voteAverage: transformed.voteAverage,
        voteCount: transformed.voteCount,
      })
      
      return {
        id: saved.id,
        tmdbId: saved.tmdb_id,
        title: saved.title,
        year: saved.release_date ? new Date(saved.release_date).getFullYear() : null,
        posterPath: saved.poster_path,
        voteAverage: saved.vote_average,
        alsoLikedPercentage: saved.also_liked_percentage,
        overview: saved.overview,
        mediaType: 'MOVIE'
      }
    })

    const tvPromises = trendingTv.results.slice(0, 20).map(async (show) => {
      const transformed = tmdbService.transformSearchResult(show)
      
      // Save to database
      const saved = await mediaService.createOrUpdateMedia({
        tmdbId: transformed.tmdbId,
        mediaType: 'TV_SHOW',
        title: transformed.title,
        releaseDate: transformed.releaseDate,
        posterPath: transformed.posterPath,
        overview: transformed.overview,
        popularity: transformed.popularity,
        voteAverage: transformed.voteAverage,
        voteCount: transformed.voteCount,
      })
      
      return {
        id: saved.id,
        tmdbId: saved.tmdb_id,
        title: saved.title,
        year: saved.release_date ? new Date(saved.release_date).getFullYear() : null,
        posterPath: saved.poster_path,
        voteAverage: saved.vote_average,
        alsoLikedPercentage: saved.also_liked_percentage,
        overview: saved.overview,
        mediaType: 'TV_SHOW'
      }
    })

    const [movies, tvShows] = await Promise.all([
      Promise.all(moviePromises),
      Promise.all(tvPromises)
    ])

    const response = {
      movies,
      tvShows,
      lastUpdated: new Date().toISOString()
    }

    // Update cache
    cache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    })

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching trending:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trending content' },
      { status: 500 }
    )
  }
}