'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface RangeSliderProps {
  min: number
  max: number
  step?: number
  value: [number, number]
  onChange: (value: [number, number]) => void
  label?: string
  formatValue?: (value: number) => string
  className?: string
}

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  formatValue = (v) => v.toString(),
  className
}: RangeSliderProps) {
  const [localValue, setLocalValue] = useState(value)
  const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const getPercentage = (val: number) => {
    return ((val - min) / (max - min)) * 100
  }

  const getValueFromMouseEvent = useCallback((e: MouseEvent) => {
    if (!trackRef.current) return null
    
    const rect = trackRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.min(Math.max(x / rect.width, 0), 1)
    const rawValue = min + percentage * (max - min)
    const steppedValue = Math.round(rawValue / step) * step
    
    return Math.min(Math.max(steppedValue, min), max)
  }, [min, max, step])

  const updateValue = useCallback((type: 'min' | 'max', newValue: number) => {
    const [currentMin, currentMax] = localValue
    
    if (type === 'min') {
      const newMin = Math.min(newValue, currentMax - step)
      const newRange: [number, number] = [newMin, currentMax]
      setLocalValue(newRange)
      onChange(newRange)
    } else {
      const newMax = Math.max(newValue, currentMin + step)
      const newRange: [number, number] = [currentMin, newMax]
      setLocalValue(newRange)
      onChange(newRange)
    }
  }, [localValue, onChange, step])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      const newValue = getValueFromMouseEvent(e)
      if (newValue !== null) {
        updateValue(isDragging, newValue)
      }
    }

    const handleMouseUp = () => {
      setIsDragging(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, getValueFromMouseEvent, updateValue])

  const handleThumbMouseDown = (type: 'min' | 'max') => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(type)
  }

  const handleTrackClick = (e: React.MouseEvent) => {
    if (isDragging) return
    
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const x = e.clientX - rect.left
    const percentage = Math.min(Math.max(x / rect.width, 0), 1)
    const rawValue = min + percentage * (max - min)
    const clickValue = Math.round(rawValue / step) * step
    const clampedValue = Math.min(Math.max(clickValue, min), max)
    
    const [currentMin, currentMax] = localValue
    const distToMin = Math.abs(clampedValue - currentMin)
    const distToMax = Math.abs(clampedValue - currentMax)
    
    if (distToMin < distToMax) {
      updateValue('min', clampedValue)
    } else {
      updateValue('max', clampedValue)
    }
  }

  const minPercentage = getPercentage(localValue[0])
  const maxPercentage = getPercentage(localValue[1])

  return (
    <div className={cn('space-y-3 select-none', className)} ref={containerRef}>
      <div className="flex items-center justify-between">
        {label && <span className="text-sm font-medium text-gray-300">{label}</span>}
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono bg-white/10 px-2 py-1 rounded text-white">
            {formatValue(localValue[0])}
          </span>
          <span className="text-xs text-gray-500">to</span>
          <span className="text-sm font-mono bg-white/10 px-2 py-1 rounded text-white">
            {formatValue(localValue[1])}
          </span>
        </div>
      </div>
      
      <div 
        className="relative h-6 flex items-center"
        onMouseDown={handleTrackClick}
      >
        {/* Track Background */}
        <div
          ref={trackRef}
          className="absolute w-full h-2 bg-white/10 rounded-full cursor-pointer"
        />
        
        {/* Active Track */}
        <div
          className="absolute h-2 bg-accent rounded-full pointer-events-none"
          style={{
            left: `${minPercentage}%`,
            width: `${maxPercentage - minPercentage}%`
          }}
        />
        
        {/* Min Thumb */}
        <div
          className={cn(
            "absolute w-6 h-6 -ml-3 bg-white rounded-full shadow-xl transition-transform cursor-grab border-2 border-accent",
            isDragging === 'min' && "scale-125 shadow-2xl cursor-grabbing"
          )}
          style={{ left: `${minPercentage}%` }}
          onMouseDown={handleThumbMouseDown('min')}
          role="slider"
          aria-label={`Minimum value: ${formatValue(localValue[0])}`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={localValue[0]}
        />
        
        {/* Max Thumb */}
        <div
          className={cn(
            "absolute w-6 h-6 -ml-3 bg-white rounded-full shadow-xl transition-transform cursor-grab border-2 border-accent",
            isDragging === 'max' && "scale-125 shadow-2xl cursor-grabbing"
          )}
          style={{ left: `${maxPercentage}%` }}
          onMouseDown={handleThumbMouseDown('max')}
          role="slider"
          aria-label={`Maximum value: ${formatValue(localValue[1])}`}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={localValue[1]}
        />
      </div>
    </div>
  )
}