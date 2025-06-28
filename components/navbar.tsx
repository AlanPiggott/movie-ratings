'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Search, Menu, X, ChevronDown, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'
import Image from 'next/image'

// Genre configurations
const movieGenres = [
  { name: 'Action', slug: 'action' },
  { name: 'Adventure', slug: 'adventure' },
  { name: 'Animation', slug: 'animation' },
  { name: 'Comedy', slug: 'comedy' },
  { name: 'Crime', slug: 'crime' },
  { name: 'Drama', slug: 'drama' },
  { name: 'Fantasy', slug: 'fantasy' },
  { name: 'Horror', slug: 'horror' },
  { name: 'Romance', slug: 'romance' },
  { name: 'Sci-Fi', slug: 'sci-fi' },
  { name: 'Thriller', slug: 'thriller' },
  { name: 'Mystery', slug: 'mystery' },
]

const tvGenres = [
  { name: 'Action & Adventure', slug: 'action-adventure' },
  { name: 'Animation', slug: 'animation' },
  { name: 'Comedy', slug: 'comedy' },
  { name: 'Crime', slug: 'crime' },
  { name: 'Documentary', slug: 'documentary' },
  { name: 'Drama', slug: 'drama' },
  { name: 'Kids', slug: 'kids' },
  { name: 'Mystery', slug: 'mystery' },
  { name: 'Reality', slug: 'reality' },
  { name: 'Sci-Fi & Fantasy', slug: 'sci-fi-fantasy' },
  { name: 'Soap', slug: 'soap' },
  { name: 'Western', slug: 'western' },
]

interface SearchResult {
  id: string
  title: string
  posterPath: string | null
  year: number | null
  mediaType: 'MOVIE' | 'TV_SHOW'
  alsoLikedPercentage: number | null
}

export function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isGenresOpen, setIsGenresOpen] = useState(false)
  const [genreTab, setGenreTab] = useState<'movies' | 'tv'>('movies')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const genresRef = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(searchQuery, 300)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (genresRef.current && !genresRef.current.contains(event.target as Node)) {
        setIsGenresOpen(false)
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false)
        setSearchQuery('')
        setSearchResults([])
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search functionality
  useEffect(() => {
    const searchMovies = async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.results || [])
        }
      } catch (error) {
        console.error('Search error:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }

    searchMovies()
  }, [debouncedQuery])

  const handleSearchResultClick = (result: SearchResult) => {
    const mediaType = result.mediaType === 'MOVIE' ? 'movie' : 'tv'
    router.push(`/${mediaType}/${result.id}`)
    setIsSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])
  }

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Movies', href: '/movies' },
    { name: 'TV Shows', href: '/tv' },
  ]

  return (
    <nav className="navbar bg-[#0E0F13] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Desktop Nav */}
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link href="/" className="font-bold text-xl tracking-wider">
              <span className="text-accent">REAL</span><span className="text-white">REVIEWS.TV</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'text-base font-medium transition-colors hover:text-accent',
                    pathname === link.href ? 'text-white' : 'text-gray-400'
                  )}
                >
                  {link.name}
                </Link>
              ))}

              {/* Genres Dropdown */}
              <div ref={genresRef} className="relative">
                <button
                  onClick={() => setIsGenresOpen(!isGenresOpen)}
                  className={cn(
                    'flex items-center gap-1 text-base font-medium transition-colors hover:text-accent',
                    isGenresOpen ? 'text-white' : 'text-gray-400'
                  )}
                >
                  <span>Genres</span>
                  <ChevronDown className={cn(
                    'w-4 h-4 transition-transform duration-200',
                    isGenresOpen && 'rotate-180'
                  )} />
                </button>

                {/* Mega Menu */}
                {isGenresOpen && (
                  <div className="absolute top-full mt-2 w-[480px] bg-[#1A1B1F] border border-white/10 rounded-lg shadow-xl z-50">
                    {/* Tabs */}
                    <div className="flex border-b border-white/10">
                      <button
                        onClick={() => setGenreTab('movies')}
                        className={cn(
                          'flex-1 px-4 py-3 text-base font-medium transition-colors',
                          genreTab === 'movies'
                            ? 'text-white border-b-2 border-accent'
                            : 'text-gray-400 hover:text-white'
                        )}
                      >
                        Movies
                      </button>
                      <button
                        onClick={() => setGenreTab('tv')}
                        className={cn(
                          'flex-1 px-4 py-3 text-base font-medium transition-colors',
                          genreTab === 'tv'
                            ? 'text-white border-b-2 border-accent'
                            : 'text-gray-400 hover:text-white'
                        )}
                      >
                        TV Shows
                      </button>
                    </div>

                    {/* Genre Lists */}
                    <div className="p-4">
                      <div className="grid grid-cols-2 gap-2">
                        {(genreTab === 'movies' ? movieGenres : tvGenres).map((genre) => (
                          <Link
                            key={genre.slug}
                            href={`/${genreTab === 'movies' ? 'movie' : 'tv'}/genre/${genre.slug}`}
                            className="px-3 py-2 text-base text-gray-300 hover:text-white hover:bg-white/5 rounded transition-colors"
                            onClick={() => setIsGenresOpen(false)}
                          >
                            {genre.name}
                          </Link>
                        ))}
                      </div>

                    </div>
                  </div>
                )}
              </div>
            </nav>
          </div>

          {/* Desktop Search */}
          <div className="hidden lg:block">
            <div ref={searchRef} className="relative">
              {isSearchOpen ? (
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search movies & shows..."
                    className="w-80 h-10 pl-10 pr-4 bg-white/10 border border-white/20 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-accent/50 transition-all duration-200"
                    autoFocus
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <button
                    onClick={() => {
                      setIsSearchOpen(false)
                      setSearchQuery('')
                      setSearchResults([])
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Search Results */}
                  {(searchQuery.length >= 2 || searchResults.length > 0) && (
                    <div className="absolute top-full mt-2 w-full bg-[#1A1B1F] border border-white/10 rounded-lg shadow-xl max-h-[400px] overflow-y-auto">
                      {isSearching ? (
                        <div className="p-4 text-center text-gray-400">
                          <div className="inline-flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                            Searching...
                          </div>
                        </div>
                      ) : searchResults.length > 0 ? (
                        <div className="py-2">
                          {searchResults.slice(0, 8).map((result) => (
                            <button
                              key={result.id}
                              onClick={() => handleSearchResultClick(result)}
                              className="w-full px-4 py-2 flex items-center gap-3 hover:bg-white/5 transition-colors"
                            >
                              <div className="w-10 h-[60px] flex-shrink-0 bg-zinc-800 rounded overflow-hidden">
                                {result.posterPath ? (
                                  <Image
                                    src={`https://image.tmdb.org/t/p/w92${result.posterPath}`}
                                    alt={result.title}
                                    width={40}
                                    height={60}
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
                              <div className="flex-1 text-left">
                                <div className="font-medium text-white text-sm line-clamp-1">{result.title}</div>
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                  {result.year && <span>{result.year}</span>}
                                  <span>•</span>
                                  <span>{result.mediaType === 'MOVIE' ? 'Movie' : 'TV Show'}</span>
                                  {result.alsoLikedPercentage !== null && (
                                    <>
                                      <span>•</span>
                                      <span className="text-accent">{result.alsoLikedPercentage}%</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : searchQuery.length >= 2 ? (
                        <div className="p-4 text-center text-gray-400 text-sm">
                          No results found for "{searchQuery}"
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <Search className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-50 w-80 bg-[#0E0F13] border-r border-white/10 transform transition-transform duration-300 lg:hidden flex flex-col',
        isMenuOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Mobile Menu Header - Fixed */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <Link href="/" className="font-bold text-lg tracking-wider">
            <span className="text-accent">REAL</span><span className="text-white">REVIEWS.TV</span>
          </Link>
          <button
            onClick={() => setIsMenuOpen(false)}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            {/* Mobile Navigation */}
            <nav className="space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'block px-4 py-3 text-base font-medium rounded-lg transition-colors',
                    pathname === link.href
                      ? 'bg-white/10 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  {link.name}
                </Link>
              ))}

              {/* Genres Section */}
              <div className="pt-4 border-t border-white/10">
                <h3 className="px-4 py-2 text-sm font-medium text-gray-500 uppercase tracking-wider">
                  Genres
                </h3>
                <div className="mt-2 space-y-1">
                  <h4 className="px-4 py-2 text-sm font-medium text-white">Movies</h4>
                  {movieGenres.map((genre) => (
                    <Link
                      key={genre.slug}
                      href={`/movie/genre/${genre.slug}`}
                      className="block px-8 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                    >
                      {genre.name}
                    </Link>
                  ))}
                  <h4 className="px-4 py-2 text-sm font-medium text-white mt-4">TV Shows</h4>
                  {tvGenres.map((genre) => (
                    <Link
                      key={genre.slug}
                      href={`/tv/genre/${genre.slug}`}
                      className="block px-8 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors"
                    >
                      {genre.name}
                    </Link>
                  ))}
                </div>
              </div>
            </nav>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}
    </nav>
  )
}