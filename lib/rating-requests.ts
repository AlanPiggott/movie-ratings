// Client-side helper functions for rating requests using existing API

interface AlsoLikedResponse {
  percentage: number | null
  status: 'found' | 'not_found' | 'error' | 'queued' | 'limit_reached'
  cached: boolean
  message?: string
}

export async function requestRating(mediaId: string): Promise<AlsoLikedResponse> {
  console.log('[requestRating] Making POST request for media:', mediaId)
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
import { useState, useEffect, useCallback, useRef } from 'react'

export function useRatingRequest(
  mediaId: string | undefined,
  hasExistingRating: boolean,
  autoFetch: boolean = true
) {
  const [requestStatus, setRequestStatus] = useState<
    'idle' | 'pending' | 'fetching' | 'completed' | 'failed' | 'limit_reached'
  >('idle')
  const [percentage, setPercentage] = useState<number | null>(null)
  // Use useRef for synchronous guard against duplicate auto-fetches
  const hasAutoFetchedRef = useRef(false)
  // Add a ref to track if we're currently processing a request
  const isProcessingRef = useRef(false)

  const pollForUpdates = useCallback(async (mediaId: string) => {
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
  }, [])

  const handleRequestRating = useCallback(async () => {
    if (!mediaId) return
    
    console.log('[handleRequestRating] Called for media:', mediaId)
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
      } else if (result.status === 'limit_reached') {
        setRequestStatus('limit_reached')
      }
    } catch (error) {
      console.error('Failed to request rating:', error)
      setRequestStatus('failed')
    }
  }, [mediaId, pollForUpdates])

  useEffect(() => {
    // Detect if we're in StrictMode (development double-render)
    const isStrictMode = process.env.NODE_ENV === 'development'
    
    console.log('[useEffect] Auto-fetch check - mediaId:', mediaId, 'hasExistingRating:', hasExistingRating, 'autoFetch:', autoFetch, 'hasAutoFetchedRef:', hasAutoFetchedRef.current, 'isProcessing:', isProcessingRef.current)
    
    if (!mediaId || hasExistingRating) {
      setRequestStatus('idle')
      return
    }

    // Prevent duplicate auto-fetches using synchronous ref checks
    if (requestStatus !== 'idle' || hasAutoFetchedRef.current || isProcessingRef.current) {
      console.log('[useEffect] Skipping - already fetched or in progress')
      return
    }

    // Only run auto-fetch logic once
    if (autoFetch && !hasAutoFetchedRef.current && !isProcessingRef.current) {
      // Immediately set BOTH refs to prevent duplicate calls
      hasAutoFetchedRef.current = true
      isProcessingRef.current = true
      
      console.log('[useEffect] Starting auto-fetch for media:', mediaId, isStrictMode ? '(StrictMode enabled)' : '')
      
      // Check if we already have a rating
      getRatingStatus(mediaId)
        .then((result) => {
          if (result.status === 'found' && result.percentage !== null) {
            setPercentage(result.percentage)
            setRequestStatus('completed')
          } else if (result.status === 'limit_reached') {
            setRequestStatus('limit_reached')
          } else {
            // Auto-fetch if no rating exists
            handleRequestRating()
          }
        })
        .catch((error) => {
          console.error('Failed to check rating status:', error)
          // Still try to fetch even if status check failed
          handleRequestRating()
        })
        .finally(() => {
          // Clear the processing flag after completion
          isProcessingRef.current = false
        })
    }
  }, [mediaId, hasExistingRating, autoFetch, requestStatus])

  // Reset the refs when mediaId changes
  useEffect(() => {
    hasAutoFetchedRef.current = false
    isProcessingRef.current = false
  }, [mediaId])

  return {
    requestStatus,
    percentage,
    handleRequestRating,
  }
}