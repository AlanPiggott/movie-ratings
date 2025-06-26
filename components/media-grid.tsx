'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { MediaType } from '@/types'

interface MediaItem {
  id: string
  title: string
  year: number | null
  posterPath: string | null
  mediaType: MediaType
  alsoLikedPercentage: number | null
}

interface MediaGridProps {
  items: MediaItem[]
}

export function MediaGrid({ items }: MediaGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/${item.mediaType === 'MOVIE' ? 'movie' : 'tv'}/${item.id}`}
          className="group relative aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800 hover:ring-2 hover:ring-[#F5C518] transition-all"
        >
          {item.posterPath ? (
            <Image
              src={`https://image.tmdb.org/t/p/w342${item.posterPath}`}
              alt={item.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16.66vw"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-zinc-600 text-sm text-center px-4">{item.title}</span>
            </div>
          )}
          
          {/* Hover overlay with score */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="absolute bottom-0 left-0 right-0 p-3">
              <h3 className="text-white text-sm font-medium mb-1 line-clamp-2">{item.title}</h3>
              {item.year && (
                <p className="text-zinc-400 text-xs mb-1">{item.year}</p>
              )}
              {item.alsoLikedPercentage !== null && (
                <p className="text-[#F5C518] text-sm font-bold">
                  {item.alsoLikedPercentage}% liked
                </p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}