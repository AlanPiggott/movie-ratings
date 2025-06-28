import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { extractIdFromSlug } from '@/lib/utils'
import MediaDetailsClient from './media-details-client'
import { supabaseAdmin } from '@/lib/supabase'
import { tmdbService } from '@/services/tmdb.service'
import { processWatchProviders } from '@/lib/utils/watch-providers'

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
  try {
    // Fetch media from database directly instead of using API route
    const { data: mediaArray, error } = await supabaseAdmin
      .from('media_items')
      .select(`
        *,
        media_genres(
          genre:genres(*)
        )
      `)
      .eq('id', id)
      .single()
    
    const media = mediaArray
    
    if (error || !media) {
      return null
    }

    // Transform genres
    const genres = media.media_genres?.map((mg: any) => mg.genre).filter(Boolean) || []

    // Fetch additional details from TMDB
    let additionalDetails = {}
    let watchProviders = null
    
    try {
      const tmdbDetails = media.media_type === 'MOVIE' 
        ? await tmdbService.getMovieDetails(media.tmdb_id)
        : await tmdbService.getTVDetails(media.tmdb_id)
      
      // Base details
      if (media.media_type === 'MOVIE') {
        const movieDetails = tmdbDetails as any
        additionalDetails = {
          homepage: movieDetails.homepage,
          tagline: movieDetails.tagline,
          runtime: movieDetails.runtime || media.runtime,
          budget: movieDetails.budget,
          revenue: movieDetails.revenue,
          production_companies: movieDetails.production_companies,
          spoken_languages: movieDetails.spoken_languages,
        }
      } else {
        const tvDetails = tmdbDetails as any
        additionalDetails = {
          homepage: tvDetails.homepage,
          tagline: tvDetails.tagline,
          number_of_seasons: tvDetails.number_of_seasons,
          number_of_episodes: tvDetails.number_of_episodes,
          networks: tvDetails.networks,
          created_by: tvDetails.created_by,
          last_air_date: tvDetails.last_air_date,
          in_production: tvDetails.in_production,
        }
      }
      
      // Process watch providers
      const detailsWithProviders = tmdbDetails as any
      if (detailsWithProviders['watch/providers']?.results?.US) {
        const mediaInfo = {
          title: media.title,
          year: media.release_date ? new Date(media.release_date).getFullYear() : undefined,
          mediaType: media.media_type === 'MOVIE' ? 'movie' as const : 'tv' as const,
          tmdbId: media.tmdb_id
        }
        watchProviders = processWatchProviders(
          detailsWithProviders['watch/providers'].results.US,
          mediaInfo
        )
      }
      
      // Extract credits
      if (detailsWithProviders.credits) {
        additionalDetails = {
          ...additionalDetails,
          credits: {
            cast: detailsWithProviders.credits.cast?.slice(0, 10) || [],
            crew: detailsWithProviders.credits.crew?.filter((c: any) => 
              ['Director', 'Producer', 'Writer', 'Executive Producer'].includes(c.job)
            ).slice(0, 6) || []
          }
        }
      }
      
      // Extract videos
      if (detailsWithProviders.videos) {
        additionalDetails = {
          ...additionalDetails,
          videos: detailsWithProviders.videos.results?.filter((v: any) => 
            v.site === 'YouTube' && ['Trailer', 'Teaser'].includes(v.type)
          ).slice(0, 3) || []
        }
      }

    } catch (tmdbError) {
      console.error('TMDB fetch error:', tmdbError)
    }

    // Fetch similar content
    let similar = []
    
    if (genres.length > 0) {
      const { data: genreMatches } = await supabaseAdmin
        .from('media_genres')
        .select('media_item_id')
        .in('genre_id', genres.map((g: any) => g.id))
      
      const matchingIds = genreMatches?.map((d: any) => d.media_item_id) || []
      
      if (matchingIds.length > 0) {
        const { data: similarByGenre } = await supabaseAdmin
          .from('media_items')
          .select('*')
          .eq('media_type', media.media_type)
          .neq('id', media.id)
          .not('also_liked_percentage', 'is', null)
          .in('id', matchingIds)
          .order('popularity', { ascending: false })
          .limit(12)
        
        similar = similarByGenre || []
      }
    }
    
    // Fallback: If no genre matches, get random popular items
    if (similar.length === 0) {
      const { data: randomPopular } = await supabaseAdmin
        .from('media_items')
        .select('*')
        .eq('media_type', media.media_type)
        .neq('id', media.id)
        .not('also_liked_percentage', 'is', null)
        .order('popularity', { ascending: false })
        .limit(12)
      
      similar = randomPopular || []
    }

    // Return combined data
    return {
      ...media,
      genres,
      similar: similar || [],
      watch_providers: watchProviders || media.watch_providers,
      content_rating: media.content_rating,
      ...additionalDetails
    }
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