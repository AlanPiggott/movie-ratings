'use client'

import { useEffect, useState } from 'react'

interface ColorPalette {
  vibrant: string | null
  darkVibrant: string | null
  lightVibrant: string | null
  muted: string | null
  darkMuted: string | null
  lightMuted: string | null
}

export function usePosterColor(posterPath: string | null) {
  const [colors, setColors] = useState<ColorPalette>({
    vibrant: null,
    darkVibrant: null,
    lightVibrant: null,
    muted: null,
    darkMuted: null,
    lightMuted: null,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!posterPath) {
      setIsLoading(false)
      return
    }

    const extractColors = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const Vibrant = (await import('node-vibrant') as any)
        const img = `https://image.tmdb.org/t/p/w500${posterPath}`
        
        const palette = await Vibrant.from(img)
          .maxColorCount(64)
          .quality(5)
          .getPalette()
        
        setColors({
          vibrant: palette.Vibrant?.hex || null,
          darkVibrant: palette.DarkVibrant?.hex || null,
          lightVibrant: palette.LightVibrant?.hex || null,
          muted: palette.Muted?.hex || null,
          darkMuted: palette.DarkMuted?.hex || null,
          lightMuted: palette.LightMuted?.hex || null,
        })
      } catch (error) {
        console.error('Error extracting colors:', error)
        // Set default accent color on error
        setColors(prev => ({ ...prev, vibrant: '#F5C518' }))
      } finally {
        setIsLoading(false)
      }
    }

    extractColors()
  }, [posterPath])

  // Get the best accent color with fallback
  const accentColor = colors.vibrant || colors.lightVibrant || colors.darkVibrant || '#F5C518'
  
  return { colors, accentColor, isLoading }
}