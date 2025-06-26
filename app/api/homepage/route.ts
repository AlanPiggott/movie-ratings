import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Get current date for "now playing" filter
    const sixtyDaysAgo = new Date()
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

    // Execute all queries in parallel for better performance
    const [
      trendingResult,
      nowPlayingResult,
      popularShowsResult,
      allTimeFavoritesResult,
      topRatedMoviesResult,
      topRatedShowsResult
    ] = await Promise.all([
      // Trending movies
      supabaseAdmin
        .from('media_items')
        .select('*')
        .eq('media_type', 'MOVIE')
        .not('also_liked_percentage', 'is', null)
        .order('popularity', { ascending: false })
        .limit(20),

      // Now playing
      supabaseAdmin
        .from('media_items')
        .select('*')
        .eq('media_type', 'MOVIE')
        .gte('release_date', sixtyDaysAgo.toISOString())
        .not('also_liked_percentage', 'is', null)
        .order('release_date', { ascending: false })
        .limit(20),

      // Popular TV shows
      supabaseAdmin
        .from('media_items')
        .select('*')
        .eq('media_type', 'TV_SHOW')
        .not('also_liked_percentage', 'is', null)
        .order('popularity', { ascending: false })
        .limit(20),

      // All-time favorites (90%+ movies)
      supabaseAdmin
        .from('media_items')
        .select('*')
        .eq('media_type', 'MOVIE')
        .gte('also_liked_percentage', 90)
        .order('popularity', { ascending: false })
        .limit(20),

      // Most popular classic movies
      supabaseAdmin
        .from('media_items')
        .select('*')
        .eq('media_type', 'MOVIE')
        .gte('also_liked_percentage', 85)
        .gte('vote_count', 5000)
        .not('release_date', 'is', null)
        .order('vote_count', { ascending: false })
        .order('also_liked_percentage', { ascending: false })
        .limit(20),

      // Most popular TV shows
      supabaseAdmin
        .from('media_items')
        .select('*')
        .eq('media_type', 'TV_SHOW')
        .gte('also_liked_percentage', 85)
        .gte('vote_count', 1000)
        .order('vote_count', { ascending: false })
        .order('also_liked_percentage', { ascending: false })
        .limit(20)
    ])

    // Transform the data
    const transformMediaItems = (items: any[] | null) => {
      if (!items) return []
      
      return items.map(item => ({
        id: item.id,
        tmdbId: item.tmdb_id,
        title: item.title,
        mediaType: item.media_type,
        posterPath: item.poster_path,
        releaseDate: item.release_date,
        year: item.release_date ? new Date(item.release_date).getFullYear() : null,
        alsoLikedPercentage: item.also_liked_percentage,
        voteAverage: item.vote_average,
        overview: item.overview,
        backdropPath: item.backdrop_path,
        runtime: item.runtime
      }))
    }

    const response = NextResponse.json({
      trending: transformMediaItems(trendingResult.data),
      nowPlaying: transformMediaItems(nowPlayingResult.data),
      popularShows: transformMediaItems(popularShowsResult.data),
      allTimeFavorites: transformMediaItems(allTimeFavoritesResult.data),
      topRatedMovies: transformMediaItems(topRatedMoviesResult.data),
      topRatedShows: transformMediaItems(topRatedShowsResult.data)
    })

    // Cache for 5 minutes
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')

    return response
  } catch (error) {
    console.error('Homepage API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch homepage data' },
      { status: 500 }
    )
  }
}