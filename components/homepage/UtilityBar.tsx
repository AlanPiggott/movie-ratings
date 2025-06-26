'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Genre {
  name: string
  slug: string
}

interface Provider {
  id: string
  name: string
  logo: string
}

interface UtilityBarProps {
  genres: Genre[]
  providers?: Provider[]
  mediaType: 'movie' | 'tv'
  activeGenre?: string | null
  onProviderChange?: (providerId: string | null) => void
  onSortChange?: (sort: string) => void
}

const sortOptions = [
  { value: 'trending', label: 'Trending' },
  { value: 'latest', label: 'Latest' },
  { value: 'top-rated', label: 'Top Rated' },
  { value: 'most-liked', label: 'Most Liked' },
]

export function UtilityBar({
  genres,
  providers = [],
  mediaType,
  activeGenre,
  onProviderChange,
  onSortChange
}: UtilityBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [showProviders, setShowProviders] = useState(false)
  const [showSort, setShowSort] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [selectedSort, setSelectedSort] = useState('trending')

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
    }
  }

  useEffect(() => {
    checkScroll()
    const scrollContainer = scrollRef.current
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', checkScroll)
      window.addEventListener('resize', checkScroll)
      return () => {
        scrollContainer.removeEventListener('scroll', checkScroll)
        window.removeEventListener('resize', checkScroll)
      }
    }
  }, [])

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200
      const newScrollLeft = scrollRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount)
      scrollRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      })
    }
  }

  const handleProviderSelect = (providerId: string | null) => {
    setSelectedProvider(providerId)
    onProviderChange?.(providerId)
    setShowProviders(false)
  }

  const handleSortSelect = (sort: string) => {
    setSelectedSort(sort)
    onSortChange?.(sort)
    setShowSort(false)
  }

  return (
    <div className="utility-bar bg-[#0E0F13]/95 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex items-center gap-4 py-4">
          {/* Genre Chips with Scroll */}
          <div className="flex-1 relative">
            <div className="flex items-center">
              {/* Left Arrow */}
              <button
                onClick={() => scroll('left')}
                className={cn(
                  'absolute left-0 z-10 p-2 bg-gradient-to-r from-[#0E0F13] to-transparent',
                  canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>

              {/* Genre Chips Container */}
              <div
                ref={scrollRef}
                className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth px-8"
                style={{ scrollSnapType: 'x mandatory' }}
              >
                {genres.map((genre) => (
                  <Link
                    key={genre.slug}
                    href={`/genres/${mediaType}/${genre.slug}`}
                    className={cn(
                      'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200',
                      'border scroll-snap-align-start',
                      activeGenre === genre.slug
                        ? 'bg-accent text-black border-accent'
                        : 'bg-transparent text-gray-300 border-gray-700 hover:text-white hover:border-gray-500'
                    )}
                    style={{ scrollSnapAlign: 'start' }}
                  >
                    {genre.name}
                  </Link>
                ))}
              </div>

              {/* Right Arrow */}
              <button
                onClick={() => scroll('right')}
                className={cn(
                  'absolute right-0 z-10 p-2 bg-gradient-to-l from-[#0E0F13] to-transparent',
                  canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}
                aria-label="Scroll right"
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-white/20" />

          {/* Providers Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowProviders(!showProviders)
                setShowSort(false)
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              <span>Providers</span>
              <ChevronDown className={cn(
                'w-4 h-4 transition-transform duration-200',
                showProviders && 'rotate-180'
              )} />
            </button>

            {showProviders && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-[#1A1B1F] border border-white/10 rounded-lg shadow-xl z-50">
                <div className="p-2">
                  <button
                    onClick={() => handleProviderSelect(null)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm rounded hover:bg-white/5 transition-colors',
                      selectedProvider === null ? 'text-accent' : 'text-gray-300'
                    )}
                  >
                    All Providers
                  </button>
                  {providers.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => handleProviderSelect(provider.id)}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm rounded hover:bg-white/5 transition-colors flex items-center gap-2',
                        selectedProvider === provider.id ? 'text-accent' : 'text-gray-300'
                      )}
                    >
                      <img
                        src={provider.logo}
                        alt={provider.name}
                        className="w-6 h-6 rounded"
                      />
                      {provider.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-white/20" />

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowSort(!showSort)
                setShowProviders(false)
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              <span>Sort: {sortOptions.find(o => o.value === selectedSort)?.label}</span>
              <ChevronDown className={cn(
                'w-4 h-4 transition-transform duration-200',
                showSort && 'rotate-180'
              )} />
            </button>

            {showSort && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-[#1A1B1F] border border-white/10 rounded-lg shadow-xl z-50">
                <div className="p-2">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleSortSelect(option.value)}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm rounded hover:bg-white/5 transition-colors',
                        selectedSort === option.value ? 'text-accent' : 'text-gray-300'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}