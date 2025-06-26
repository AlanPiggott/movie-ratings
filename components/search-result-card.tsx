'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { cn, createMediaUrl } from '@/lib/utils'
import { AudienceVerdictCompact } from '@/components/audience-verdict'

interface SearchResultCardProps {
  id: string
  title: string
  year: number | null
  posterPath: string | null
  mediaType: 'MOVIE' | 'TV_SHOW'
  alsoLikedPercentage: number | null
  overview: string | null
  imdbRating: number | null
}

export function SearchResultCard({
  id,
  title,
  year,
  posterPath,
  mediaType,
  alsoLikedPercentage,
  overview,
  imdbRating
}: SearchResultCardProps) {
  const [imageError, setImageError] = useState(false)
  const mediaTypeSlug = mediaType === 'MOVIE' ? 'movie' : 'tv'
  const href = createMediaUrl(mediaTypeSlug, title, id)

  // Debug logging
  if (typeof window !== 'undefined') {
    console.log(`SearchResultCard: Generated URL for "${title}": ${href}`)
  }

  return (
    <Link 
      href={href} 
      className="group block bg-zinc-900 rounded-lg overflow-hidden hover:ring-2 hover:ring-[#F5C518] transition-all elevation-01"
    >
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        {/* Poster */}
        <div className="relative w-full sm:w-32 h-48 sm:h-48 flex-shrink-0 bg-zinc-800 rounded-lg overflow-hidden">
          {posterPath && !imageError ? (
            <Image
              src={`https://image.tmdb.org/t/p/w342${posterPath}`}
              alt={title}
              fill
              sizes="(max-width: 640px) 100vw, 128px"
              className="object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
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
                  d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h3 className="font-semibold text-lg text-white group-hover:text-[#F5C518] transition-colors line-clamp-1">
                {title}
              </h3>
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <span>{mediaType === 'MOVIE' ? 'Movie' : 'TV Show'}</span>
                {year && (
                  <>
                    <span>•</span>
                    <span>{year}</span>
                  </>
                )}
              </div>
            </div>

            {/* Audience Verdict Badge */}
            {alsoLikedPercentage !== null && (
              <div className="flex-shrink-0">
                <AudienceVerdictCompact percentage={alsoLikedPercentage} />
              </div>
            )}
          </div>

          {/* Overview */}
          {overview && (
            <p className="text-sm text-zinc-400 line-clamp-2 mb-3">
              {overview}
            </p>
          )}

          {/* Stats and Actions */}
          <div className="flex flex-wrap items-center gap-4">
            {/* IMDb Rating */}
            {imdbRating !== null && imdbRating > 0 && (
              <div className="flex items-center gap-1 text-sm">
                <span className="text-yellow-500">⭐</span>
                <span className="text-white font-medium">{imdbRating.toFixed(1)}</span>
              </div>
            )}

            {/* Where to Watch Button */}
            <button className="text-sm text-[#F5C518] hover:text-[#F5C518]/80 font-medium transition-colors">
              Where to watch →
            </button>
          </div>
        </div>
      </div>
    </Link>
  )
}