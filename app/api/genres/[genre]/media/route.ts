import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Genre mapping for URL to display name
const genreMap: Record<string, string> = {
  'action': 'Action',
  'adventure': 'Adventure',
  'animation': 'Animation',
  'comedy': 'Comedy',
  'crime': 'Crime',
  'documentary': 'Documentary',
  'drama': 'Drama',
  'family': 'Family',
  'fantasy': 'Fantasy',
  'history': 'History',
  'horror': 'Horror',
  'music': 'Music',
  'mystery': 'Mystery',
  'romance': 'Romance',
  'science-fiction': 'Science Fiction',
  'sci-fi': 'Science Fiction',
  'tv-movie': 'TV Movie',
  'thriller': 'Thriller',
  'war': 'War',
  'western': 'Western',
  'action-adventure': 'Action & Adventure',
  'kids': 'Kids',
  'news': 'News',
  'reality': 'Reality',
  'talk': 'Talk',
  'soap': 'Soap',
  'war-politics': 'War & Politics'
}

const querySchema = z.object({
  page: z.string().optional().default('1').transform(val => parseInt(val)),
  limit: z.string().optional().default('24').transform(val => parseInt(val)),
  sort: z.enum(['popularity', 'alsoLiked', 'releaseDate']).optional().default('popularity'),
  mediaType: z.enum(['movie', 'tv']).optional().default('movie'),
  scoreMin: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  scoreMax: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  yearMin: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  yearMax: z.string().optional().transform(val => val ? parseInt(val) : undefined),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { genre: string } }
) {
  try {
    const genreSlug = params.genre
    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const query = querySchema.parse(searchParams)
    
    // Get the display name for the genre
    const genreName = genreMap[genreSlug] || genreSlug.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
    
    // Find the genre ID
    const { data: genreData, error: genreError } = await supabaseAdmin
      .from('genres')
      .select('id')
      .eq('name', genreName)
      .single()
    
    if (genreError || !genreData) {
      return NextResponse.json(
        { error: 'Genre not found' },
        { status: 404 }
      )
    }
    
    const offset = (query.page - 1) * query.limit
    
    // Build the query
    let supabaseQuery = supabaseAdmin
      .from('media_items')
      .select(`
        id,
        tmdb_id,
        media_type,
        title,
        release_date,
        poster_path,
        overview,
        popularity,
        vote_average,
        vote_count,
        also_liked_percentage,
        media_genres!inner(
          genre_id
        )
      `, { count: 'exact' })
      .eq('media_type', query.mediaType === 'movie' ? 'MOVIE' : 'TV_SHOW')
      .eq('media_genres.genre_id', genreData.id)
      .not('also_liked_percentage', 'is', null)
    
    // Apply filters
    if (query.scoreMin !== undefined) {
      supabaseQuery = supabaseQuery.gte('also_liked_percentage', query.scoreMin)
    }
    if (query.scoreMax !== undefined) {
      supabaseQuery = supabaseQuery.lte('also_liked_percentage', query.scoreMax)
    }
    if (query.yearMin !== undefined) {
      supabaseQuery = supabaseQuery.gte('release_date', `${query.yearMin}-01-01`)
    }
    if (query.yearMax !== undefined) {
      supabaseQuery = supabaseQuery.lte('release_date', `${query.yearMax}-12-31`)
    }
    
    // Apply sorting
    switch (query.sort) {
      case 'popularity':
        supabaseQuery = supabaseQuery.order('popularity', { ascending: false })
        break
      case 'alsoLiked':
        supabaseQuery = supabaseQuery.order('also_liked_percentage', { ascending: false })
        break
      case 'releaseDate':
        supabaseQuery = supabaseQuery.order('release_date', { ascending: false })
        break
    }
    
    // Apply pagination
    supabaseQuery = supabaseQuery.range(offset, offset + query.limit - 1)
    
    const { data, count, error } = await supabaseQuery
    
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch media' },
        { status: 500 }
      )
    }
    
    // Transform the data
    const items = data?.map(item => ({
      id: item.id,
      title: item.title,
      posterPath: item.poster_path,
      year: item.release_date ? new Date(item.release_date).getFullYear() : null,
      alsoLikedPercentage: item.also_liked_percentage,
      mediaType: item.media_type
    })) || []
    
    return NextResponse.json({
      items,
      total: count || 0,
      page: query.page,
      pageSize: query.limit,
      totalPages: Math.ceil((count || 0) / query.limit)
    })
    
  } catch (error) {
    console.error('API Error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}