import { NextRequest, NextResponse } from 'next/server'
import { mediaService } from '@/services/database'
import { tmdbService } from '@/services/tmdb.service'

// Cache for 6 hours
const CACHE_DURATION = 6 * 60 * 60 * 1000
let cache: { data: any; timestamp: number } | null = null

export async function GET(request: NextRequest) {
  try {
    // Check cache
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(cache.data)
    }

    // Calculate date ranges
    const today = new Date()
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const todayStr = today.toISOString().split('T')[0]
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

    // Fetch new releases from TMDB
    let newMovies, airingTv
    try {
      [newMovies, airingTv] = await Promise.all([
        // Movies from last 30 days
        tmdbService.discoverMovies({
          'primary_release_date.gte': thirtyDaysAgoStr,
          'primary_release_date.lte': todayStr,
          sort_by: 'popularity.desc'
        }),
        // TV shows currently airing
        tmdbService.discoverTvShows({
          air_date_gte: thirtyDaysAgoStr,
          air_date_lte: todayStr,
          sort_by: 'popularity.desc'
        })
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

    // Transform and save movies
    const moviePromises = newMovies.results.slice(0, 20).map(async (movie) => {
      const transformed = tmdbService.transformSearchResult({
        ...movie,
        media_type: 'movie'
      })
      
      // Save to database
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
        releaseDate: saved.release_date,
        mediaType: 'MOVIE'
      }
    })

    // Transform and save TV shows
    const tvPromises = airingTv.results.slice(0, 20).map(async (show) => {
      const transformed = tmdbService.transformSearchResult({
        ...show,
        media_type: 'tv',
        title: show.name,
        release_date: show.first_air_date
      })
      
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
        releaseDate: saved.release_date,
        mediaType: 'TV_SHOW'
      }
    })

    const [movies, tvShows] = await Promise.all([
      Promise.all(moviePromises),
      Promise.all(tvPromises)
    ])

    // Sort by release date (newest first)
    movies.sort((a, b) => {
      if (!a.releaseDate || !b.releaseDate) return 0
      return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
    })

    tvShows.sort((a, b) => {
      if (!a.releaseDate || !b.releaseDate) return 0
      return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
    })

    const response = {
      movies,
      tvShows,
      lastUpdated: new Date().toISOString()
    }

    // Update cache
    cache = {
      data: response,
      timestamp: Date.now()
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching new releases:', error)
    return NextResponse.json(
      { error: 'Failed to fetch new releases' },
      { status: 500 }
    )
  }
}