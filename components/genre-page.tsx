'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { MediaCard } from '@/components/media-card'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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

interface MediaItem {
  id: string
  title: string
  posterPath: string | null
  year: number | null
  alsoLikedPercentage: number | null
  mediaType: 'MOVIE' | 'TV_SHOW'
}

interface PageData {
  items: MediaItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface GenrePageProps {
  genreSlug: string
  mediaType: 'movie' | 'tv'
}

export default function GenrePage({ genreSlug, mediaType }: GenrePageProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Get the display name for the genre
  const genreName = genreMap[genreSlug] || genreSlug.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ')
  
  const currentPage = parseInt(searchParams.get('page') || '1')
  const sortBy = searchParams.get('sort') || 'popularity'
  const scoreMin = searchParams.get('scoreMin') || ''
  const scoreMax = searchParams.get('scoreMax') || ''
  const yearMin = searchParams.get('yearMin') || ''
  const yearMax = searchParams.get('yearMax') || ''
  const pageSize = 24
  
  // Debug: Log filter changes
  useEffect(() => {
    console.log('Genre Page: Filter params changed:', {
      genre: genreSlug,
      scoreMin,
      scoreMax,
      yearMin,
      yearMax,
      sortBy,
      page: currentPage
    })
  }, [genreSlug, scoreMin, scoreMax, yearMin, yearMax, sortBy, currentPage])

  useEffect(() => {
    const fetchGenreMedia = async () => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: pageSize.toString(),
          sort: sortBy,
          mediaType
        })
        
        // Add filters
        if (scoreMin) params.set('scoreMin', scoreMin)
        if (scoreMax) params.set('scoreMax', scoreMax)
        if (yearMin) params.set('yearMin', yearMin)
        if (yearMax) params.set('yearMax', yearMax)

        const response = await fetch(`/api/genres/${genreSlug}/media?${params}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Genre not found')
          }
          throw new Error(`Failed to fetch ${genreName} ${mediaType === 'movie' ? 'movies' : 'TV shows'}`)
        }

        const result = await response.json()
        
        console.log('Genre Page: API Response:', {
          itemCount: result.items?.length || 0,
          total: result.total,
          page: result.page,
          hasItems: (result.items?.length || 0) > 0
        })
        
        setData(result)
      } catch (err) {
        console.error('Error fetching genre media:', err)
        setError(err instanceof Error ? err.message : 'Failed to load content')
      } finally {
        setLoading(false)
      }
    }

    fetchGenreMedia()
  }, [currentPage, sortBy, scoreMin, scoreMax, yearMin, yearMax, genreSlug, genreName, mediaType])

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= (data?.totalPages || 1)) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', page.toString())
      router.push(`?${params.toString()}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Generate page numbers to display
  const getPageNumbers = () => {
    if (!data) return []
    
    const pages: (number | string)[] = []
    const { totalPages } = data
    const maxVisible = 7

    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    // Always show first page
    pages.push(1)

    if (currentPage > 3) {
      pages.push('...')
    }

    // Show pages around current page
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(currentPage + 1, totalPages - 1); i++) {
      pages.push(i)
    }

    if (currentPage < totalPages - 2) {
      pages.push('...')
    }

    // Always show last page
    pages.push(totalPages)

    return pages
  }

  // Debug logging
  useEffect(() => {
    console.log('Genre Page State:', { 
      loading, 
      hasData: !!data,
      itemsLength: data?.items?.length,
      filters: { scoreMin, scoreMax, yearMin, yearMax },
      shouldShowEmpty: !loading && data && data.items.length === 0
    })
  }, [loading, data, scoreMin, scoreMax, yearMin, yearMax])

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
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
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

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Media Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {[...Array(pageSize)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-zinc-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : data ? (
          data.items.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {data.items.map((item) => (
                  <MediaCard
                    key={item.id}
                    id={item.id}
                    title={item.title}
                    year={item.year}
                    posterPath={item.posterPath}
                    mediaType={item.mediaType}
                    alsoLikedPercentage={item.alsoLikedPercentage}
                  />
                ))}
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="mt-12 flex items-center justify-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((page, index) => (
                      <button
                        key={index}
                        onClick={() => typeof page === 'number' ? handlePageChange(page) : null}
                        disabled={page === '...'}
                        className={`px-3 py-1 rounded-lg transition-colors ${
                          page === currentPage
                            ? 'bg-accent text-black font-medium'
                            : page === '...'
                            ? 'text-gray-500 cursor-default'
                            : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === data.totalPages}
                    className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Results Info */}
              <div className="mt-6 text-center text-gray-400 text-sm">
                Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, data.total)} of {data.total} {mediaType === 'movie' ? 'movies' : 'TV shows'}
              </div>
            </>
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
              {(scoreMin !== '0' || scoreMax !== '100' || yearMin !== '1970' || yearMax !== new Date().getFullYear().toString()) && (
                <button
                  onClick={() => {
                    const params = new URLSearchParams()
                    params.set('sort', sortBy)
                    router.push(`?${params.toString()}`)
                  }}
                  className="px-6 py-2.5 bg-accent text-black font-medium rounded-lg hover:bg-accent/90 transition-all"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )
        ) : null}
      </div>
    </div>
  )
}