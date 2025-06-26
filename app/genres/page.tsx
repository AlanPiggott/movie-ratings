'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const movieGenres = [
  { name: 'Action', slug: 'action', description: 'High-octane thrills and explosive entertainment' },
  { name: 'Adventure', slug: 'adventure', description: 'Epic journeys and daring exploits' },
  { name: 'Animation', slug: 'animation', description: 'Animated stories for all ages' },
  { name: 'Comedy', slug: 'comedy', description: 'Laugh-out-loud entertainment' },
  { name: 'Crime', slug: 'crime', description: 'Gritty tales from both sides of the law' },
  { name: 'Documentary', slug: 'documentary', description: 'Real stories that inform and inspire' },
  { name: 'Drama', slug: 'drama', description: 'Powerful stories and emotional journeys' },
  { name: 'Family', slug: 'family', description: 'Entertainment for viewers of all ages' },
  { name: 'Fantasy', slug: 'fantasy', description: 'Magical worlds and mythical adventures' },
  { name: 'History', slug: 'history', description: 'Stories from the past brought to life' },
  { name: 'Horror', slug: 'horror', description: 'Spine-tingling scares and suspense' },
  { name: 'Music', slug: 'music', description: 'Stories told through song and rhythm' },
  { name: 'Mystery', slug: 'mystery', description: 'Puzzling plots and intriguing investigations' },
  { name: 'Romance', slug: 'romance', description: 'Love stories that touch the heart' },
  { name: 'Science Fiction', slug: 'sci-fi', description: 'Futuristic tales and scientific wonders' },
  { name: 'Thriller', slug: 'thriller', description: 'Edge-of-your-seat suspense' },
  { name: 'War', slug: 'war', description: 'Stories of conflict and courage' },
  { name: 'Western', slug: 'western', description: 'Tales from the American frontier' },
]

const tvGenres = [
  { name: 'Action & Adventure', slug: 'action-adventure', description: 'Thrilling series with high stakes' },
  { name: 'Animation', slug: 'animation', description: 'Animated series for all audiences' },
  { name: 'Comedy', slug: 'comedy', description: 'Series that bring the laughs' },
  { name: 'Crime', slug: 'crime', description: 'Police procedurals and criminal investigations' },
  { name: 'Documentary', slug: 'documentary', description: 'Factual series and docuseries' },
  { name: 'Drama', slug: 'drama', description: 'Character-driven narratives' },
  { name: 'Family', slug: 'family', description: 'Shows for the whole family' },
  { name: 'Kids', slug: 'kids', description: 'Content specifically for children' },
  { name: 'Mystery', slug: 'mystery', description: 'Series full of twists and turns' },
  { name: 'News', slug: 'news', description: 'Current events and journalism' },
  { name: 'Reality', slug: 'reality', description: 'Unscripted entertainment' },
  { name: 'Sci-Fi & Fantasy', slug: 'sci-fi-fantasy', description: 'Imaginative worlds and futures' },
  { name: 'Soap', slug: 'soap', description: 'Serialized daytime dramas' },
  { name: 'Talk', slug: 'talk', description: 'Talk shows and interviews' },
  { name: 'War & Politics', slug: 'war-politics', description: 'Political dramas and war series' },
  { name: 'Western', slug: 'western', description: 'Series set in the Old West' },
]

export default function GenresPage() {
  const [activeTab, setActiveTab] = useState<'movies' | 'tv'>('movies')
  const genres = activeTab === 'movies' ? movieGenres : tvGenres
  const mediaType = activeTab === 'movies' ? 'movie' : 'tv'

  return (
    <div className="min-h-screen bg-[#0E0F13]">
      {/* Sticky header with tabs */}
      <div className="sticky top-0 z-40 bg-[#0E0F13] border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Page title */}
          <div className="pt-8 pb-4">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">Browse by Genre</h1>
            <p className="text-xl text-zinc-400">
              Explore our collection of {activeTab === 'movies' ? 'movies' : 'TV shows'} organized by genre
            </p>
          </div>
          
          {/* Tab switcher */}
          <div className="flex border-b border-zinc-800">
            <button
              onClick={() => setActiveTab('movies')}
              className={cn(
                'flex-1 sm:flex-initial px-8 py-4 text-base font-medium transition-all duration-200',
                activeTab === 'movies'
                  ? 'text-white border-b-2 border-[#F5C518] bg-zinc-900/50'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/30'
              )}
            >
              Movie Genres
            </button>
            <button
              onClick={() => setActiveTab('tv')}
              className={cn(
                'flex-1 sm:flex-initial px-8 py-4 text-base font-medium transition-all duration-200',
                activeTab === 'tv'
                  ? 'text-white border-b-2 border-[#F5C518] bg-zinc-900/50'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/30'
              )}
            >
              TV Show Genres
            </button>
          </div>
        </div>
      </div>

      {/* Genre grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {genres.map((genre) => (
            <Link
              key={genre.slug}
              href={`/genres/${mediaType}/${genre.slug}`}
              className="group relative overflow-hidden rounded-xl bg-zinc-900 hover:bg-zinc-800 transition-all duration-300 hover:ring-2 hover:ring-[#F5C518] hover:scale-[1.02]"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-semibold text-white group-hover:text-[#F5C518] transition-colors">
                    {genre.name}
                  </h3>
                  <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-[#F5C518] transform group-hover:translate-x-1 transition-all" />
                </div>
                <p className="text-sm text-zinc-400 line-clamp-2">
                  {genre.description}
                </p>
              </div>
              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#F5C518]/0 to-[#F5C518]/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}