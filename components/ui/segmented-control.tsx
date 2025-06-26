'use client'

import { cn } from '@/lib/utils'

interface SegmentedControlOption {
  value: string
  label: string
}

interface SegmentedControlProps {
  options: SegmentedControlOption[]
  value: string
  onChange: (value: string) => void
  className?: string
}

export function SegmentedControl({ options, value, onChange, className }: SegmentedControlProps) {
  return (
    <div className={cn('inline-flex p-1 bg-white/10 rounded-lg', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 whitespace-nowrap',
            'hover:bg-white/10',
            value === option.value
              ? 'bg-white text-black shadow-sm'
              : 'text-gray-400 hover:text-white'
          )}
          aria-label={option.label}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}