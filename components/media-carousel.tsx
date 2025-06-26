'use client'

import { useRef } from 'react'
import { MediaCard } from './media-card'
import { cn } from '@/lib/utils'

interface MediaItem {
  id: string
  title: string
  year: number | null
  posterPath: string | null
  mediaType: 'MOVIE' | 'TV_SHOW'
  alsoLikedPercentage: number | null
}

interface MediaCarouselProps {
  items: MediaItem[]
  loading?: boolean
  className?: string
}

export function MediaCarousel({ items, loading, className }: MediaCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    
    const scrollAmount = 300
    const currentScroll = scrollRef.current.scrollLeft
    
    scrollRef.current.scrollTo({
      left: direction === 'left' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount,
      behavior: 'smooth'
    })
  }

  if (loading) {
    return (
      <div className={cn("relative", className)}>
        <div className="flex gap-4 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[200px]">
              <div className="aspect-[2/3] bg-zinc-800 rounded-lg animate-pulse" />
              <div className="mt-3 space-y-2">
                <div className="h-4 bg-zinc-800 rounded animate-pulse" />
                <div className="h-3 bg-zinc-800 rounded w-1/2 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!items.length) {
    return null
  }

  return (
    <div className={cn("relative group", className)}>
      {/* Scroll buttons */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2 hover:bg-black"
        aria-label="Scroll left"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity translate-x-1/2 hover:bg-black"
        aria-label="Scroll right"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Carousel container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => (
          <div key={item.id} className="flex-shrink-0 w-[200px]">
            <MediaCard {...item} />
          </div>
        ))}
      </div>
    </div>
  )
}