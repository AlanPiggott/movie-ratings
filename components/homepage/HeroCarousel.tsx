'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Play, ChevronRight, ChevronLeft } from 'lucide-react'
import { cn, createMediaUrl } from '@/lib/utils'
import AudienceVerdict from '../audience-verdict'

interface HeroSlide {
  id: string
  title: string
  posterPath: string | null
  backdropPath: string | null
  overview: string | null
  releaseDate: string | null
  year: number | null
  alsoLikedPercentage: number | null
  mediaType: 'MOVIE' | 'TV_SHOW'
  genres?: Array<{ id: string; name: string }>
  runtime?: number | null
}

interface HeroCarouselProps {
  slides: HeroSlide[]
  loading?: boolean
}

export function HeroCarousel({ slides, loading = false }: HeroCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  // Auto-advance slides
  useEffect(() => {
    if (!isPaused && slides.length > 1) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % slides.length)
      }, 5000) // 5 seconds per slide

      return () => clearInterval(interval)
    }
  }, [currentSlide, isPaused, slides.length])

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index)
    setIsPaused(true)
    // Resume auto-advance after 10 seconds
    setTimeout(() => setIsPaused(false), 10000)
  }, [])

  const nextSlide = useCallback(() => {
    goToSlide((currentSlide + 1) % slides.length)
  }, [currentSlide, slides.length, goToSlide])

  const prevSlide = useCallback(() => {
    goToSlide((currentSlide - 1 + slides.length) % slides.length)
  }, [currentSlide, slides.length, goToSlide])

  if (loading || slides.length === 0) {
    return (
      <div className="hero-carousel relative w-full h-[500px] bg-zinc-900 animate-pulse rounded-xl" />
    )
  }

  const slide = slides[currentSlide]
  const mediaType = slide.mediaType === 'MOVIE' ? 'movie' : 'tv'
  const detailsUrl = createMediaUrl(mediaType, slide.title, slide.id)

  return (
    <div 
      className="hero-carousel relative w-full h-[500px] rounded-xl overflow-hidden group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Backdrop Image */}
      {slide.backdropPath && (
        <div className="absolute inset-0">
          <Image
            src={`https://image.tmdb.org/t/p/original${slide.backdropPath}`}
            alt={slide.title}
            fill
            priority
            className="object-cover"
          />
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        </div>
      )}

      {/* Content Grid */}
      <div className="relative z-10 h-full grid grid-cols-12 gap-8 p-8 lg:p-12">
        {/* Poster (span-3) */}
        <div className="col-span-3 flex items-center">
          <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden shadow-2xl">
            {slide.posterPath ? (
              <Image
                src={`https://image.tmdb.org/t/p/w500${slide.posterPath}`}
                alt={slide.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                <div className="w-20 h-20 text-zinc-600">
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info (span-9) */}
        <div className="col-span-9 flex flex-col justify-center">
          {/* Title and Rating */}
          <div className="mb-4">
            <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4 line-clamp-2">
              {slide.title}
            </h1>
            
            <div className="flex items-center gap-6">
              {/* Google Rating */}
              {slide.alsoLikedPercentage !== null && (
                <div className="flex items-center gap-3">
                  <AudienceVerdict percentage={slide.alsoLikedPercentage} size="large" />
                  <div className="text-white">
                    <div className="text-2xl font-bold">{slide.alsoLikedPercentage}%</div>
                    <div className="text-sm text-gray-300">Google users liked this</div>
                  </div>
                </div>
              )}

              {/* Year and Runtime */}
              <div className="flex items-center gap-3 text-gray-300">
                {slide.year && <span className="text-lg">{slide.year}</span>}
                {slide.runtime && (
                  <>
                    <span>•</span>
                    <span>{Math.floor(slide.runtime / 60)}h {slide.runtime % 60}m</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Genres */}
          {slide.genres && slide.genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {slide.genres.slice(0, 4).map((genre) => (
                <span
                  key={genre.id}
                  className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-sm text-white border border-white/20"
                >
                  {genre.name}
                </span>
              ))}
            </div>
          )}

          {/* Overview */}
          {slide.overview && (
            <p className="text-gray-200 text-lg leading-relaxed mb-8 line-clamp-3 max-w-3xl">
              {slide.overview}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent/90 text-black font-semibold rounded-full transition-all duration-200 hover:scale-105">
              <Play className="w-5 h-5" fill="currentColor" />
              <span>Watch Trailer</span>
            </button>
            
            <Link
              href={detailsUrl}
              className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-semibold rounded-full border border-white/20 transition-all duration-200 hover:scale-105"
            >
              <span>View Details</span>
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full text-white opacity-0 group-hover:opacity-100 transition-all duration-200"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full text-white opacity-0 group-hover:opacity-100 transition-all duration-200"
            aria-label="Next slide"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Slide Indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-300',
                currentSlide === index
                  ? 'w-8 bg-white'
                  : 'bg-white/40 hover:bg-white/60'
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}