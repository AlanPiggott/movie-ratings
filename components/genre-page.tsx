import { MediaCard } from '@/components/media-card'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import MediaFilters from '@/components/media-filters'
import Breadcrumbs from '@/components/breadcrumbs'

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

interface GenrePageProps {
  genreSlug: string
  mediaType: 'movie' | 'tv'
  searchParams?: {
    page?: string
    sort?: string
    order?: string
    scoreMin?: string
    scoreMax?: string
    yearMin?: string
    yearMax?: string
  }
}

export default async function GenrePage({ genreSlug, mediaType, searchParams }: GenrePageProps) {
  
  // Get the display name for the genre
  const genreName = genreMap[genreSlug] || genreSlug.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')

  // Pagination and filtering
  const page = parseInt(searchParams?.page || '1')
  const sortBy = searchParams?.sort || 'popularity'
  const scoreMin = searchParams?.scoreMin
  const scoreMax = searchParams?.scoreMax
  const yearMin = searchParams?.yearMin
  const yearMax = searchParams?.yearMax
  const limit = 20
  const offset = (page - 1) * limit

  // First, find the genre ID from the genre name
  const { data: genreData } = await supabaseAdmin
    .from('genres')
    .select('id')
    .eq('name', genreName)
    .single()

  if (!genreData) {
    notFound()
  }

  // Build the query
  let query = supabaseAdmin
    .from('media_items')
    .select(`
      *,
      media_genres!inner(
        genre:genres(*)
      )
    `, { count: 'exact' })
    .eq('media_type', mediaType === 'movie' ? 'MOVIE' : 'TV_SHOW')
    .eq('media_genres.genre_id', genreData.id)
    .not('also_liked_percentage', 'is', null)
  
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
  if (sortBy === 'popularity') {
    query = query.order('popularity', { ascending: false })
  } else if (sortBy === 'alsoLiked') {
    query = query.order('also_liked_percentage', { ascending: false })
  } else if (sortBy === 'releaseDate') {
    query = query.order('release_date', { ascending: false })
  } else if (sortBy === 'releaseDateAsc') {
    query = query.order('release_date', { ascending: true })
  } else if (sortBy === 'title') {
    query = query.order('title', { ascending: true })
  } else if (sortBy === 'titleDesc') {
    query = query.order('title', { ascending: false })
  }
  
  // Apply pagination
  query = query.range(offset, offset + limit - 1)

  const { data: media, count, error } = await query

  if (error || !media) {
    notFound()
  }

  // Transform the data to flatten genres
  const transformedMedia = media.map(item => ({
    ...item,
    genres: item.media_genres?.map((mg: any) => mg.genre) || []
  }))

  const totalPages = Math.ceil((count || 0) / limit)

  return (
    <div className="min-h-screen bg-[#0E0F13] pt-16">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <Breadcrumbs 
            items={[
              { label: 'Home', href: '/' },
              { label: mediaType === 'movie' ? 'Movies' : 'TV Shows', href: mediaType === 'movie' ? '/movies' : '/tv' },
              { label: genreName }
            ]}
          />
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            {genreName} {mediaType === 'movie' ? 'Movies' : 'TV Shows'}
          </h1>
          <p className="text-gray-400">
            Discover the best {genreName.toLowerCase()} {mediaType === 'movie' ? 'movies' : 'TV shows'} rated by audiences
          </p>
        </div>

        {/* Filters */}
        <MediaFilters 
          mediaType={mediaType} 
          currentGenre={genreName}
          showGenreFilter={false}
        />

        {/* Media Grid */}
        {transformedMedia.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {transformedMedia.map((item) => (
              <MediaCard
                key={item.id}
                id={item.id}
                title={item.title}
                posterPath={item.poster_path}
                alsoLikedPercentage={item.also_liked_percentage}
                mediaType={item.media_type}
                year={item.release_date ? new Date(item.release_date).getFullYear() : null}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 space-y-6">
            <div className="text-center space-y-3">
              <p className="text-2xl font-semibold text-white">
                No {genreName.toLowerCase()} {mediaType === 'movie' ? 'movies' : 'TV shows'} found
              </p>
              <p className="text-gray-400 max-w-md mx-auto">
                No {mediaType === 'movie' ? 'movies' : 'TV shows'} match your current filters. Try adjusting your filters or clearing them to see more results.
              </p>
            </div>
            {(scoreMin || scoreMax || yearMin || yearMax) && (
              <Link
                href={`?${new URLSearchParams({
                  ...(sortBy !== 'popularity' && { sort: sortBy })
                }).toString()}`}
                className="inline-block px-6 py-2.5 bg-accent text-black font-medium rounded-lg hover:bg-accent/90 transition-all"
              >
                Clear All Filters
              </Link>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && transformedMedia.length > 0 && (
          <div className="flex justify-center items-center gap-4 mt-12">
            {page > 1 && (
              <Link
                href={`?${new URLSearchParams({
                  page: (page - 1).toString(),
                  ...(sortBy !== 'popularity' && { sort: sortBy }),
                  ...(scoreMin && { scoreMin }),
                  ...(scoreMax && { scoreMax }),
                  ...(yearMin && { yearMin }),
                  ...(yearMax && { yearMax })
                }).toString()}`}
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
              >
                Previous
              </Link>
            )}
            <span className="text-white">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`?${new URLSearchParams({
                  page: (page + 1).toString(),
                  ...(sortBy !== 'popularity' && { sort: sortBy }),
                  ...(scoreMin && { scoreMin }),
                  ...(scoreMax && { scoreMax }),
                  ...(yearMin && { yearMin }),
                  ...(yearMax && { yearMax })
                }).toString()}`}
                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
              >
                Next
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}