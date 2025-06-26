'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Film, Tv } from 'lucide-react'

interface ToggleBarProps {
  activeView: 'movies' | 'tv'
  onChange: (view: 'movies' | 'tv') => void
}

export function ToggleBar({ activeView, onChange }: ToggleBarProps) {
  return (
    <div className="toggle-bar sticky top-14 md:top-16 z-30 bg-[#0E0F13]/95 backdrop-blur-sm border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center justify-center">
          <div className="toggle-options inline-flex items-center p-1 bg-surface-01 rounded-lg">
            <button
              onClick={() => onChange('movies')}
              className={cn(
                'toggle-option relative flex items-center gap-2 px-6 py-2.5 rounded-md font-medium text-sm transition-all duration-200',
                activeView === 'movies'
                  ? 'toggle-active bg-accent text-black shadow-lg'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <Film className="w-4 h-4" />
              <span>Movies</span>
              {activeView === 'movies' && (
                <div className="absolute inset-0 ring-2 ring-accent/20 rounded-md pointer-events-none" />
              )}
            </button>
            
            <button
              onClick={() => onChange('tv')}
              className={cn(
                'toggle-option relative flex items-center gap-2 px-6 py-2.5 rounded-md font-medium text-sm transition-all duration-200',
                activeView === 'tv'
                  ? 'toggle-active bg-accent text-black shadow-lg'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <Tv className="w-4 h-4" />
              <span>TV Shows</span>
              {activeView === 'tv' && (
                <div className="absolute inset-0 ring-2 ring-accent/20 rounded-md pointer-events-none" />
              )}
            </button>
          </div>
        </div>
        
        {/* Mobile View Count */}
        <div className="xl:hidden text-center mt-3">
          <p className="text-xs text-gray-500">
            Showing {activeView === 'movies' ? 'Movies' : 'TV Shows'}
          </p>
        </div>
      </div>
    </div>
  )
}