'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function MediaRedirectPage() {
  const params = useParams()
  const router = useRouter()
  const mediaId = params.id as string

  useEffect(() => {
    // Fetch media type and redirect to new URL structure
    const fetchAndRedirect = async () => {
      try {
        const response = await fetch(`/api/media/${mediaId}`)
        const data = await response.json()
        
        if (data && data.media_type) {
          const mediaType = data.media_type === 'MOVIE' ? 'movie' : 'tv'
          router.replace(`/${mediaType}/${mediaId}`)
        } else {
          // If we can't determine the type, go home
          router.push('/')
        }
      } catch (error) {
        console.error('Error fetching media type:', error)
        router.push('/')
      }
    }

    fetchAndRedirect()
  }, [mediaId, router])

  // Show loading state while redirecting
  return (
    <div className="min-h-screen bg-[#0E0F13] flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#F5C518] mb-4"></div>
        <p className="text-zinc-400">Redirecting...</p>
      </div>
    </div>
  )
}