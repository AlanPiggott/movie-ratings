'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface SearchFiltersProps {
  onMediaTypeChange?: (type: 'all' | 'movie' | 'tv') => void
  onMinPercentageChange?: (percentage: number | null) => void
}

export function SearchFilters({ onMediaTypeChange, onMinPercentageChange }: SearchFiltersProps) {
  const [mediaType, setMediaType] = useState<'all' | 'movie' | 'tv'>('all')
  const [minPercentage, setMinPercentage] = useState<number | null>(null)

  const handleMediaTypeChange = (type: 'all' | 'movie' | 'tv') => {
    setMediaType(type)
    onMediaTypeChange?.(type)
  }

  const handlePercentageChange = (percentage: number | null) => {
    setMinPercentage(percentage)
    onMinPercentageChange?.(percentage)
  }

  return (
    <div className="bg-zinc-900 rounded-lg p-4 space-y-4 elevation-01">
      {/* Media Type Filter */}
      <div>
        <h3 className="text-sm font-medium text-zinc-400 mb-2">Type</h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleMediaTypeChange('all')}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              mediaType === 'all'
                ? "bg-[#F5C518] text-black"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            )}
          >
            All
          </button>
          <button
            onClick={() => handleMediaTypeChange('movie')}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              mediaType === 'movie'
                ? "bg-[#F5C518] text-black"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            )}
          >
            Movies
          </button>
          <button
            onClick={() => handleMediaTypeChange('tv')}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              mediaType === 'tv'
                ? "bg-[#F5C518] text-black"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            )}
          >
            TV Shows
          </button>
        </div>
      </div>

      {/* Minimum Also-Liked Percentage */}
      <div>
        <h3 className="text-sm font-medium text-zinc-400 mb-2">Minimum % Liked</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            onClick={() => handlePercentageChange(null)}
            className={cn(
              "px-3 py-2 text-sm font-medium rounded-lg transition-colors",
              minPercentage === null
                ? "bg-[#F5C518] text-black"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            )}
          >
            Any
          </button>
          <button
            onClick={() => handlePercentageChange(50)}
            className={cn(
              "px-3 py-2 text-sm font-medium rounded-lg transition-colors",
              minPercentage === 50
                ? "bg-[#F5C518] text-black"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            )}
          >
            50%+
          </button>
          <button
            onClick={() => handlePercentageChange(70)}
            className={cn(
              "px-3 py-2 text-sm font-medium rounded-lg transition-colors",
              minPercentage === 70
                ? "bg-[#F5C518] text-black"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            )}
          >
            70%+
          </button>
          <button
            onClick={() => handlePercentageChange(90)}
            className={cn(
              "px-3 py-2 text-sm font-medium rounded-lg transition-colors",
              minPercentage === 90
                ? "bg-[#F5C518] text-black"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            )}
          >
            90%+
          </button>
        </div>
      </div>
    </div>
  )
}