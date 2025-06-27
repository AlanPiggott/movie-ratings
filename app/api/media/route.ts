import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '24')
    const sort = searchParams.get('sort') || 'popularity'
    const mediaType = searchParams.get('mediaType') || 'MOVIE'
    const genres = searchParams.get('genres')
    const scoreMin = searchParams.get('scoreMin')
    const scoreMax = searchParams.get('scoreMax')
    const yearMin = searchParams.get('yearMin')
    const yearMax = searchParams.get('yearMax')
    
    // Log filter params for debugging
    console.log('API Filter Params:', {
      genres,
      scoreMin,
      scoreMax,
      yearMin,
      yearMax,
      mediaType,
      sort
    })
    
    // Calculate offset
    const offset = (page - 1) * limit

    // First, handle genre filtering if needed
    let genreIds: string[] = []
    if (genres) {
      const genreNames = genres.split(',').filter(Boolean)
      
      // Limit the number of genres to prevent URL length issues
      if (genreNames.length > 6) {
        return NextResponse.json(
          { error: 'Too many genres selected. Please select up to 6 genres.' },
          { status: 400 }
        )
      }
      
      if (genreNames.length > 0) {
        // Get genre IDs from genre names
        const { data: genreData, error: genreError } = await supabaseAdmin
          .from('genres')
          .select('id')
          .in('name', genreNames)
        
        if (genreError) {
          console.error('Genre lookup error:', genreError)
          throw new Error('Failed to lookup genres')
        } else if (genreData) {
          genreIds = genreData.map(g => g.id)
        }
      }
    }

    // Build the query with optimized genre filtering
    let query
    
    if (genreIds.length > 0) {
      // Use a more efficient query approach with joins
      query = supabaseAdmin
        .from('media_items')
        .select(`
          *,
          media_genres!inner(genre_id)
        `, { count: 'exact' })
        .eq('media_type', mediaType)
        .in('media_genres.genre_id', genreIds)
    } else {
      // Simple query without genre filtering
      query = supabaseAdmin
        .from('media_items')
        .select('*', { count: 'exact' })
        .eq('media_type', mediaType)
    }
    
    // Apply year range filter
    if (yearMin) {
      query = query.gte('release_date', `${yearMin}-01-01`)
    }
    if (yearMax) {
      query = query.lte('release_date', `${yearMax}-12-31`)
    }
    
    // Apply score range filter
    if (scoreMin) {
      query = query.gte('also_liked_percentage', parseInt(scoreMin))
    }
    if (scoreMax) {
      query = query.lte('also_liked_percentage', parseInt(scoreMax))
    }

    // Apply sorting
    switch (sort) {
      case 'popularity':
        query = query.order('popularity', { ascending: false })
        break
      case 'releaseDate':
        query = query.order('release_date', { ascending: false, nullsFirst: false })
          .order('popularity', { ascending: false })
        break
      case 'releaseDateAsc':
        query = query.order('release_date', { ascending: true, nullsFirst: false })
          .order('popularity', { ascending: false })
        break
      case 'alsoLiked':
        query = query.order('also_liked_percentage', { ascending: false, nullsFirst: false })
        break
      case 'title':
        query = query.order('title', { ascending: true })
        break
      case 'titleDesc':
        query = query.order('title', { ascending: false })
        break
      default:
        query = query.order('popularity', { ascending: false })
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('Database error:', error)
      
      // Check if it's a specific error we can handle
      if (error.message && error.message.includes('too many')) {
        return NextResponse.json(
          { error: 'Query too complex. Please try fewer filters.' },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to fetch media items',
          message: error.message || 'Unknown database error'
        },
        { status: 500 }
      )
    }

    console.log('API Response:', {
      itemCount: data?.length || 0,
      totalCount: count || 0,
      page
    })
    
    // Transform the data to match the expected format
    const transformedItems = (data || []).map(item => ({
      id: item.id,
      title: item.title,
      posterPath: item.poster_path,
      releaseDate: item.release_date,
      year: item.release_date ? new Date(item.release_date).getFullYear() : null,
      alsoLikedPercentage: item.also_liked_percentage,
      mediaType: item.media_type,
      popularity: item.popularity,
      voteAverage: item.vote_average,
      voteCount: item.vote_count
    }))
    
    return NextResponse.json({
      items: transformedItems,
      total: count || 0,
      page,
      pageSize: limit,
      totalPages: Math.ceil((count || 0) / limit)
    })
    
  } catch (error: any) {
    console.error('API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error?.message || 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}