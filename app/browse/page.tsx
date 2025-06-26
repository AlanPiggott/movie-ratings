'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { MediaCard } from '@/components/media-card'

export default function BrowsePage() {
  const searchParams = useSearchParams()
  const type = searchParams.get('type') || 'movie'
  const genre = searchParams.get('genre') || ''
  
  const [media, setMedia] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [genreName, setGenreName] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [sortBy, setSortBy] = useState('popularity')
  const [sortOrder, setSortOrder] = useState('desc')

  useEffect(() => {
    const fetchData = async () => {
      if (!genre) {
        setError('No genre specified')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const mediaType = type === 'movie' ? 'MOVIE' : 'TV_SHOW'
        const response = await fetch(
          `/api/genres/${genre}?mediaType=${mediaType}&page=${page}&sortBy=${sortBy}&sortOrder=${sortOrder}`
        )
        
        if (!response.ok) {
          throw new Error('Failed to fetch data')
        }
        
        const data = await response.json()
        setMedia(data.items || [])
        setGenreName(data.genre || genre)
        setTotalPages(data.totalPages || 1)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load content')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [type, genre, page, sortBy, sortOrder])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E0F13] flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-800 rounded w-48 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0E0F13] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Error</h1>
          <p className="text-gray-400 mb-4">{error}</p>
          <a href="/" className="text-[#F5C518] hover:underline">
            Go back to home
          </a>
        </div>
      </div>
    )
  }

  const sortOptions = [
    { value: 'popularity', label: 'Most Popular' },
    { value: 'releaseDate', label: 'Release Date' },
    { value: 'alsoLikedPercentage', label: 'Audience Score' },
    { value: 'title', label: 'Title' },
  ]

  return (
    <div className="min-h-screen bg-[#0E0F13]">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 font-['Inter_Tight']">
            {genreName} {type === 'movie' ? 'Movies' : 'TV Shows'}
          </h1>
          <p className="text-gray-400">
            {media.length} results found
          </p>
        </div>

        {/* Sort Controls */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-sm text-gray-400">
              Sort by:
            </label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-zinc-800 text-white px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 text-white rounded-lg text-sm hover:bg-zinc-700 transition-colors"
          >
            {sortOrder === 'asc' ? '↑' : '↓'} {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          </button>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {media.map((item) => (
            <MediaCard
              key={item.id}
              id={item.id}
              title={item.title}
              year={item.release_date ? new Date(item.release_date).getFullYear() : null}
              posterPath={item.poster_path}
              mediaType={item.media_type}
              alsoLikedPercentage={item.also_liked_percentage}
            />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 bg-zinc-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-white">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-4 py-2 bg-zinc-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}