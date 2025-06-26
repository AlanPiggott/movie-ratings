'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Play, Info } from 'lucide-react'
import { createMediaUrl } from '@/lib/utils'
import RadialGauge from '@/components/radial-gauge'
import { HeroSkeleton } from '@/components/ui/skeleton'

interface HeroFeaturedProps {
  featuredItem?: {
    id: string
    title: string
    overview: string | null
    posterPath: string | null
    backdropPath?: string | null
    alsoLikedPercentage: number | null
    mediaType: 'MOVIE' | 'TV_SHOW'
    year: number | null
    genres?: Array<{ id: string; name: string }>
    runtime?: number | null
  }
  loading?: boolean
}

export function HeroFeatured({ featuredItem, loading }: HeroFeaturedProps) {
  const [imageError, setImageError] = useState(false)
  
  if (loading || !featuredItem) {
    return <HeroSkeleton />
  }

  const mediaTypeSlug = featuredItem.mediaType === 'MOVIE' ? 'movie' : 'tv'
  const href = createMediaUrl(mediaTypeSlug, featuredItem.title, featuredItem.id)

  return (
    <section className="hero-featured relative bg-surface-01 rounded-xl overflow-hidden elevation-02 group">
      {/* Backdrop with blur */}
      {featuredItem.backdropPath && !imageError && (
        <div className="hero-backdrop absolute inset-0">
          <Image
            src={`https://image.tmdb.org/t/p/w1280${featuredItem.backdropPath}`}
            alt=""
            fill
            className="object-cover opacity-40 scale-105 group-hover:scale-110 transition-transform duration-700"
            priority
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0E0F13] via-[#0E0F13]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0E0F13] via-[#0E0F13]/60 to-transparent" />
          <div className="absolute inset-0 backdrop-blur-sm" />
        </div>
      )}

      {/* Content Grid */}
      <div className="hero-content relative z-10 grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 p-6 xl:p-12">
        {/* Poster */}
        <div className="xl:col-span-3 mx-auto xl:mx-0">
          <Link href={href} className="block relative group/poster">
            <div className="relative w-48 xl:w-full aspect-[2/3] rounded-lg overflow-hidden bg-zinc-900 elevation-01">
              {featuredItem.posterPath ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w500${featuredItem.posterPath}`}
                  alt={featuredItem.title}
                  fill
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg
                    className="w-16 h-16 text-zinc-600"
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
              <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-lg pointer-events-none" />
              <div className="absolute inset-0 bg-black/0 group-hover/poster:bg-black/20 transition-colors" />
            </div>
          </Link>
        </div>

        {/* Info */}
        <div className="xl:col-span-9 flex flex-col justify-center space-y-6 text-center xl:text-left">
          {/* Title & Meta */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 justify-center xl:justify-start">
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-accent/20 text-accent border border-accent/30">
                Featured {featuredItem.mediaType === 'MOVIE' ? 'Movie' : 'TV Show'}
              </span>
              {featuredItem.year && (
                <span className="text-gray-400">{featuredItem.year}</span>
              )}
            </div>
            
            <h2 className="text-3xl xl:text-5xl font-bold text-white font-heading leading-tight">
              {featuredItem.title}
            </h2>

            {/* Genres */}
            {featuredItem.genres && featuredItem.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center xl:justify-start">
                {featuredItem.genres.slice(0, 3).map(genre => (
                  <span
                    key={genre.id}
                    className="text-sm text-gray-400"
                  >
                    {genre.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Gauge & Overview */}
          <div className="flex flex-col xl:flex-row gap-6 xl:gap-8 items-center xl:items-start">
            {featuredItem.alsoLikedPercentage && (
              <div className="flex-shrink-0">
                <RadialGauge
                  percentage={featuredItem.alsoLikedPercentage}
                  size={100}
                  strokeWidth={6}
                  className="motion-safe:animate-fadeIn"
                />
              </div>
            )}

            {featuredItem.overview && (
              <p className="text-gray-300 text-base xl:text-lg leading-relaxed line-clamp-3 xl:line-clamp-4 max-w-2xl">
                {featuredItem.overview}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-center xl:justify-start">
            <Link
              href={href}
              className="group/btn relative inline-flex items-center gap-2 px-6 py-3 bg-accent text-black font-medium rounded-lg hover:bg-accent/90 transition-colors"
            >
              <Play className="w-5 h-5" fill="currentColor" />
              <span>View Details</span>
            </Link>
            
            <Link
              href={href}
              className="group/btn relative inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white font-medium rounded-lg border border-white/20 hover:bg-white/20 transition-colors"
            >
              <Info className="w-5 h-5" />
              <span>More Info</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}