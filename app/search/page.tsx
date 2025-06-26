'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { SearchResultCard } from '@/components/search-result-card'
import { SearchFilters } from '@/components/search-filters'

interface SearchResult {
  id: string
  title: string
  year: number | null
  posterPath: string | null
  mediaType: 'MOVIE' | 'TV_SHOW'
  alsoLikedPercentage: number | null
  overview: string | null
  imdbRating: number | null
}

interface SearchResponse {
  results: SearchResult[]
  total: number
  source: 'database' | 'mixed' | 'external'
  query: string
}

function SearchResults() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const query = searchParams.get('q') || ''
  
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    mediaType: 'all' as 'all' | 'movie' | 'tv',
    minPercentage: null as number | null
  })

  useEffect(() => {
    const fetchResults = async () => {
      if (!query.trim()) {
        setResults([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data: SearchResponse = await response.json()
        
        if (!response.ok) {
          throw new Error('Failed to fetch results')
        }
        
        setResults(data.results || [])
      } catch (err) {
        console.error('Search error:', err)
        setError('Failed to load search results. Please try again.')
        setResults([])
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [query])


  // Apply filters to results
  const filteredResults = results.filter(result => {
    // Media type filter
    if (filters.mediaType !== 'all') {
      const typeMatch = filters.mediaType === 'movie' 
        ? result.mediaType === 'MOVIE' 
        : result.mediaType === 'TV_SHOW'
      if (!typeMatch) return false
    }

    // Minimum percentage filter
    if (filters.minPercentage !== null) {
      if (!result.alsoLikedPercentage || result.alsoLikedPercentage < filters.minPercentage) {
        return false
      }
    }

    return true
  })

  // Generate similar searches
  const getSimilarSearches = () => {
    const words = query.toLowerCase().split(' ')
    const suggestions = []
    
    // Generic suggestions based on query
    if (words.includes('action')) {
      suggestions.push('thriller movies', 'adventure films')
    }
    if (words.includes('comedy')) {
      suggestions.push('funny movies', 'romantic comedy')
    }
    if (words.includes('horror')) {
      suggestions.push('scary movies', 'thriller films')
    }
    
    // Always include some popular searches
    suggestions.push('trending movies', 'popular tv shows', 'new releases')
    
    return Array.from(new Set(suggestions)).slice(0, 3)
  }

  if (!query) {
    return (
      <div className="min-h-screen bg-[#0E0F13] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">No search query</h1>
          <Link href="/" className="text-[#F5C518] hover:underline">
            Go back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0E0F13]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-[#F5C518] hover:underline text-sm mb-4 inline-block">
            ← Back to home
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">
            Search results for "{query}"
          </h1>
          {!loading && (
            <p className="text-zinc-400">
              {filteredResults.length} {filteredResults.length === 1 ? 'result' : 'results'} found
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Filters */}
          <div className="lg:col-span-1">
            <SearchFilters
              onMediaTypeChange={(type) => setFilters(prev => ({ ...prev, mediaType: type }))}
              onMinPercentageChange={(percentage) => setFilters(prev => ({ ...prev, minPercentage: percentage }))}
            />
          </div>

          {/* Results */}
          <div className="lg:col-span-3">
            {loading ? (
              // Loading skeleton
              <div className="grid grid-cols-1 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-zinc-900 rounded-lg p-4 animate-pulse">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="w-full sm:w-32 h-48 bg-zinc-800 rounded-lg" />
                      <div className="flex-1">
                        <div className="h-6 bg-zinc-800 rounded w-3/4 mb-2" />
                        <div className="h-4 bg-zinc-800 rounded w-1/2 mb-4" />
                        <div className="h-16 bg-zinc-800 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              // Error state
              <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-8 text-center">
                <h2 className="text-xl font-bold text-red-400 mb-2">Error</h2>
                <p className="text-zinc-400">{error}</p>
              </div>
            ) : filteredResults.length === 0 ? (
              // Empty state
              <div className="text-center py-16">
                <div className="inline-block p-6 bg-zinc-900 rounded-full mb-6">
                  <svg
                    className="w-12 h-12 text-zinc-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">No results found</h2>
                <p className="text-zinc-400 mb-8 max-w-md mx-auto">
                  {filters.mediaType !== 'all' || filters.minPercentage !== null
                    ? "Try adjusting your filters or search for something else."
                    : `We couldn't find any movies or TV shows matching "${query}".`}
                </p>
                
                {/* Similar searches */}
                <div>
                  <p className="text-sm text-zinc-500 mb-4">Try searching for:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {getSimilarSearches().map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => router.push(`/search?q=${encodeURIComponent(suggestion)}`)}
                        className="px-4 py-2 bg-zinc-900 text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // Results grid
              <div className="grid grid-cols-1 gap-4">
                {filteredResults.map((result) => (
                  <SearchResultCard
                    key={result.id}
                    {...result}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0E0F13] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F5C518]"></div>
      </div>
    }>
      <SearchResults />
    </Suspense>
  )
}