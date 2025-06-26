'use client'

import React, { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Genre {
  name: string
  slug: string
}

interface GenreScrollerProps {
  genres: Genre[]
  activeGenre?: string | null
  mediaType: 'movie' | 'tv'
}

export function GenreScroller({ genres, activeGenre, mediaType }: GenreScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

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

  return (
    <section className="genre-scroller relative">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <h3 className="text-lg font-semibold text-white mb-4">Browse by Genre</h3>
        
        <div className="relative group">
          {/* Left Arrow */}
          <button
            onClick={() => scroll('left')}
            className={cn(
              'absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/80 backdrop-blur-sm rounded-full text-white transition-all duration-200',
              'hidden xl:flex items-center justify-center',
              canScrollLeft
                ? 'opacity-0 group-hover:opacity-100'
                : 'opacity-0 pointer-events-none'
            )}
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Right Arrow */}
          <button
            onClick={() => scroll('right')}
            className={cn(
              'absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/80 backdrop-blur-sm rounded-full text-white transition-all duration-200',
              'hidden xl:flex items-center justify-center',
              canScrollRight
                ? 'opacity-0 group-hover:opacity-100'
                : 'opacity-0 pointer-events-none'
            )}
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Scroll Container */}
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth"
            style={{ scrollSnapType: 'x mandatory', scrollPaddingLeft: '1rem' }}
          >
            {/* All Genres Chip */}
            <Link
              href={`/${mediaType}s`}
              className={cn(
                'genre-chip flex-shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200',
                'border-2 scroll-snap-align-start',
                !activeGenre
                  ? 'genre-chip-active bg-accent text-black border-accent shadow-lg shadow-accent/20'
                  : 'bg-transparent text-gray-300 border-gray-700 hover:text-white hover:border-gray-500'
              )}
              style={{ scrollSnapAlign: 'start' }}
            >
              All Genres
            </Link>

            {/* Genre Chips */}
            {genres.map((genre) => (
              <Link
                key={genre.slug}
                href={`/genres/${mediaType}/${genre.slug}`}
                className={cn(
                  'genre-chip flex-shrink-0 px-5 py-2 rounded-full text-sm font-medium transition-all duration-200',
                  'border-2 scroll-snap-align-start',
                  activeGenre === genre.slug
                    ? 'genre-chip-active bg-accent text-black border-accent shadow-lg shadow-accent/20'
                    : 'bg-transparent text-gray-300 border-gray-700 hover:text-white hover:border-gray-500'
                )}
                style={{ scrollSnapAlign: 'start' }}
              >
                {genre.name}
              </Link>
            ))}
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
    </section>
  )
}