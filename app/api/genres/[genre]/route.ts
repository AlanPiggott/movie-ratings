import { NextRequest, NextResponse } from 'next/server'
import { mediaService } from '@/services/database/media.service'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { genre: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const mediaType = searchParams.get('mediaType') as 'MOVIE' | 'TV_SHOW' | null
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sortBy') || 'popularity'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Decode the genre slug back to the original name
    const genreSlug = params.genre
    
    // Enforce lowercase URLs only
    if (genreSlug !== genreSlug.toLowerCase()) {
      return NextResponse.json(
        { error: 'Genre not found. URLs must be lowercase.' },
        { status: 404 }
      )
    }
    
    // Convert slug to proper genre name (handle special cases)
    let genreName = genreSlug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
    
    // Don't allow combo genres with "&"
    if (genreSlug.includes('&') || genreSlug.includes('and')) {
      return NextResponse.json(
        { error: 'Combo genres are not supported. Please use individual genres.' },
        { status: 404 }
      )
    }
    
    // Special case for "Science Fiction" and "TV Movie"
    if (genreSlug === 'science-fiction' || genreSlug === 'sci-fi') {
      genreName = 'Science Fiction'
    } else if (genreSlug === 'tv-movie') {
      genreName = 'TV Movie'
    }

    // Get all genres to find the exact match
    const { data: genres, error: genreError } = await supabase
      .from('genres')
      .select('*')

    if (genreError) {
      return NextResponse.json(
        { error: 'Failed to fetch genres' },
        { status: 500 }
      )
    }

    // Find the genre by exact name match
    const genre = genres?.find(g => g.name === genreName)

    if (!genre) {
      return NextResponse.json(
        { error: 'Genre not found' },
        { status: 404 }
      )
    }

    // Build the query with genre filter
    const offset = (page - 1) * limit

    let query = supabase
      .from('media_items')
      .select(`
        *,
        media_genres!inner(
          genre:genres(*)
        )
      `, { count: 'exact' })
      .eq('media_genres.genre_id', genre.id)

    // Apply media type filter if provided
    if (mediaType) {
      query = query.eq('media_type', mediaType)
    }

    // Apply sorting
    const sortField = sortBy === 'releaseDate' ? 'release_date' : 
                     sortBy === 'alsoLikedPercentage' ? 'also_liked_percentage' :
                     sortBy === 'title' ? 'title' :
                     'popularity'
    
    query = query.order(sortField, { ascending: sortOrder === 'asc' })
    
    // Add secondary sort by popularity for consistency
    if (sortField !== 'popularity') {
      query = query.order('popularity', { ascending: false })
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Genre query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch media items' },
        { status: 500 }
      )
    }

    // Transform the results to include genres properly
    const transformedItems = (data || []).map(item => {
      const genres = item.media_genres?.map((mg: any) => mg.genre).filter(Boolean) || []
      return {
        ...item,
        genres,
        media_genres: undefined
      }
    })

    return NextResponse.json({
      items: transformedItems,
      genre: genre.name,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
      hasMore: page * limit < (count || 0)
    })
  } catch (error) {
    console.error('Genre API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}