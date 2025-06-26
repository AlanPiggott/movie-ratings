'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { debounce } from 'lodash'

interface SearchResult {
  id: string
  title: string
  year: number | null
  posterPath: string | null
  mediaType: 'MOVIE' | 'TV_SHOW'
  alsoLikedPercentage: number | null
}

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await response.json()
        
        if (data.results) {
          setResults(data.results.slice(0, 5)) // Show max 5 results
          setShowDropdown(true)
        }
      } catch (error) {
        console.error('Search error:', error)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300),
    []
  )

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    
    if (value.trim()) {
      setLoading(true)
      debouncedSearch(value)
    } else {
      setResults([])
      setShowDropdown(false)
      setLoading(false)
    }
  }

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`)
      setShowDropdown(false)
    }
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto" ref={dropdownRef}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search movies and TV shows..."
            className="w-full px-6 py-4 pr-12 text-lg bg-zinc-900 border border-zinc-800 rounded-full text-white placeholder-zinc-400 focus:outline-none focus:border-[#F5C518] transition-colors"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-zinc-800 rounded-full transition-colors"
          >
            <svg
              className="w-6 h-6 text-zinc-400"
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
          </button>
        </div>
      </form>

      {/* Search dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden z-50">
          {loading ? (
            <div className="p-4 text-center text-zinc-400">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#F5C518]"></div>
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((result) => (
                <Link
                  key={result.id}
                  href={`/${result.mediaType === 'MOVIE' ? 'movie' : 'tv'}/${result.id}`}
                  onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 transition-colors"
                >
                  {/* Poster thumbnail */}
                  <div className="relative w-12 h-18 flex-shrink-0 bg-zinc-800 rounded overflow-hidden">
                    {result.posterPath ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w92${result.posterPath}`}
                        alt={result.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-zinc-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white truncate">{result.title}</h4>
                      {result.alsoLikedPercentage !== null && (
                        <span className="flex-shrink-0 px-2 py-0.5 text-xs font-bold bg-[#F5C518] text-black rounded">
                          {result.alsoLikedPercentage}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <span>{result.mediaType === 'MOVIE' ? 'Movie' : 'TV Show'}</span>
                      {result.year && (
                        <>
                          <span>•</span>
                          <span>{result.year}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
              
              {/* View all results */}
              <button
                onClick={() => {
                  router.push(`/search?q=${encodeURIComponent(query)}`)
                  setShowDropdown(false)
                }}
                className="w-full px-4 py-3 text-sm text-[#F5C518] hover:bg-zinc-800 transition-colors text-center border-t border-zinc-800"
              >
                View all results
              </button>
            </div>
          ) : query.trim() && !loading ? (
            <div className="p-4 text-center text-zinc-400">
              No results found
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}