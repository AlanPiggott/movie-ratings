'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { MediaGrid } from '@/components/media-grid'
import type { MediaType } from '@/types'

interface PageProps {
  params: {
    genre: string
  }
}

interface MediaItem {
  id: string
  title: string
  year: number | null
  posterPath: string | null
  mediaType: MediaType
  alsoLikedPercentage: number | null
}

const genreNameMap: Record<string, string> = {
  'action-adventure': 'Action & Adventure',
  'animation': 'Animation',
  'comedy': 'Comedy',
  'crime': 'Crime',
  'documentary': 'Documentary',
  'drama': 'Drama',
  'family': 'Family',
  'kids': 'Kids',
  'mystery': 'Mystery',
  'news': 'News',
  'reality': 'Reality',
  'sci-fi-fantasy': 'Sci-Fi & Fantasy',
  'soap': 'Soap',
  'talk': 'Talk',
  'war-politics': 'War & Politics',
  'western': 'Western'
}

export default function TVGenrePage({ params }: PageProps) {
  const router = useRouter()
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const genreName = genreNameMap[params.genre] || params.genre

  useEffect(() => {
    const fetchGenreItems = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/tv/${params.genre}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch items')
        }

        const data = await response.json()
        setItems(data.items || [])
      } catch (err) {
        console.error('Error fetching genre items:', err)
        setError('Failed to load content')
      } finally {
        setLoading(false)
      }
    }

    fetchGenreItems()
  }, [params.genre])

  return (
    <div className="min-h-screen bg-[#0E0F13]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/"
            className="inline-flex items-center text-zinc-400 hover:text-white transition-colors mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Home
          </Link>
          
          <h1 className="text-4xl font-bold text-white mb-2">
            {genreName} TV Shows
          </h1>
          <p className="text-zinc-400">
            Browse all {genreName.toLowerCase()} TV shows in our collection
          </p>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 mb-8">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-zinc-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : items.length > 0 ? (
          <MediaGrid items={items} />
        ) : (
          <div className="text-center py-20">
            <p className="text-zinc-400">No TV shows found in this genre</p>
          </div>
        )}
      </div>
    </div>
  )
}