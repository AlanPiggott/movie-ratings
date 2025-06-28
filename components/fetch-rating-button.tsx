'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface FetchRatingButtonProps {
  onClick: () => void
  isLoading?: boolean
  isAutoFetching?: boolean
  hasFailed?: boolean
  isLimitReached?: boolean
  className?: string
}

export default function FetchRatingButton({
  onClick,
  isLoading = false,
  isAutoFetching = false,
  hasFailed = false,
  isLimitReached = false,
  className
}: FetchRatingButtonProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showLoadingState, setShowLoadingState] = useState(false)

  useEffect(() => {
    if (isLoading || isAutoFetching) {
      setShowLoadingState(true)
      // Keep loading state for at least 1.5 seconds
      const timer = setTimeout(() => {
        if (!isLoading && !isAutoFetching) {
          setShowLoadingState(false)
        }
      }, 1500)
      return () => clearTimeout(timer)
    } else {
      // If loading finished, ensure we show it for at least 1.5s total
      const timer = setTimeout(() => {
        setShowLoadingState(false)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isLoading, isAutoFetching])

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={showLoadingState || hasFailed || isLimitReached}
        className={cn(
          "relative w-[140px] h-[140px] rounded-full",
          "flex flex-col items-center justify-center gap-1",
          "transition-all duration-300 ease-out",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E0F13]",
          showLoadingState && "cursor-wait",
          !showLoadingState && !hasFailed && !isLimitReached && "cursor-pointer hover:scale-105",
          (hasFailed || isLimitReached) && "cursor-not-allowed opacity-50"
        )}
        style={{
          backgroundColor: isHovered && !showLoadingState && !hasFailed && !isLimitReached ? 'rgba(66, 133, 244, 0.05)' : 'rgba(255, 255, 255, 0.02)',
          border: `3px solid ${isHovered && !showLoadingState && !hasFailed && !isLimitReached ? 'rgba(66, 133, 244, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
          boxShadow: isHovered && !showLoadingState && !hasFailed && !isLimitReached
            ? '0 0 0 15px rgba(66, 133, 244, 0.1), 0 10px 40px rgba(0, 0, 0, 0.3)' 
            : 'none'
        }}
        aria-label="Get rating from Google"
      >
        {showLoadingState ? (
          <div className="absolute inset-0 rounded-full flex items-center justify-center">
            <div className="absolute inset-0 rounded-full p-[3px]">
              <div 
                className="w-full h-full rounded-full animate-spin"
                style={{
                  background: `conic-gradient(from 0deg, rgba(66, 133, 244, 0.1) 0deg, #4285f4 90deg, #4285f4 180deg, rgba(66, 133, 244, 0.1) 360deg)`,
                  maskImage: 'radial-gradient(transparent 60%, black 60%)',
                  WebkitMaskImage: 'radial-gradient(transparent 60%, black 60%)'
                }}
              />
            </div>
            {isAutoFetching && (
              <span className="text-xs text-gray-400 font-medium px-2 text-center">
                Fetching<br/>rating...
              </span>
            )}
          </div>
        ) : hasFailed || isLimitReached ? (
          <div className="flex flex-col items-center justify-center">
            <div className="text-2xl font-medium text-gray-500 leading-none">N/A</div>
            <div className="text-[0.625rem] text-gray-600 uppercase tracking-wider mt-1">NO DATA</div>
          </div>
        ) : (
          <>
            <span 
              className={cn(
                "text-[2.5rem] transition-all duration-300",
                isHovered ? "opacity-100" : "opacity-50"
              )}
              style={{
                filter: isHovered ? 'grayscale(0)' : 'grayscale(1)'
              }}
            >
              📊
            </span>
            <span 
              className={cn(
                "text-[0.875rem] font-medium transition-colors duration-300",
                isHovered ? "text-[#4285f4]" : "text-gray-400"
              )}
            >
              Get Rating
            </span>
          </>
        )}
      </button>
      
      {!showLoadingState && !isAutoFetching && (
        <div className="text-center mt-2">
          {hasFailed || isLimitReached ? (
            <>
              <div className="text-sm text-gray-400 font-medium">Rating unavailable</div>
              <div className="text-xs text-gray-500 mt-1">
                {isLimitReached ? "Daily limit reached. Try again tomorrow." : "It might be too new or niche."}
              </div>
            </>
          ) : (
            <span className="text-xs text-[#666]">
              Click to fetch from Google
            </span>
          )}
        </div>
      )}
    </div>
  )
}