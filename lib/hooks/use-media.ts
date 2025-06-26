'use client'

import { useState, useEffect } from 'react'
import { MediaItemWithGenres } from '@/services/database/media.service'

interface MediaDetailsResponse extends MediaItemWithGenres {
  streamingProviders: Array<{
    name: string
    type: string
    logoPath?: string
  }>
  hasSentiment: boolean
  sentimentLoading: boolean
  tagline?: string
  homepage?: string
  budget?: number
  revenue?: number
  imdbId?: string
}

interface AlsoLikedResponse {
  percentage: number | null
  status: 'found' | 'not_found' | 'error' | 'queued'
  cached: boolean
  message?: string
}

/**
 * Hook to fetch and manage media details
 */
export function useMedia(mediaId: string | null) {
  const [media, setMedia] = useState<MediaDetailsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mediaId) {
      setMedia(null)
      return
    }

    const fetchMedia = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/media/${mediaId}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch media details')
        }

        const data = await response.json()
        setMedia(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchMedia()
  }, [mediaId])

  return { media, loading, error }
}

/**
 * Hook to fetch and poll for also-liked percentage
 */
export function useAlsoLiked(mediaId: string | null, initialPercentage?: number | null) {
  const [percentage, setPercentage] = useState<number | null>(initialPercentage ?? null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'found' | 'not_found' | 'error'>('idle')
  const [polling, setPolling] = useState(false)

  // Fetch also-liked percentage
  const fetchAlsoLiked = async (immediate = false) => {
    if (!mediaId) return

    setStatus('loading')

    try {
      const url = `/api/media/${mediaId}/also-liked`
      const response = await fetch(url, {
        method: immediate ? 'POST' : 'GET'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch sentiment')
      }

      const data: AlsoLikedResponse = await response.json()

      if (data.status === 'found') {
        setPercentage(data.percentage)
        setStatus('found')
        setPolling(false)
      } else if (data.status === 'queued') {
        setStatus('loading')
        // Start polling if not immediate
        if (!immediate && !polling) {
          setPolling(true)
        }
      } else if (data.status === 'not_found') {
        setStatus('not_found')
        setPolling(false)
      } else {
        setStatus('error')
        setPolling(false)
      }
    } catch (err) {
      setStatus('error')
      setPolling(false)
    }
  }

  // Initial fetch
  useEffect(() => {
    if (mediaId && initialPercentage === null && status === 'idle') {
      fetchAlsoLiked()
    }
  }, [mediaId, initialPercentage, status])

  // Polling effect
  useEffect(() => {
    if (!polling || !mediaId) return

    const interval = setInterval(() => {
      fetchAlsoLiked()
    }, 5000) // Poll every 5 seconds

    // Stop polling after 30 seconds
    const timeout = setTimeout(() => {
      setPolling(false)
      if (status === 'loading') {
        setStatus('not_found')
      }
    }, 30000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [polling, mediaId])

  // Trigger immediate fetch
  const triggerFetch = () => {
    if (mediaId && status !== 'loading') {
      fetchAlsoLiked(true)
    }
  }

  return {
    percentage,
    status,
    loading: status === 'loading',
    triggerFetch
  }
}

/**
 * Hook to track media view
 */
export function useTrackView(mediaId: string | null) {
  useEffect(() => {
    if (!mediaId) return

    // Track view after a short delay
    const timeout = setTimeout(() => {
      fetch(`/api/media/${mediaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'increment_view' })
      }).catch(err => console.error('Failed to track view:', err))
    }, 2000)

    return () => clearTimeout(timeout)
  }, [mediaId])
}