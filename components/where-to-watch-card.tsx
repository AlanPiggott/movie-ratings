'use client'

import React from 'react'
import Image from 'next/image'

interface Provider {
  provider_name: string
  logo_path: string
  link?: string
}

interface WhereToWatchCardProps {
  providers?: {
    flatrate?: Provider[]
    rent?: Provider[]
    buy?: Provider[]
  }
}

export default function WhereToWatchCard({ providers }: WhereToWatchCardProps) {
  const hasProviders = (providers?.flatrate && providers.flatrate.length > 0) || 
                      (providers?.rent && providers.rent.length > 0) || 
                      (providers?.buy && providers.buy.length > 0)

  const renderProvider = (provider: Provider, idx: number) => {
    if (provider.link) {
      return (
        <a
          key={idx}
          href={provider.link}
          target="_blank"
          rel="noopener noreferrer"
          className="relative group"
          title={provider.provider_name}
        >
          <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-800 ring-1 ring-white/10 group-hover:ring-2 group-hover:ring-[#F5C518] group-hover:scale-105 transition-all">
            <Image
              src={`https://image.tmdb.org/t/p/original${provider.logo_path}`}
              alt={provider.provider_name}
              width={80}
              height={80}
              className="object-cover w-full h-full"
            />
          </div>
        </a>
      )
    } else {
      return (
        <div 
          key={idx} 
          className="relative"
          title={provider.provider_name}
        >
          <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-800 ring-1 ring-white/10">
            <Image
              src={`https://image.tmdb.org/t/p/original${provider.logo_path}`}
              alt={provider.provider_name}
              width={80}
              height={80}
              className="object-cover w-full h-full"
            />
          </div>
        </div>
      )
    }
  }

  return (
    <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/5"
      style={{
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
      <h3 className="text-xl sm:text-lg font-semibold mb-4 text-white">Where to Watch</h3>
      
      {hasProviders ? (
        <div className="space-y-4">
          {/* Streaming Providers */}
          {providers?.flatrate && providers.flatrate.length > 0 && (
            <div>
              <p className="text-xs text-white/60 mb-2 uppercase tracking-wider">Stream</p>
              <div className="grid grid-cols-3 gap-2">
                {providers.flatrate.slice(0, 6).map(renderProvider)}
              </div>
            </div>
          )}

          {/* Rent Providers */}
          {providers?.rent && providers.rent.length > 0 && (
            <div>
              <p className="text-xs text-white/60 mb-2 uppercase tracking-wider">Rent</p>
              <div className="grid grid-cols-3 gap-2">
                {providers.rent.slice(0, 6).map(renderProvider)}
              </div>
            </div>
          )}

          {/* Buy Providers */}
          {providers?.buy && providers.buy.length > 0 && (
            <div>
              <p className="text-xs text-white/60 mb-2 uppercase tracking-wider">Buy</p>
              <div className="grid grid-cols-3 gap-2">
                {providers.buy.slice(0, 6).map(renderProvider)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-white/60 text-sm">Not available on streaming platforms</p>
          <button className="w-full px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors text-sm font-medium">
            Notify me when available
          </button>
        </div>
      )}
    </div>
  )
}