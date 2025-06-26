import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { extractIdFromSlug } from '@/lib/utils'
import MediaDetailsClient from './media-details-client'

interface PageProps {
  params: {
    mediaType: string
    id: string
  }
  searchParams: {
    [key: string]: string | string[] | undefined
  }
}

// Revalidate pages every hour
export const revalidate = 3600

async function fetchMediaDetails(id: string) {
  // In server components, we need to construct the full URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  
  try {
    const response = await fetch(`${baseUrl}/api/media/${id}`, {
      cache: 'no-store'
    })
    
    if (!response.ok) {
      console.error(`Media fetch failed: ${response.status} ${response.statusText}`)
      return null
    }
    
    return response.json()
  } catch (error) {
    console.error('Media fetch error:', error)
    return null
  }
}

// Generate metadata dynamically
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { mediaType, id: slugOrId } = params
  
  if (mediaType !== 'movie' && mediaType !== 'tv') {
    return {
      title: 'Not Found - Movie Score',
    }
  }
  
  const mediaId = extractIdFromSlug(slugOrId)
  
  
  const mediaDetails = await fetchMediaDetails(mediaId)
  
  if (!mediaDetails) {
    return {
      title: 'Not Found - Movie Score',
    }
  }
  
  return {
    title: `${mediaDetails.title} - Movie Score`,
    description: mediaDetails.overview || `View Google audience score and details for ${mediaDetails.title}`,
    openGraph: {
      title: mediaDetails.title,
      description: mediaDetails.overview || `View Google audience score and details for ${mediaDetails.title}`,
      images: mediaDetails.poster_path ? [`https://image.tmdb.org/t/p/w500${mediaDetails.poster_path}`] : [],
    },
  }
}

export default async function Page({ params, searchParams }: PageProps) {
  const { mediaType, id: slugOrId } = params
  
  // Validate media type
  if (mediaType !== 'movie' && mediaType !== 'tv') {
    notFound()
  }
  
  const mediaId = extractIdFromSlug(slugOrId)
  
  
  const mediaDetails = await fetchMediaDetails(mediaId)
  
  if (!mediaDetails) {
    notFound()
  }
  
  // Use the client component for media details
  return <MediaDetailsClient initialMedia={mediaDetails} />
}