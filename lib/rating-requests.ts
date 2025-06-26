// Client-side helper functions for rating requests using existing API

interface AlsoLikedResponse {
  percentage: number | null
  status: 'found' | 'not_found' | 'error' | 'queued'
  cached: boolean
  message?: string
}

export async function requestRating(mediaId: string): Promise<AlsoLikedResponse> {
  const response = await fetch(`/api/media/${mediaId}/also-liked`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to request rating')
  }

  return response.json()
}

export async function getRatingStatus(mediaId: string): Promise<AlsoLikedResponse> {
  const response = await fetch(`/api/media/${mediaId}/also-liked`)

  if (!response.ok) {
    throw new Error('Failed to get rating status')
  }

  return response.json()
}

// Hook to manage rating request state
import { useState, useEffect } from 'react'

export function useRatingRequest(
  mediaId: string | undefined,
  hasExistingRating: boolean
) {
  const [requestStatus, setRequestStatus] = useState<
    'idle' | 'pending' | 'fetching' | 'completed' | 'failed'
  >('idle')
  const [percentage, setPercentage] = useState<number | null>(null)

  useEffect(() => {
    if (!mediaId || hasExistingRating) {
      setRequestStatus('idle')
      return
    }

    // Only check if we already have a rating, don't auto-fetch
    getRatingStatus(mediaId)
      .then((result) => {
        if (result.status === 'found' && result.percentage !== null) {
          setPercentage(result.percentage)
          setRequestStatus('completed')
        } else {
          // Always stay idle until user clicks, even if queued
          setRequestStatus('idle')
        }
      })
      .catch((error) => {
        console.error('Failed to check rating status:', error)
        setRequestStatus('idle')
      })
  }, [mediaId, hasExistingRating])

  const handleRequestRating = async () => {
    if (!mediaId) return
    
    setRequestStatus('pending')
    try {
      const result = await requestRating(mediaId)
      
      if (result.status === 'found' && result.percentage !== null) {
        setPercentage(result.percentage)
        setRequestStatus('completed')
      } else if (result.status === 'queued') {
        setRequestStatus('fetching')
        // Poll for updates
        pollForUpdates(mediaId)
      } else if (result.status === 'not_found') {
        setRequestStatus('failed')
      }
    } catch (error) {
      console.error('Failed to request rating:', error)
      setRequestStatus('failed')
    }
  }

  const pollForUpdates = async (mediaId: string) => {
    const maxAttempts = 10 // Poll for up to 5 seconds (10 * 500ms)
    let attempts = 0
    
    const interval = setInterval(async () => {
      attempts++
      
      try {
        const result = await getRatingStatus(mediaId)
        
        if (result.status === 'found' && result.percentage !== null) {
          setPercentage(result.percentage)
          setRequestStatus('completed')
          clearInterval(interval)
        } else if (result.status === 'not_found' || attempts >= maxAttempts) {
          setRequestStatus('failed')
          clearInterval(interval)
        }
      } catch (error) {
        console.error('Polling error:', error)
        if (attempts >= maxAttempts) {
          setRequestStatus('failed')
          clearInterval(interval)
        }
      }
    }, 500) // Poll every 500ms for faster response
  }

  return {
    requestStatus,
    percentage,
    handleRequestRating,
  }
}