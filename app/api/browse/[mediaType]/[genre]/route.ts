import { NextResponse } from 'next/server'
import { createClient } from '@/services/supabase/server'

const genreIdMap: Record<string, number> = {
  'action': 28,
  'adventure': 12,
  'animation': 16,
  'comedy': 35,
  'crime': 80,
  'documentary': 99,
  'drama': 18,
  'family': 10751,
  'fantasy': 14,
  'history': 36,
  'horror': 27,
  'music': 10402,
  'mystery': 9648,
  'romance': 10749,
  'science-fiction': 878,
  'tv-movie': 10770,
  'thriller': 53,
  'war': 10752,
  'western': 37,
  'reality': 10764,
  'sci-fi-fantasy': 10765,
  'action-adventure': 10759,
  'kids': 10762,
  'news': 10763,
  'soap': 10766,
  'talk': 10767,
  'war-politics': 10768
}

export async function GET(
  request: Request,
  { params }: { params: { mediaType: string; genre: string } }
) {
  try {
    const { mediaType, genre } = params
    const genreId = genreIdMap[genre]
    
    if (!genreId) {
      return NextResponse.json({ error: 'Invalid genre' }, { status: 400 })
    }

    const supabase = createClient()
    const mediaTypeEnum = mediaType === 'movie' ? 'MOVIE' : 'TV_SHOW'

    // Query media items by genre
    const { data: items, error } = await supabase
      .from('media_items')
      .select(`
        id,
        tmdb_id,
        title,
        media_type,
        poster_path,
        release_date,
        year,
        also_liked_percentage,
        vote_average,
        overview,
        genres!inner(genre_id)
      `)
      .eq('media_type', mediaTypeEnum)
      .eq('genres.genre_id', genreId)
      .order('popularity', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    // Transform the data
    const transformedItems = (items || []).map(item => ({
      id: item.id,
      title: item.title,
      year: item.year,
      posterPath: item.poster_path,
      mediaType: item.media_type,
      alsoLikedPercentage: item.also_liked_percentage
    }))

    return NextResponse.json(
      { items: transformedItems },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
        }
      }
    )
  } catch (error) {
    console.error('Error in browse API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}