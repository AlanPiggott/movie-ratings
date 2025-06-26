'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import Image from 'next/image'

interface SearchResult {
  id: string
  title: string
  posterPath: string | null
  year: number | null
  mediaType: 'MOVIE' | 'TV_SHOW'
  alsoLikedPercentage: number | null
}

interface SearchBarProps {
  className?: string
}

export function SearchBar({ className }: SearchBarProps) {
  const router = useRouter()
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  // Search for results
  useEffect(() => {
    const searchMovies = async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        setResults([])
        return
      }

      setLoading(true)
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
        if (response.ok) {
          const data = await response.json()
          setResults(data.results || [])
        }
      } catch (error) {
        console.error('Search error:', error)
        setResults([])
      } finally {
        setLoading(false)
      }
    }

    searchMovies()
  }, [debouncedQuery])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleResultClick = (result: SearchResult) => {
    const mediaType = result.mediaType === 'MOVIE' ? 'movie' : 'tv'
    router.push(`/${mediaType}/${result.id}`)
    setQuery('')
    setShowResults(false)
  }

  const clearSearch = () => {
    setQuery('')
    setResults([])
    inputRef.current?.focus()
  }

  return (
    <div ref={searchRef} className={cn('search-bar relative', className)}>
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-4 w-5 h-5 text-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowResults(true)
            }}
            onFocus={() => setShowResults(true)}
            placeholder="Search any movie or TV show..."
            className="w-full h-[72px] pl-16 pr-16 bg-white/5 border border-white/10 rounded-full text-xl text-white placeholder-gray-400 focus:outline-none focus:border-accent/50 focus:bg-white/10 focus:shadow-[0_0_40px_rgba(245,197,24,0.15)] transition-all duration-200"
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-6 p-1 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && (query.length >= 2 || results.length > 0) && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#1A1B1F] border border-white/10 rounded-xl shadow-xl max-h-[60vh] overflow-y-auto z-50">
            {loading ? (
              <div className="p-4 text-center text-gray-400">
                <div className="inline-flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  Searching...
                </div>
              </div>
            ) : results.length > 0 ? (
              <div className="py-2">
                {results.slice(0, 8).map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleResultClick(result)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                  >
                    {/* Poster */}
                    <div className="w-12 h-[72px] flex-shrink-0 bg-zinc-800 rounded overflow-hidden">
                      {result.posterPath ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w92${result.posterPath}`}
                          alt={result.title}
                          width={48}
                          height={72}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-6 h-6 text-zinc-600">
                            <svg fill="currentColor" viewBox="0 0 24 24">
                              <path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 text-left">
                      <div className="font-medium text-white line-clamp-1">{result.title}</div>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        {result.year && <span>{result.year}</span>}
                        <span>•</span>
                        <span>{result.mediaType === 'MOVIE' ? 'Movie' : 'TV Show'}</span>
                        {result.alsoLikedPercentage !== null && (
                          <>
                            <span>•</span>
                            <span className="text-accent">{result.alsoLikedPercentage}% liked</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : query.length >= 2 ? (
              <div className="p-8 text-center text-gray-400">
                No results found for "{query}"
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}