import { NextResponse } from 'next/server'
import { createClient } from '@/services/supabase/server'

const genreIdMap: Record<string, number> = {
  'action-adventure': 10759,
  'animation': 16,
  'comedy': 35,
  'crime': 80,
  'documentary': 99,
  'drama': 18,
  'family': 10751,
  'kids': 10762,
  'mystery': 9648,
  'news': 10763,
  'reality': 10764,
  'sci-fi-fantasy': 10765,
  'soap': 10766,
  'talk': 10767,
  'war-politics': 10768,
  'western': 37
}

export async function GET(
  request: Request,
  { params }: { params: { genre: string } }
) {
  try {
    const { genre } = params
    const genreId = genreIdMap[genre]
    
    if (!genreId) {
      return NextResponse.json({ error: 'Invalid genre' }, { status: 400 })
    }

    const supabase = createClient()

    // First, get the genre UUID from the TMDB ID
    const { data: genreData, error: genreError } = await supabase
      .from('genres')
      .select('id')
      .eq('tmdb_id', genreId)
      .single()

    if (genreError || !genreData) {
      console.error('Genre lookup error:', genreError)
      return NextResponse.json({ error: 'Genre not found' }, { status: 404 })
    }

    // Query media items by genre UUID
    const { data: items, error } = await supabase
      .from('media_items')
      .select(`
        id,
        tmdb_id,
        title,
        media_type,
        poster_path,
        release_date,
        also_liked_percentage,
        vote_average,
        overview,
        media_genres!inner(genre_id)
      `)
      .eq('media_type', 'TV_SHOW')
      .eq('media_genres.genre_id', genreData.id)
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
      year: item.release_date ? new Date(item.release_date).getFullYear() : null,
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
    console.error('Error in TV genre API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}