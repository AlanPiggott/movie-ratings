import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    // Fetch all genres
    const { data: genres, error } = await supabaseAdmin
      .from('genres')
      .select('*')
      .order('name')
    
    if (error) {
      console.error('Error fetching genres:', error)
      return NextResponse.json(
        { error: 'Failed to fetch genres' },
        { status: 500 }
      )
    }
    
    // For now, return genres with default counts
    // In a production app, you'd want to calculate these counts properly
    const genresWithCounts = (genres || []).map(genre => ({
      ...genre,
      slug: genre.slug || genre.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      movieCount: 10, // Placeholder
      tvShowCount: 5, // Placeholder
      totalCount: 15 // Placeholder
    }))
    
    return NextResponse.json({
      genres: genresWithCounts
    })
  } catch (error) {
    console.error('Error in genres route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}