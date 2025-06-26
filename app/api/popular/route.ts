import { NextRequest, NextResponse } from 'next/server'
import { mediaService } from '@/services/database'

// Cache for 6 hours
const CACHE_DURATION = 6 * 60 * 60 * 1000
let cache: { data: any; timestamp: number } | null = null

export async function GET(request: NextRequest) {
  try {
    // Check cache
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return NextResponse.json(cache.data)
    }

    // Get popular movies and TV shows from database
    // Only include items with also_liked_percentage
    const [moviesResult, tvShowsResult] = await Promise.all([
      mediaService.searchMedia('', {
        mediaType: 'MOVIE',
        hasAlsoLiked: true,
        sortBy: 'alsoLikedPercentage',
        sortOrder: 'desc'
      }, {
        limit: 20,
        page: 1
      }),
      mediaService.searchMedia('', {
        mediaType: 'TV_SHOW',
        hasAlsoLiked: true,
        sortBy: 'alsoLikedPercentage',
        sortOrder: 'desc'
      }, {
        limit: 20,
        page: 1
      })
    ])

    // Transform data to required format
    const movies = (moviesResult?.items || []).map(item => ({
      id: item.id,
      tmdbId: item.tmdb_id,
      title: item.title,
      year: item.release_date ? new Date(item.release_date).getFullYear() : null,
      posterPath: item.poster_path,
      voteAverage: item.vote_average,
      alsoLikedPercentage: item.also_liked_percentage,
      overview: item.overview,
      searchCount: item.search_count,
      mediaType: 'MOVIE'
    }))

    const tvShows = (tvShowsResult?.items || []).map(item => ({
      id: item.id,
      tmdbId: item.tmdb_id,
      title: item.title,
      year: item.release_date ? new Date(item.release_date).getFullYear() : null,
      posterPath: item.poster_path,
      voteAverage: item.vote_average,
      alsoLikedPercentage: item.also_liked_percentage,
      overview: item.overview,
      searchCount: item.search_count,
      mediaType: 'TV_SHOW'
    }))

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
    console.error('Error fetching popular content:', error)
    return NextResponse.json(
      { error: 'Failed to fetch popular content' },
      { status: 500 }
    )
  }
}