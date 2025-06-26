'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { cn, createMediaUrl } from '@/lib/utils'
import { AudienceVerdictCompact } from '@/components/audience-verdict'

interface MediaCardProps {
  id: string
  title: string
  year: number | null
  posterPath: string | null
  mediaType: 'MOVIE' | 'TV_SHOW'
  alsoLikedPercentage: number | null
  className?: string
}

export function MediaCard({
  id,
  title,
  year,
  posterPath,
  mediaType,
  alsoLikedPercentage,
  className
}: MediaCardProps) {
  const [imageError, setImageError] = useState(false)

  const mediaTypeSlug = mediaType === 'MOVIE' ? 'movie' : 'tv'
  const href = createMediaUrl(mediaTypeSlug, title, id)

  return (
    <Link 
      href={href} 
      className={cn("group block", className)}
      onClick={() => {
        console.log(`MediaCard clicked: Navigating to ${href}`)
      }}
    >
      <div className="media-card-enhanced relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-900 elevation-01 transition-all duration-300 group-hover:elevation-02 group-hover:-translate-y-1">
        {/* Audience Verdict badge - Top Left with better visibility */}
        <div className="absolute top-2 left-2 z-10 transition-all duration-300 group-hover:scale-110">
          <AudienceVerdictCompact percentage={alsoLikedPercentage} />
        </div>

        {/* Media type badge - Bottom */}
        <div className="absolute bottom-0 left-0 right-0 z-10 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
          <span className="text-xs font-medium text-white/80">
            {mediaType === 'MOVIE' ? 'Movie' : 'TV Show'}
          </span>
        </div>

        {/* Poster image */}
        {posterPath && !imageError ? (
          <Image
            src={`https://image.tmdb.org/t/p/w342${posterPath}`}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-800">
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

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Title and year */}
      <div className="mt-3 space-y-1">
        <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-[#F5C518] transition-colors">
          {title}
        </h3>
        {year && (
          <p className="text-xs text-zinc-400">{year}</p>
        )}
      </div>
    </Link>
  )
}