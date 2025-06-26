'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface RadialGaugeProps {
  percentage: number | null
  size?: number
  strokeWidth?: number
  className?: string
  onClick?: () => void
  title?: string
  requestStatus?: 'idle' | 'pending' | 'fetching' | 'completed' | 'failed'
  isClickable?: boolean
}

export default function RadialGauge({
  percentage,
  size = 120,
  strokeWidth = 8,
  className,
  onClick,
  title,
  requestStatus = 'idle',
  isClickable = false
}: RadialGaugeProps) {
  const [showSkeleton, setShowSkeleton] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShowSkeleton(false), 500)
    return () => clearTimeout(timer)
  }, [])

  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = percentage !== null ? circumference - (percentage / 100) * circumference : circumference

  // Determine color based on percentage
  const getColor = (score: number) => {
    if (score >= 80) return '#22c55e' // green-500
    if (score >= 60) return '#eab308' // yellow-500
    return '#ef4444' // red-500
  }

  const color = percentage !== null ? getColor(percentage) : 'rgba(255,255,255,0.15)'
  const isPlaceholder = percentage === null || percentage === 0
  const showClickable = isPlaceholder && isClickable && requestStatus === 'idle'

  // Get status text
  const getStatusText = () => {
    switch (requestStatus) {
      case 'pending':
        return 'Requesting...'
      case 'fetching':
        return 'Loading...'
      case 'failed':
        return 'No data yet :('
      default:
        if (showClickable) {
          return size >= 100 ? 'No rating yet' : 'Get rating'
        }
        return 'No rating'
    }
  }

  return (
    <div 
      className={cn(
        "relative inline-flex items-center justify-center group",
        (onClick || showClickable) && "cursor-pointer",
        showClickable && "hover:scale-105 transition-transform duration-200",
        className
      )}
      onClick={onClick}
      title={title || (showClickable ? 'Click to get rating' : undefined)}
    >
      {/* Skeleton shimmer effect */}
      {showSkeleton && (
        <div className="absolute inset-0 rounded-full bg-gray-800 animate-pulse" />
      )}
      
      <svg
        width={size}
        height={size}
        className={cn("-rotate-90", showSkeleton && "opacity-0")}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className={cn(
            isPlaceholder ? "text-gray-800" : "text-gray-700/50"
          )}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={isPlaceholder ? "3 3" : circumference}
          strokeDashoffset={isPlaceholder ? 0 : offset}
          className={cn(
            "motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out",
            isPlaceholder && "opacity-30"
          )}
          style={{
            filter: !isPlaceholder ? 'drop-shadow(0 0 8px rgba(0,0,0,0.3))' : undefined
          }}
        />
      </svg>
      
      {/* Center content */}
      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-center",
        showSkeleton && "opacity-0"
      )}>
        {isPlaceholder ? (
          <div className="text-center px-2">
            {showClickable && size >= 100 ? (
              <div className="space-y-0.5">
                <div className="text-xs text-gray-400">Oops!</div>
                <div className={cn(
                  "font-medium text-gray-500",
                  (requestStatus === 'pending' || requestStatus === 'fetching') && "animate-pulse"
                )}>
                  {getStatusText()}
                </div>
                <div className="text-[10px] text-gray-600">Click to update</div>
              </div>
            ) : (
              <span className={cn(
                "font-medium text-gray-500",
                size >= 100 ? "text-base" : size >= 60 ? "text-xs" : "text-[10px]",
                (requestStatus === 'pending' || requestStatus === 'fetching') && "animate-pulse"
              )}>
                {getStatusText()}
              </span>
            )}
          </div>
        ) : (
          <span className={cn(
            "font-bold text-white",
            size >= 100 ? "text-3xl" : size >= 60 ? "text-lg" : "text-xs"
          )}>
            {percentage}%
          </span>
        )}
      </div>
    </div>
  )
}