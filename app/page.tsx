'use client'

import { useState, useEffect } from 'react'
import { ErrorBoundary } from '@/components/error-boundary'
import { SearchBar } from '@/components/homepage/SearchBar'
import { USPCard } from '@/components/homepage/USPCard'
import { TrustComparison } from '@/components/homepage/TrustComparison'
import { PosterCarousel } from '@/components/homepage/PosterCarousel'
import { Footer } from '@/components/footer'

interface MediaItem {
  id: string
  tmdbId: number
  title: string
  mediaType: 'MOVIE' | 'TV_SHOW'
  posterPath: string | null
  releaseDate: string | null
  year: number | null
  alsoLikedPercentage: number | null
  voteAverage: number | null
  overview: string | null
  backdropPath?: string | null
  genres?: Array<{ id: string; name: string }>
  runtime?: number | null
}

interface HomepageData {
  trending: MediaItem[]
  nowPlaying: MediaItem[]
  popularShows: MediaItem[]
  allTimeFavorites: MediaItem[]
  topRatedMovies: MediaItem[]
  topRatedShows: MediaItem[]
}

export default function HomePage() {
  const [data, setData] = useState<HomepageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000)
        
        const response = await fetch('/api/homepage', {
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch data: ${response.status}`)
        }
        
        const homepageData = await response.json()
        setData(homepageData)
      } catch (err) {
        console.error('Error fetching homepage data:', err)
        if (err instanceof Error && err.name === 'AbortError') {
          setError('Request timed out. Please check your connection.')
        } else {
          setError(err instanceof Error ? err.message : 'Failed to load content')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])


  return (
    <ErrorBoundary>
      <div className="homepage-modern min-h-screen bg-[#0E0F13] flex flex-col">
        <main className="flex-1">
          {/* Hero Section */}
          <div className="max-w-5xl mx-auto px-4 md:px-6 pt-12 pb-8 md:pt-20 md:pb-12">
            {/* Main headline */}
            <div className="text-center mb-8 font-heading leading-tight">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-2">
                Stop trusting critics.
              </h1>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white">
                Search <span className="text-[#4285F4]">real</span> ratings.
              </h1>
            </div>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-gray-400 text-center mb-10 max-w-3xl mx-auto">
              Google collects ratings from millions of viewers.
              <br />
              We made them searchable.
            </p>

            <SearchBar className="w-full" />
          </div>

          {/* Trust Comparison */}
          <TrustComparison />

          {/* Error Message */}
          {error && (
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
              <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 text-center">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Carousel Sections */}
          <div className="space-y-12 md:space-y-16 pb-12 md:pb-20">
            {/* Top-Rated Movies */}
            {data?.topRatedMovies && data.topRatedMovies.length > 0 && (
              <PosterCarousel
                title="Top-Rated Movies (Google 90%+)"
                items={data.topRatedMovies}
                loading={loading}
              />
            )}

            {/* Top-Rated TV Shows */}
            {data?.topRatedShows && data.topRatedShows.length > 0 && (
              <PosterCarousel
                title="Top-Rated TV Shows (Google 90%+)"
                items={data.topRatedShows}
                loading={loading}
              />
            )}

            {/* Trending Now */}
            <PosterCarousel
              title="Trending Now"
              items={data?.trending || []}
              loading={loading}
            />
          </div>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </ErrorBoundary>
  )
}