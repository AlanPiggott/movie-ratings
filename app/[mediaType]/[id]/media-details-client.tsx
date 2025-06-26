'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createMediaUrl } from '@/lib/utils'
import { 
  Play, Film, Users, X, Clock, Info
} from 'lucide-react'
import RadialGauge from '@/components/radial-gauge'
import Breadcrumbs from '@/components/breadcrumbs'
import { useRatingRequest } from '@/lib/rating-requests'
import { AudienceVerdictCompact } from '@/components/audience-verdict'

interface MediaDetails {
  id: string
  tmdb_id: number
  media_type: 'MOVIE' | 'TV_SHOW'
  title: string
  release_date: string | null
  poster_path: string | null
  overview: string | null
  also_liked_percentage: number | null
  vote_average: number | null
  vote_count: number | null
  runtime: number | null
  status: string | null
  original_title: string | null
  popularity: number
  genres: Array<{ id: string; name: string }>
  homepage?: string | null
  tagline?: string | null
  number_of_seasons?: number
  number_of_episodes?: number
  budget?: number
  revenue?: number
  production_companies?: Array<{ name: string; logo_path: string | null }>
  spoken_languages?: Array<{ english_name: string }>
  networks?: Array<{ name: string; logo_path: string | null }>
  created_by?: Array<{ name: string }>
  last_air_date?: string
  in_production?: boolean
  updated_at?: string
  credits?: {
    cast: Array<{
      id: number
      name: string
      character: string
      profile_path: string | null
      order: number
    }>
    crew: Array<{
      id: number
      name: string
      job: string
      profile_path: string | null
    }>
  }
  videos?: Array<{
    key: string
    name: string
    type: string
    site: string
  }>
  watch_providers?: {
    flatrate?: Array<{ provider_name: string; logo_path: string }>
    rent?: Array<{ provider_name: string; logo_path: string }>
    buy?: Array<{ provider_name: string; logo_path: string }>
  }
  similar?: Array<{
    id: string
    title: string
    poster_path: string | null
    vote_average: number | null
    also_liked_percentage: number | null
    media_type: 'MOVIE' | 'TV_SHOW'
  }>
}

interface MediaDetailsClientProps {
  initialMedia: MediaDetails
}

export default function MediaDetailsClient({ initialMedia }: MediaDetailsClientProps) {
  const router = useRouter()
  const [media, setMedia] = useState<MediaDetails>(initialMedia)
  const [showTrailer, setShowTrailer] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [showGaugeTooltip, setShowGaugeTooltip] = useState(false)
  const [showRatingInfo, setShowRatingInfo] = useState(false)

  // Use rating request hook
  const { requestStatus, percentage: fetchedPercentage, handleRequestRating } = useRatingRequest(
    media.id,
    media.also_liked_percentage !== null && media.also_liked_percentage > 0
  )
  
  // Update media percentage if fetched
  useEffect(() => {
    if (fetchedPercentage !== null && media.also_liked_percentage === null) {
      setMedia(prev => ({
        ...prev,
        also_liked_percentage: fetchedPercentage
      }))
    }
  }, [fetchedPercentage, media.also_liked_percentage])

  const releaseYear = media.release_date ? new Date(media.release_date).getFullYear() : null
  const isUpcoming = media.release_date && new Date(media.release_date) > new Date()
  const mainTrailer = media.videos?.find(v => v.type === 'Trailer') || media.videos?.[0]
  const director = media.credits?.crew.find(c => c.job === 'Director')
  const writers = media.credits?.crew.filter(c => c.job === 'Writer' || c.job === 'Screenplay').slice(0, 3)
  const topCast = media.credits?.cast.slice(0, 3)
  const videoCount = media.videos?.length || 0
  const hours = media.runtime ? Math.floor(media.runtime / 60) : 0
  const minutes = media.runtime ? media.runtime % 60 : 0
  const formattedRuntime = media.runtime ? hours + 'h ' + minutes + 'm' : null

  // Check if any details exist
  const hasDetails = !!(
    director ||
    (writers && writers.length > 0) ||
    (media.production_companies && media.production_companies.length > 0) ||
    (media.original_title && media.original_title !== media.title) ||
    (media.spoken_languages && media.spoken_languages.length > 0) ||
    (media.budget && media.budget > 0) ||
    (media.revenue && media.revenue > 0) ||
    (media.media_type === 'TV_SHOW' && (
      (media.created_by && media.created_by.length > 0) ||
      (media.networks && media.networks.length > 0) ||
      media.number_of_seasons ||
      media.number_of_episodes
    ))
  )

  // Close rating info tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.rating-info-button') && showRatingInfo) {
        setShowRatingInfo(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showRatingInfo])

  return (
    <div className="min-h-screen bg-[#0E0F13]">
      <style jsx>{`
        .overflow-x-auto::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {/* Breadcrumbs */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-16 pb-2">
        <Breadcrumbs 
          items={[
            { label: 'Home', href: '/' },
            { label: media.media_type === 'MOVIE' ? 'Movies' : 'TV Shows', href: media.media_type === 'MOVIE' ? '/movies' : '/tv' },
            { label: media.title }
          ]}
        />
      </div>

      {/* HEADER SECTION - Horizontal Layout */}
      <header className="relative overflow-hidden">
        {/* Header Content - Grid Layout for XL screens */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 pt-4 md:pt-6 pb-8 md:pb-12 xl:pb-16">
          <div className="flex flex-col md:flex-row xl:grid xl:grid-cols-12 gap-6 md:gap-8 xl:gap-10 items-start md:items-center xl:items-start">
            
            {/* Poster */}
            <div className="flex-shrink-0 mx-auto md:mx-0 xl:col-span-3">
              <div className="relative group">
                <div className="relative w-64 h-96 xl:w-72 xl:h-[432px] rounded-xl overflow-hidden bg-gray-900 shadow-2xl ring-1 ring-white/10">
                  {media.poster_path ? (
                    <React.Fragment>
                      <Image
                        src={`https://image.tmdb.org/t/p/w500${media.poster_path}`}
                        alt={media.title}
                        fill
                        className="object-cover"
                        priority
                      />
                      {/* Subtle inner shadow for depth */}
                      <div className="absolute inset-0 ring-1 ring-inset ring-black/20 rounded-xl pointer-events-none"></div>
                    </React.Fragment>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-16 h-16 text-gray-700" />
                    </div>
                  )}
                </div>
                {/* Poster reflection/glow */}
                <div className="absolute -inset-4 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 -z-10"></div>
              </div>
            </div>
            
            {/* Main Content */}
            <div className="flex-grow w-full md:w-auto max-w-md mx-auto md:mx-0 md:max-w-none space-y-3 md:space-y-6 xl:col-span-9">
              {/* Title Section */}
              <div className="space-y-3 md:space-y-3 text-center md:text-left">
                <h1 className="text-3xl md:text-5xl xl:text-6xl font-bold text-white leading-tight">
                  {media.title}
                </h1>
                
                {/* Mobile Gauge - Own Row */}
                <div className="md:hidden flex flex-col items-center gap-2">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <RadialGauge 
                        percentage={media.also_liked_percentage}
                        size={120}
                        strokeWidth={8}
                        className="motion-safe:animate-fadeIn"
                        onClick={() => {
                          if (media.also_liked_percentage === null || media.also_liked_percentage === 0) {
                            handleRequestRating()
                          } else {
                            setShowGaugeTooltip(!showGaugeTooltip)
                          }
                        }}
                        requestStatus={requestStatus}
                        isClickable={true}
                      />
                      
                      {/* Tooltip */}
                      {showGaugeTooltip && media.also_liked_percentage === null && (
                        <div className="absolute z-10 w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl top-full mt-2 left-1/2 -translate-x-1/2">
                          <div className="text-sm text-gray-300">
                            <p className="font-semibold text-white mb-2">No score yet</p>
                            <p>Google hasn't collected enough likes yet. Be the first to rate on Google.</p>
                          </div>
                          <div className="absolute w-3 h-3 bg-gray-900 border-t border-l border-gray-700 transform rotate-45 -top-1.5 left-1/2 -translate-x-1/2"></div>
                        </div>
                      )}
                    </div>
                    
                    {/* Text next to gauge */}
                    {media.also_liked_percentage !== null && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-gray-300">
                          of users liked this {media.media_type === 'TV_SHOW' ? 'show' : 'film'}
                        </span>
                        <button
                          onClick={() => setShowRatingInfo(!showRatingInfo)}
                          className="rating-info-button p-1 rounded-full hover:bg-white/10 transition-colors group relative"
                        >
                          <Info className="w-3.5 h-3.5 text-gray-400 group-hover:text-white" />
                          
                          {/* Rating Info Tooltip */}
                          {showRatingInfo && (
                            <div className="absolute z-10 w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl -top-2 left-full ml-2">
                              <div className="text-sm text-gray-300">
                                <p className="font-semibold text-white mb-2">About our ratings</p>
                                <p>We get our audience scores from Google's rating system. When users search for movies and TV shows on Google, they can click a thumbs up to indicate they liked it. This percentage represents how many Google users gave it a thumbs up.</p>
                              </div>
                              <div className="absolute w-3 h-3 bg-gray-900 border-l border-b border-gray-700 transform rotate-45 -left-1.5 top-6"></div>
                            </div>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* "Audience score coming soon" label */}
                  {media.also_liked_percentage === null && (
                    <span className="text-xs text-gray-500">Audience score coming soon</span>
                  )}
                </div>
                
                {/* Metadata Row - Mobile: below gauge, Desktop: with inline rating */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm xl:text-base">
                  {releaseYear && (
                    <span className="text-gray-300">{releaseYear}</span>
                  )}
                  {formattedRuntime && (
                    <React.Fragment>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-300">{formattedRuntime}</span>
                    </React.Fragment>
                  )}
                  {media.media_type && (
                    <React.Fragment>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-300">{media.media_type === 'MOVIE' ? 'Movie' : 'TV Series'}</span>
                    </React.Fragment>
                  )}
                  {isUpcoming && (
                    <React.Fragment>
                      <span className="text-gray-500">•</span>
                      <span className="px-2 py-0.5 bg-[#F5C518]/20 text-[#F5C518] text-xs xl:text-sm font-medium rounded-full">Coming Soon</span>
                    </React.Fragment>
                  )}
                </div>
                
                {/* Medium/Desktop Gauge - 120px */}
                <div className="hidden md:flex md:flex-col md:items-start md:gap-2 mt-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="relative"
                      onMouseEnter={() => media.also_liked_percentage === null && setShowGaugeTooltip(true)}
                      onMouseLeave={() => setShowGaugeTooltip(false)}
                    >
                      <RadialGauge 
                        percentage={media.also_liked_percentage}
                        size={120}
                        strokeWidth={8}
                        className="motion-safe:animate-fadeIn"
                        onClick={() => {
                          if (media.also_liked_percentage === null || media.also_liked_percentage === 0) {
                            handleRequestRating()
                          } else {
                            setShowGaugeTooltip(!showGaugeTooltip)
                          }
                        }}
                        requestStatus={requestStatus}
                        isClickable={true}
                      />
                      
                      {/* Tooltip */}
                      {showGaugeTooltip && media.also_liked_percentage === null && (
                        <div className="absolute z-10 w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl -top-2 left-full ml-2">
                          <div className="text-sm text-gray-300">
                            <p className="font-semibold text-white mb-2">No score yet</p>
                            <p>Google hasn't collected enough likes yet. Be the first to rate on Google.</p>
                          </div>
                          <div className="absolute w-3 h-3 bg-gray-900 border-l border-b border-gray-700 transform rotate-45 -left-1.5 top-6"></div>
                        </div>
                      )}
                    </div>
                    
                    {/* Text next to gauge */}
                    {media.also_liked_percentage !== null && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-base text-gray-300">
                          of users liked this {media.media_type === 'TV_SHOW' ? 'show' : 'film'}
                        </span>
                        <button
                          onClick={() => setShowRatingInfo(!showRatingInfo)}
                          className="rating-info-button p-1 rounded-full hover:bg-white/10 transition-colors group relative"
                        >
                          <Info className="w-4 h-4 text-gray-400 group-hover:text-white" />
                          
                          {/* Rating Info Tooltip */}
                          {showRatingInfo && (
                            <div className="absolute z-10 w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl -top-2 left-full ml-2">
                              <div className="text-sm text-gray-300">
                                <p className="font-semibold text-white mb-2">About our ratings</p>
                                <p>We get our audience scores from Google's rating system. When users search for movies and TV shows on Google, they can click a thumbs up to indicate they liked it. This percentage represents how many Google users gave it a thumbs up.</p>
                              </div>
                              <div className="absolute w-3 h-3 bg-gray-900 border-l border-b border-gray-700 transform rotate-45 -left-1.5 top-6"></div>
                            </div>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* "Audience score coming soon" label */}
                  {media.also_liked_percentage === null && (
                    <span className="text-xs text-gray-500">Audience score coming soon</span>
                  )}
                </div>
                
                {/* Genres */}
                {media.genres && media.genres.length > 0 && (
                  <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    {media.genres.map((genre) => (
                      <Link
                        key={genre.id}
                        href={`/${media.media_type === 'MOVIE' ? 'movie' : 'tv'}/genre/${genre.name.toLowerCase().replace(/\s+/g, '-')}`}
                        className="inline-block px-3 py-1 xl:px-4 xl:py-1.5 bg-transparent text-gray-400 text-xs xl:text-sm rounded-full border border-[#F5C518]/30 hover:text-white hover:border-[#F5C518]/60 hover:bg-[#F5C518]/10 transition-all duration-200 cursor-pointer"
                      >
                        {genre.name}
                      </Link>
                    ))}
                  </div>
                )}
                
                {/* Last Updated - Only show when we have a rating */}
                {media.updated_at && media.also_liked_percentage !== null && media.also_liked_percentage > 0 && (
                  <div className="flex items-center justify-center md:justify-start gap-1.5 my-4 text-xs xl:text-sm text-gray-500">
                    <Clock className="w-3 h-3 xl:w-4 xl:h-4" />
                    <span>Last updated: {new Date(media.updated_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}</span>
                  </div>
                )}
                
                {/* Mobile Play Trailer Button - White CTA */}
                {mainTrailer && (
                  <div className="md:hidden mt-3">
                    <button
                      onClick={() => setShowTrailer(true)}
                      className="group relative flex items-center justify-center gap-2.5 w-full max-w-sm mx-auto px-6 py-3 bg-white/90 text-black font-medium rounded-xl border border-[#F5C518]/50 shadow-sm hover:shadow-md hover:brightness-105 active:bg-white/86 transition-all duration-200"
                    >
                      <Play className="w-5 h-5 text-[#F5C518]" fill="currentColor" />
                      <span>Play Trailer</span>
                    </button>
                  </div>
                )}
                
              </div>
              
              {/* Medium screens (Tablet) - Compact button and providers */}
              <div className="hidden md:flex xl:hidden items-start gap-4 mt-6">
                {/* Compact Trailer Button */}
                {mainTrailer && (
                  <button
                    onClick={() => setShowTrailer(true)}
                    className="flex-shrink-0 group relative flex items-center justify-center gap-2 px-4 py-2 bg-white/90 text-black font-medium rounded-lg border border-[#F5C518]/50 shadow-sm hover:shadow-md hover:brightness-105 active:bg-white/86 transition-all duration-200"
                  >
                    <Play className="w-4 h-4 text-[#F5C518]" fill="currentColor" />
                    <span className="text-sm">Watch Trailer</span>
                  </button>
                )}
                
                {/* Watch Providers for medium screens */}
                {media.watch_providers && ((media.watch_providers.flatrate && media.watch_providers.flatrate.length > 0) || (media.watch_providers.rent && media.watch_providers.rent.length > 0) || (media.watch_providers.buy && media.watch_providers.buy.length > 0)) && (
                  <div className="flex-grow flex flex-wrap items-center gap-4">
                    {/* Stream */}
                    {media.watch_providers.flatrate && media.watch_providers.flatrate.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#F5C518] uppercase tracking-wider">Stream</span>
                        <div className="flex gap-2.5">
                          {media.watch_providers.flatrate.slice(0, 3).map((provider, index) => (
                            <button
                              key={`stream-md-${index}`}
                              className="w-12 h-12 rounded-lg overflow-hidden hover:ring-2 hover:ring-white/20 transition-all"
                              title={provider.provider_name}
                            >
                              {provider.logo_path && (
                                <Image
                                  src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                                  alt={provider.provider_name}
                                  width={48}
                                  height={48}
                                  className="object-cover rounded-lg"
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Rent */}
                    {media.watch_providers.rent && media.watch_providers.rent.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#F5C518] uppercase tracking-wider">Rent</span>
                        <div className="flex gap-2.5">
                          {media.watch_providers.rent.slice(0, 2).map((provider, index) => (
                            <button
                              key={`rent-md-${index}`}
                              className="w-12 h-12 rounded-lg overflow-hidden hover:ring-2 hover:ring-white/20 transition-all"
                              title={provider.provider_name}
                            >
                              {provider.logo_path && (
                                <Image
                                  src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                                  alt={provider.provider_name}
                                  width={48}
                                  height={48}
                                  className="object-cover rounded-lg"
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Buy */}
                    {media.watch_providers.buy && media.watch_providers.buy.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#F5C518] uppercase tracking-wider">Buy</span>
                        <div className="flex gap-2.5">
                          {media.watch_providers.buy.slice(0, 2).map((provider, index) => (
                            <button
                              key={`buy-md-${index}`}
                              className="w-12 h-12 rounded-lg overflow-hidden hover:ring-2 hover:ring-white/20 transition-all"
                              title={provider.provider_name}
                            >
                              {provider.logo_path && (
                                <Image
                                  src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                                  alt={provider.provider_name}
                                  width={48}
                                  height={48}
                                  className="object-cover rounded-lg"
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Desktop Button and Providers - XL screens only */}
              <div className="hidden xl:flex xl:items-start gap-6 mt-6">
                {/* Larger Trailer Button */}
                {mainTrailer && (
                  <button
                    onClick={() => setShowTrailer(true)}
                    className="flex-shrink-0 group relative flex items-center justify-center gap-2.5 px-6 py-3 bg-white/90 text-black font-medium rounded-xl border border-[#F5C518]/50 shadow-sm hover:shadow-md hover:brightness-105 active:bg-white/86 transition-all duration-200"
                  >
                    <Play className="w-5 h-5 text-[#F5C518]" fill="currentColor" />
                    <span className="text-base">Watch Trailer</span>
                  </button>
                )}
                
                {/* Watch Providers inline with button */}
                {media.watch_providers && ((media.watch_providers.flatrate && media.watch_providers.flatrate.length > 0) || (media.watch_providers.rent && media.watch_providers.rent.length > 0) || (media.watch_providers.buy && media.watch_providers.buy.length > 0)) && (
                  <div className="flex flex-wrap items-center gap-6">
                    {/* Stream */}
                    {media.watch_providers.flatrate && media.watch_providers.flatrate.length > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-[#F5C518] uppercase tracking-wider">Stream</span>
                        <div className="flex gap-3">
                          {media.watch_providers.flatrate.slice(0, 4).map((provider, index) => (
                            <button
                              key={`stream-${index}`}
                              className="w-14 h-14 rounded-lg overflow-hidden hover:ring-2 hover:ring-white/20 transition-all"
                              title={provider.provider_name}
                            >
                              {provider.logo_path && (
                                <Image
                                  src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                                  alt={provider.provider_name}
                                  width={56}
                                  height={56}
                                  className="object-cover rounded-lg"
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Divider */}
                    {media.watch_providers.flatrate && media.watch_providers.flatrate.length > 0 && ((media.watch_providers.rent && media.watch_providers.rent.length > 0) || (media.watch_providers.buy && media.watch_providers.buy.length > 0)) && (
                      <div className="w-px h-8 bg-white/10"></div>
                    )}
                    
                    {/* Rent */}
                    {media.watch_providers.rent && media.watch_providers.rent.length > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-[#F5C518] uppercase tracking-wider">Rent</span>
                        <div className="flex gap-3">
                          {media.watch_providers.rent.slice(0, 3).map((provider, index) => (
                            <button
                              key={`rent-${index}`}
                              className="w-14 h-14 rounded-lg overflow-hidden hover:ring-2 hover:ring-white/20 transition-all"
                              title={provider.provider_name}
                            >
                              {provider.logo_path && (
                                <Image
                                  src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                                  alt={provider.provider_name}
                                  width={56}
                                  height={56}
                                  className="object-cover rounded-lg"
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Divider */}
                    {media.watch_providers.rent && media.watch_providers.rent.length > 0 && media.watch_providers.buy && media.watch_providers.buy.length > 0 && (
                      <div className="w-px h-8 bg-white/10"></div>
                    )}
                    
                    {/* Buy */}
                    {media.watch_providers.buy && media.watch_providers.buy.length > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-[#F5C518] uppercase tracking-wider">Buy</span>
                        <div className="flex gap-3">
                          {media.watch_providers.buy.slice(0, 3).map((provider, index) => (
                            <button
                              key={`buy-${index}`}
                              className="w-14 h-14 rounded-lg overflow-hidden hover:ring-2 hover:ring-white/20 transition-all"
                              title={provider.provider_name}
                            >
                              {provider.logo_path && (
                                <Image
                                  src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                                  alt={provider.provider_name}
                                  width={56}
                                  height={56}
                                  className="object-cover rounded-lg"
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            
          </div>
          
        </div>
      </header>

      {/* MOBILE PROVIDER SECTIONS - Each category on its own row */}
      {media.watch_providers && ((media.watch_providers.flatrate && media.watch_providers.flatrate.length > 0) || (media.watch_providers.rent && media.watch_providers.rent.length > 0) || (media.watch_providers.buy && media.watch_providers.buy.length > 0)) && (
        <section className="md:hidden max-w-7xl mx-auto px-4 space-y-3">
          {/* Stream Section */}
          {media.watch_providers.flatrate && media.watch_providers.flatrate.length > 0 && (
            <div className="flex gap-3 items-center overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <span className="flex-shrink-0 text-[10px] font-semibold text-[#F5C518] uppercase tracking-wider min-w-[45px]">Stream</span>
              <div className="flex gap-3">
                {media.watch_providers.flatrate.map((provider, index) => (
                  <button
                    key={`stream-${index}`}
                    className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden hover:ring-2 hover:ring-white/20 transition-all"
                    title={provider.provider_name}
                  >
                    {provider.logo_path && (
                      <Image
                        src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                        alt={provider.provider_name}
                        width={56}
                        height={56}
                        className="rounded-lg"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Rent Section */}
          {media.watch_providers.rent && media.watch_providers.rent.length > 0 && (
            <div className="flex gap-3 items-center overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <span className="flex-shrink-0 text-[10px] font-semibold text-[#F5C518] uppercase tracking-wider min-w-[45px]">Rent</span>
              <div className="flex gap-3">
                {media.watch_providers.rent.map((provider, index) => (
                  <button
                    key={`rent-${index}`}
                    className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden hover:ring-2 hover:ring-white/20 transition-all"
                    title={provider.provider_name}
                  >
                    {provider.logo_path && (
                      <Image
                        src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                        alt={provider.provider_name}
                        width={56}
                        height={56}
                        className="rounded-lg"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Buy Section */}
          {media.watch_providers.buy && media.watch_providers.buy.length > 0 && (
            <div className="flex gap-3 items-center overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <span className="flex-shrink-0 text-[10px] font-semibold text-[#F5C518] uppercase tracking-wider min-w-[45px]">Buy</span>
              <div className="flex gap-3">
                {media.watch_providers.buy.map((provider, index) => (
                  <button
                    key={`buy-${index}`}
                    className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden hover:ring-2 hover:ring-white/20 transition-all"
                    title={provider.provider_name}
                  >
                    {provider.logo_path && (
                      <Image
                        src={`https://image.tmdb.org/t/p/w92${provider.logo_path}`}
                        alt={provider.provider_name}
                        width={56}
                        height={56}
                        className="rounded-lg"
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}


      {/* Divider - Mobile Only */}
      <div className="md:hidden max-w-7xl mx-auto px-4 mt-4 mb-4">
        <div className="h-px bg-white/10"></div>
      </div>

      {/* CONTENT SECTION - Synopsis */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 xl:py-8">
        <div className="max-w-4xl">
          {media.overview && (
            <React.Fragment>
              <div className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                  <h2 className="text-3xl font-bold text-white">Synopsis</h2>
                  <div className="h-px bg-gradient-to-r from-white/20 to-transparent flex-grow"></div>
                </div>
                <div className="relative">
                  <p className={`text-gray-300 leading-relaxed text-lg lg:text-xl font-light ${!isExpanded ? 'line-clamp-5 md:line-clamp-none' : ''}`}>
                    {media.overview}
                  </p>
                  {/* Read More Button - Mobile Only */}
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="md:hidden mt-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {isExpanded ? 'Show less' : 'Read more'}
                  </button>
                </div>
              </div>
              
              {/* Visual separator */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            </React.Fragment>
          )}
        </div>
      </section>

      {/* COMBINED SECTION - Details & Cast */}
      <section className="max-w-7xl mx-auto px-4 md:px-6 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          
          {/* Details Column */}
          <div className="lg:col-span-4 space-y-8">
            {hasDetails && (
              <div>
                <h2 className="text-3xl font-bold text-white mb-8">Details</h2>
                
                <div className="space-y-6">
                {/* Key Crew */}
                <div className="space-y-4">
                  {director && (
                    <div className="flex flex-col space-y-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Director</span>
                      <span className="text-white text-lg">{director.name}</span>
                    </div>
                  )}
                  
                  {writers && writers.length > 0 && (
                    <div className="flex flex-col space-y-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Writers</span>
                      <span className="text-white text-lg">
                        {writers.map(w => w.name).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Divider */}
                <div className="h-px bg-white/10"></div>
                
                {/* Production Info */}
                <div className="space-y-4">
                  {media.production_companies && media.production_companies.length > 0 && (
                    <div className="flex flex-col space-y-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Production</span>
                      <span className="text-white">
                        {media.production_companies.slice(0, 3).map(c => c.name).join(', ')}
                      </span>
                    </div>
                  )}
                  
                  {media.original_title && media.original_title !== media.title && (
                    <div className="flex flex-col space-y-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Original Title</span>
                      <span className="text-white">{media.original_title}</span>
                    </div>
                  )}
                  
                  {media.spoken_languages && media.spoken_languages.length > 0 && (
                    <div className="flex flex-col space-y-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Languages</span>
                      <span className="text-white">
                        {media.spoken_languages.map(l => l.english_name).join(', ')}
                      </span>
                    </div>
                  )}
                  
                  {/* TV Show specific fields */}
                  {media.media_type === 'TV_SHOW' && media.created_by && media.created_by.length > 0 && (
                    <div className="flex flex-col space-y-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</span>
                      <span className="text-white">
                        {media.created_by.map(c => c.name).join(', ')}
                      </span>
                    </div>
                  )}
                  
                  {media.media_type === 'TV_SHOW' && media.networks && media.networks.length > 0 && (
                    <div className="flex flex-col space-y-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Networks</span>
                      <span className="text-white">
                        {media.networks.map(n => n.name).join(', ')}
                      </span>
                    </div>
                  )}
                  
                  {media.media_type === 'TV_SHOW' && (media.number_of_seasons || media.number_of_episodes) && (
                    <div className="flex flex-col space-y-1">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Episodes</span>
                      <span className="text-white">
                        {media.number_of_seasons && `${media.number_of_seasons} Season${media.number_of_seasons > 1 ? 's' : ''}`}
                        {media.number_of_seasons && media.number_of_episodes && ' • '}
                        {media.number_of_episodes && `${media.number_of_episodes} Episodes`}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Financial Info */}
                {(media.budget || media.revenue) && (
                  <React.Fragment>
                    <div className="h-px bg-white/10"></div>
                    <div className="space-y-4">
                      {media.budget && media.budget > 0 && (
                        <div className="flex flex-col space-y-1">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Budget</span>
                          <span className="text-white text-lg font-medium">${media.budget.toLocaleString()}</span>
                        </div>
                      )}
                      
                      {media.revenue && media.revenue > 0 && (
                        <div className="flex flex-col space-y-1">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</span>
                          <span className="text-white text-lg font-medium">${media.revenue.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                )}
              </div>
            </div>
            )}
          </div>
          
          {/* Cast Grid */}
          {media.credits?.cast && media.credits.cast.length > 0 && (
            <div className="lg:col-span-8">
              <h2 className="text-3xl font-bold text-white mb-8">Cast</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6">
                {media.credits.cast.slice(0, 12).map((actor) => (
                  <div key={actor.id} className="group cursor-pointer">
                    <div className="relative">
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800 mb-3 ring-1 ring-white/[0.05] group-hover:ring-white/10 transition-all duration-300">
                        {actor.profile_path ? (
                          <React.Fragment>
                            <Image
                              src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                              alt={actor.name}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                              loading="lazy"
                            />
                            {/* Gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-60 group-hover:opacity-80 transition-opacity duration-300"></div>
                            {/* Highlight on hover */}
                            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/[0.03] to-white/[0.08] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          </React.Fragment>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                            <Users className="w-10 h-10 text-gray-700 group-hover:text-gray-600 transition-colors" />
                          </div>
                        )}
                      </div>
                      {/* Subtle shadow */}
                      <div className="absolute -inset-2 bg-gradient-to-b from-transparent to-black/20 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 -z-10"></div>
                    </div>
                    <div className="text-center space-y-1">
                      <h3 className="text-sm font-semibold text-gray-200 line-clamp-1 group-hover:text-white transition-colors duration-200">
                        {actor.name}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {actor.character}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
          
      {/* Trailer Section */}
      {mainTrailer && (
        <section className="max-w-7xl mx-auto px-4 md:px-6 pb-12">
          <h2 className="text-2xl font-semibold mb-6 text-white">Trailer</h2>
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black max-w-4xl">
            <iframe
              src={`https://www.youtube.com/embed/${mainTrailer.key}?rel=0&modestbranding=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>
        </section>
      )}

      {/* You Might Also Like */}
      {media.similar && media.similar.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 md:px-6 pb-20">
          <h2 className="text-2xl font-semibold mb-6 text-white">You Might Also Like</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {media.similar.slice(0, 12).map((item) => {
              const itemMediaType = item.media_type === 'MOVIE' ? 'movie' : 'tv'
              const itemHref = createMediaUrl(itemMediaType, item.title, item.id)
              
              return (
              <Link
                key={item.id}
                href={itemHref}
                className="group"
              >
                <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800">
                  {item.poster_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
                      alt={item.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-12 h-12 text-gray-600" />
                    </div>
                  )}
                  
                  {/* Audience Score Badge */}
                  <div className="absolute top-2 left-2 z-10 transition-all duration-300 group-hover:scale-110">
                    <AudienceVerdictCompact percentage={item.also_liked_percentage} />
                  </div>
                </div>
                
                <div className="mt-2">
                  <h3 className="text-sm font-medium text-white line-clamp-2 group-hover:text-[#F5C518] transition-colors">
                    {item.title}
                  </h3>
                </div>
              </Link>
            )})}
          </div>
        </section>
      )}

      {/* Trailer Modal */}
      {showTrailer && mainTrailer && (
        <React.Fragment>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40 bg-black/80" 
            onClick={() => setShowTrailer(false)}
          />
          
          {/* Modal Content */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div 
              className="relative w-full max-w-4xl bg-black rounded-xl shadow-2xl pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowTrailer(false)}
                className="absolute -top-12 right-0 text-white hover:text-[#F5C518] transition-colors md:-top-4 md:-right-4 md:bg-gray-900 md:rounded-full md:p-2 md:hover:bg-gray-800"
              >
                <X className="w-6 h-6" />
              </button>
              
              {/* Video Container */}
              <div className="relative aspect-video w-full overflow-hidden rounded-xl">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${mainTrailer.key}?autoplay=1&rel=0`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </React.Fragment>
      )}
    </div>
  )
}
