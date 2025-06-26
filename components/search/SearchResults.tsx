'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface SearchResult {
  id: string
  title: string
  year: number | null
  mediaType: 'MOVIE' | 'TV_SHOW'
  posterPath: string | null
  alsoLikedPercentage: number | null
  imdbRating: number | null
  overview: string | null
}

interface SearchResponse {
  results: SearchResult[]
  source: 'database' | 'mixed' | 'external'
  total: number
  query: string
}

export function SearchResults() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!query) {
      setResults(null)
      return
    }

    const searchMovies = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        
        if (!response.ok) {
          throw new Error('Search failed')
        }
        
        const data: SearchResponse = await response.json()
        setResults(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    searchMovies()
  }, [query])

  if (!query) {
    return null
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-muted-foreground">Searching...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">Error: {error}</p>
      </div>
    )
  }

  if (!results || results.results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No results found for "{query}"</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search info */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          Search Results for "{query}"
        </h2>
        <div className="text-sm text-muted-foreground">
          {results.total} results • Source: {results.source}
        </div>
      </div>

      {/* Results grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {results.results.map((item) => (
          <div
            key={item.id}
            className="group relative overflow-hidden rounded-lg border bg-card transition-all hover:scale-105"
          >
            {/* Poster */}
            <div className="aspect-[2/3] relative bg-muted">
              {item.posterPath ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w500${item.posterPath}`}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <span className="text-4xl text-muted-foreground">🎬</span>
                </div>
              )}
              
              {/* Media type badge */}
              <div className="absolute left-2 top-2">
                <span className={cn(
                  "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
                  item.mediaType === 'MOVIE' 
                    ? "bg-blue-500/80 text-white" 
                    : "bg-purple-500/80 text-white"
                )}>
                  {item.mediaType === 'MOVIE' ? 'Movie' : 'TV Show'}
                </span>
              </div>

              {/* Sentiment score */}
              {item.alsoLikedPercentage !== null && (
                <div className="absolute right-2 top-2">
                  <div className="rounded-md bg-black/80 px-2 py-1 text-sm font-medium text-primary">
                    {item.alsoLikedPercentage}% liked
                  </div>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className="font-semibold line-clamp-1">{item.title}</h3>
              
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                {item.year && <span>{item.year}</span>}
                {item.imdbRating && (
                  <span className="flex items-center gap-1">
                    ⭐ {item.imdbRating.toFixed(1)}
                  </span>
                )}
              </div>

              {item.overview && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                  {item.overview}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}