'use client'

import React, { useState } from 'react'
import { Info, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AudienceVerdictProps {
  percentage: number | null
  size?: 'small' | 'medium' | 'large'
  showTooltip?: boolean
  showBox?: boolean
  alignLeft?: boolean
  mediaType?: 'MOVIE' | 'TV_SHOW'
  className?: string
  mediaId?: string
  onRequestRating?: () => Promise<void>
  requestStatus?: 'idle' | 'pending' | 'fetching' | 'completed' | 'failed' | 'limit_reached'
}

export default function AudienceVerdict({ 
  percentage, 
  size = 'medium',
  showTooltip = true,
  showBox = true,
  alignLeft = false,
  mediaType = 'MOVIE',
  className,
  mediaId,
  onRequestRating,
  requestStatus = 'idle'
}: AudienceVerdictProps) {
  const [showInfo, setShowInfo] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)

  // Define size classes at the top of the component
  const sizeClasses = {
    small: {
      container: 'px-3 py-2',
      percentage: 'text-xl',
      label: 'text-xs',
      header: 'text-xs'
    },
    medium: {
      container: 'px-4 py-3',
      percentage: 'text-3xl',
      label: 'text-sm',
      header: 'text-sm'
    },
    large: {
      container: 'px-6 py-4',
      percentage: 'text-4xl',
      label: 'text-base',
      header: 'text-base'
    }
  }

  const sizes = sizeClasses[size]

  const handleRequestRating = async () => {
    if (!mediaId || !onRequestRating || isRequesting || requestStatus !== 'idle') return
    
    setIsRequesting(true)
    try {
      await onRequestRating()
    } catch (error) {
      console.error('Failed to request rating:', error)
    } finally {
      setIsRequesting(false)
    }
  }

  // Show clickable placeholder when no percentage
  if (percentage === null || percentage === 0) {
    // Don't show if already processing
    if (requestStatus === 'completed') return null

    // Determine status text
    const getStatusText = () => {
      switch (requestStatus) {
        case 'pending':
          return 'Requesting...'
        case 'fetching':
          return 'Loading...'
        case 'failed':
          return 'No data yet :('
        case 'limit_reached':
          return 'Daily limit reached'
        default:
          return 'No rating yet • Click to update'
      }
    }

    // Show grey placeholder gauge
    if (!showBox) {
      return (
        <div className={cn('relative', className)}>
          <button
            onClick={handleRequestRating}
            disabled={requestStatus !== 'idle' || !mediaId || !onRequestRating}
            className={cn(
              "flex flex-col space-y-3 transition-all",
              alignLeft ? "items-start text-left" : "items-center text-center",
              requestStatus === 'idle' && mediaId && onRequestRating ? "cursor-pointer hover:opacity-80" : "cursor-default"
            )}
          >
            {/* Grey gauge placeholder */}
            <div className="flex items-center gap-4">
              <div className="flex items-baseline gap-1">
                <span 
                  className={cn(
                    'font-bold tracking-tight leading-none text-gray-500',
                    size === 'large' ? 'text-7xl' : size === 'small' ? 'text-4xl' : 'text-5xl'
                  )}
                  style={{ fontFamily: 'var(--font-inter-tight)' }}
                >
                  --
                </span>
                <span 
                  className={cn(
                    'font-medium text-gray-500',
                    size === 'large' ? 'text-3xl' : size === 'small' ? 'text-xl' : 'text-2xl'
                  )}
                  style={{ fontFamily: 'var(--font-inter-tight)' }}
                >
                  %
                </span>
              </div>
              
              {/* Status text */}
              <span className={cn(
                'text-gray-400 font-medium transition-opacity duration-200',
                size === 'large' ? 'text-lg' : size === 'small' ? 'text-sm' : 'text-base',
                (isRequesting || requestStatus === 'pending' || requestStatus === 'fetching') && 'animate-pulse'
              )}>
                {isRequesting ? 'Requesting...' : (requestStatus === 'idle' && size === 'large' ? 'Oops! ' : '') + getStatusText()}
              </span>
            </div>
            
            {/* Attribution below */}
            <div className={cn(
              "flex items-center gap-2",
              alignLeft ? "" : "justify-center"
            )}>
              <span className={cn(
                'text-gray-500',
                size === 'large' ? 'text-sm' : 'text-xs'
              )}>
                from Google users
              </span>
            </div>
          </button>
        </div>
      )
    }

    // Box version placeholder
    return (
      <div className={cn('relative', className)}>
        <button
          onClick={handleRequestRating}
          disabled={requestStatus !== 'idle' || !mediaId || !onRequestRating}
          className={cn(
            'rounded-lg border border-gray-700 bg-gray-800/50 backdrop-blur-sm transition-all w-full',
            sizes.container,
            requestStatus === 'idle' && mediaId && onRequestRating ? "cursor-pointer hover:bg-gray-800/70" : "cursor-default"
          )}
        >
          {/* Header */}
          <div className={cn('flex items-center justify-between mb-1', sizes.header)}>
            <span className="font-semibold text-gray-400 uppercase tracking-wider">
              Audience Verdict
            </span>
          </div>

          {/* Score placeholder */}
          <div className="flex items-center gap-2">
            <span className={cn('font-bold text-gray-500', sizes.percentage)}>
              --%
            </span>
          </div>

          {/* Status text */}
          <div className={cn('text-gray-400 mt-1', sizes.label, (isRequesting || requestStatus === 'pending' || requestStatus === 'fetching') && 'animate-pulse')}>
            {isRequesting ? 'Requesting...' : requestStatus === 'idle' ? 'Oops! ' + getStatusText() : getStatusText()}
          </div>
        </button>
      </div>
    )
  }

  // Determine color for percentage text only
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500'
    if (score >= 60) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <TrendingUp className="w-4 h-4" />
    if (score >= 60) return <Minus className="w-4 h-4" />
    return <TrendingDown className="w-4 h-4" />
  }

  const percentageColor = getScoreColor(percentage)

  // Modern no-box design
  if (!showBox) {
    return (
      <div className={cn('relative', className)}>
        <div className={cn(
          "flex flex-col space-y-3",
          alignLeft ? "items-start text-left" : "items-center text-center"
        )}>
          {/* Score with text on same line */}
          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-1">
              <span 
                className={cn(
                  'font-bold tracking-tight leading-none',
                  size === 'large' ? 'text-7xl' : size === 'small' ? 'text-4xl' : 'text-5xl',
                  percentageColor
                )}
                style={{ fontFamily: 'var(--font-inter-tight)' }}
              >
                {percentage}
              </span>
              <span 
                className={cn(
                  'font-medium text-gray-400',
                  size === 'large' ? 'text-3xl' : size === 'small' ? 'text-xl' : 'text-2xl'
                )}
                style={{ fontFamily: 'var(--font-inter-tight)' }}
              >
                %
              </span>
            </div>
            
            {/* "Users liked this film/show" text */}
            <span className={cn(
              'text-gray-300 font-medium',
              size === 'large' ? 'text-lg' : size === 'small' ? 'text-sm' : 'text-base'
            )}>
              users liked this {mediaType === 'TV_SHOW' ? 'show' : 'film'}
            </span>
          </div>
          
          {/* Attribution below */}
          <div className={cn(
            "flex items-center gap-2",
            alignLeft ? "" : "justify-center"
          )}>
            <span className={cn(
              'text-gray-500',
              size === 'large' ? 'text-sm' : 'text-xs'
            )}>
              from Google users
            </span>
            
            {/* Tooltip trigger */}
            {showTooltip && (
              <button
                onMouseEnter={() => setShowInfo(true)}
                onMouseLeave={() => setShowInfo(false)}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <Info className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        
        {/* Tooltip */}
        {showInfo && showTooltip && (
          <div className={cn(
            "absolute z-10 w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl top-full mt-2",
            alignLeft ? "left-0" : "left-1/2 -translate-x-1/2"
          )}>
            <div className="text-sm text-gray-300">
              <p className="font-semibold text-white mb-2">What is this score?</p>
              <p className="mb-2">
                This percentage represents how many Google users liked this {mediaType === 'TV_SHOW' ? 'show' : 'movie'} when searching for it.
              </p>
              <p className="text-xs text-gray-400">
                This is different from critic scores or IMDb ratings - it's based on real user sentiment from millions of Google searches.
              </p>
            </div>
            <div className={cn(
              "absolute w-3 h-3 bg-gray-900 border-t border-l border-gray-700 transform rotate-45 -top-1.5",
              alignLeft ? "left-8" : "left-1/2 -translate-x-1/2"
            )}></div>
          </div>
        )}
      </div>
    )
  }

  // Original box design
  return (
    <div className={cn('relative', className)}>
      <div className={cn(
        'rounded-lg border border-gray-700 bg-gray-800/50 backdrop-blur-sm',
        sizes.container
      )}>
        {/* Header */}
        <div className={cn('flex items-center justify-between mb-1', sizes.header)}>
          <span className="font-semibold text-gray-300 uppercase tracking-wider">
            Audience Verdict
          </span>
          {showTooltip && (
            <button
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Score */}
        <div className="flex items-center gap-2">
          <span className="text-gray-400">{getScoreIcon(percentage)}</span>
          <span className={cn('font-bold', sizes.percentage, percentageColor)}>
            {percentage}%
          </span>
        </div>

        {/* Attribution */}
        <div className={cn('text-gray-400 mt-1', sizes.label)}>
          from Google Users
        </div>
      </div>

      {/* Tooltip */}
      {showInfo && showTooltip && (
        <div className="absolute z-10 w-64 p-3 bg-gray-900 border border-gray-700 rounded-lg shadow-xl -top-2 left-full ml-2">
          <div className="text-sm text-gray-300">
            <p className="font-semibold text-white mb-2">What is this score?</p>
            <p className="mb-2">
              This percentage represents how many Google users liked this movie when searching for it.
            </p>
            <p className="text-xs text-gray-400">
              This is different from critic scores or IMDb ratings - it's based on real user sentiment from millions of Google searches.
            </p>
          </div>
          <div className="absolute w-3 h-3 bg-gray-900 border-l border-b border-gray-700 transform rotate-45 -left-1.5 top-6"></div>
        </div>
      )}
    </div>
  )
}

// Compact version for use in cards/lists
interface AudienceVerdictCompactProps {
  percentage: number | null
  mediaId?: string
  onRequestRating?: () => Promise<void>
  requestStatus?: 'idle' | 'pending' | 'fetching' | 'completed' | 'failed' | 'limit_reached'
}

export function AudienceVerdictCompact({ 
  percentage,
  mediaId,
  onRequestRating,
  requestStatus = 'idle'
}: AudienceVerdictCompactProps) {
  const [isRequesting, setIsRequesting] = useState(false)

  const handleRequestRating = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!mediaId || !onRequestRating || isRequesting || requestStatus !== 'idle') return
    
    setIsRequesting(true)
    try {
      await onRequestRating()
    } catch (error) {
      console.error('Failed to request rating:', error)
    } finally {
      setIsRequesting(false)
    }
  }

  // Show clickable placeholder when percentage is null, undefined, or 0
  if (percentage === null || percentage === undefined || percentage === 0) {
    if (requestStatus === 'completed') return null

    const getStatusText = () => {
      if (isRequesting) return 'Requesting...'
      switch (requestStatus) {
        case 'pending':
          return 'Requesting...'
        case 'fetching':
          return 'Loading...'
        case 'failed':
          return 'No data :('
        case 'limit_reached':
          return 'Limit reached'
        default:
          return 'Get rating'
      }
    }

    return (
      <div className="relative">
        {/* Backdrop for better visibility */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm rounded-md" />
        
        {/* Clickable placeholder */}
        <button
          onClick={handleRequestRating}
          disabled={requestStatus !== 'idle' || !mediaId || !onRequestRating}
          className={cn(
            "relative inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-white text-xs font-medium ring-1 ring-white/20 bg-gray-700 transition-all",
            requestStatus === 'idle' && mediaId && onRequestRating ? "hover:bg-gray-600 cursor-pointer" : "cursor-default",
            isRequesting && "animate-pulse"
          )}
        >
          <span className="opacity-90">{getStatusText()}</span>
        </button>
      </div>
    )
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-600'
    if (score >= 60) return 'bg-yellow-600'
    return 'bg-red-600'
  }

  return (
    <div className={cn(
      'inline-flex items-center gap-1 px-2 py-1 rounded-md text-white text-xs font-bold shadow-lg',
      getScoreColor(percentage)
    )}>
      <span>{percentage}%</span>
      <span className="opacity-80 font-normal">Users liked this</span>
    </div>
  )
}