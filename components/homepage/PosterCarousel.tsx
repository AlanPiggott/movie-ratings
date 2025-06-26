'use client'

import React, { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'
import { MediaCard } from '@/components/media-card'
import { PosterSkeleton } from '@/components/ui/skeleton'

interface MediaItem {
  id: string
  title: string
  year: number | null
  posterPath: string | null
  mediaType: 'MOVIE' | 'TV_SHOW'
  alsoLikedPercentage: number | null
}

interface PosterCarouselProps {
  title: string
  items: MediaItem[]
  loading?: boolean
  viewAllHref?: string
  className?: string
}

export function PosterCarousel({
  title,
  items,
  loading = false,
  viewAllHref,
  className
}: PosterCarouselProps) {
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
  }, [items])

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const cardWidth = 200 // Approximate card width
      const gap = 16 // Gap between cards
      const visibleCards = Math.floor(scrollRef.current.clientWidth / (cardWidth + gap))
      const scrollAmount = (cardWidth + gap) * Math.max(1, visibleCards - 1)
      
      const newScrollLeft = scrollRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount)
      scrollRef.current.scrollTo({
        left: newScrollLeft,
        behavior: 'smooth'
      })
    }
  }

  return (
    <section className={cn('poster-carousel', className)}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white font-heading">
            {title}
          </h2>
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="group flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-accent transition-colors"
            >
              <span>View All</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>

        {/* Carousel Container */}
        <div className="relative group/carousel">
          {/* Left Arrow - Desktop Only */}
          <button
            onClick={() => scroll('left')}
            className={cn(
              'carousel-arrow absolute left-0 top-1/2 -translate-y-1/2 z-10',
              'w-12 h-24 bg-gradient-to-r from-[#0E0F13] to-transparent',
              'hidden xl:flex items-center justify-start pl-2',
              'transition-opacity duration-200',
              canScrollLeft
                ? 'opacity-0 group-hover/carousel:opacity-100'
                : 'opacity-0 pointer-events-none'
            )}
            aria-label="Scroll left"
          >
            <div className="p-2 bg-black/80 backdrop-blur-sm rounded-full">
              <ChevronLeft className="w-5 h-5 text-white" />
            </div>
          </button>

          {/* Right Arrow - Desktop Only */}
          <button
            onClick={() => scroll('right')}
            className={cn(
              'carousel-arrow absolute right-0 top-1/2 -translate-y-1/2 z-10',
              'w-12 h-24 bg-gradient-to-l from-[#0E0F13] to-transparent',
              'hidden xl:flex items-center justify-end pr-2',
              'transition-opacity duration-200',
              canScrollRight
                ? 'opacity-0 group-hover/carousel:opacity-100'
                : 'opacity-0 pointer-events-none'
            )}
            aria-label="Scroll right"
          >
            <div className="p-2 bg-black/80 backdrop-blur-sm rounded-full">
              <ChevronRight className="w-5 h-5 text-white" />
            </div>
          </button>

          {/* Scroll Container */}
          <div
            ref={scrollRef}
            className="carousel-track flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
            style={{ 
              scrollSnapType: 'x mandatory',
              scrollPaddingLeft: '1rem',
              scrollPaddingRight: '1rem'
            }}
          >
            {loading ? (
              // Loading skeletons
              [...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-[150px] sm:w-[160px] md:w-[180px] xl:w-[200px]"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <PosterSkeleton />
                </div>
              ))
            ) : items.length > 0 ? (
              // Media cards
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex-shrink-0 w-[150px] sm:w-[160px] md:w-[180px] xl:w-[200px]"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <MediaCard
                    id={item.id}
                    title={item.title}
                    year={item.year}
                    posterPath={item.posterPath}
                    mediaType={item.mediaType}
                    alsoLikedPercentage={item.alsoLikedPercentage}
                  />
                </div>
              ))
            ) : (
              // Empty state
              <div className="w-full py-12 text-center text-gray-500">
                No items available
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
    </section>
  )
}