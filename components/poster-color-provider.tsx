'use client'

import React from 'react'

interface PosterColorProviderProps {
  posterPath: string | null
  children: React.ReactNode
}

// Simple provider that just renders children without any color extraction
export default function PosterColorProvider({ children }: PosterColorProviderProps) {
  return <>{children}</>
}