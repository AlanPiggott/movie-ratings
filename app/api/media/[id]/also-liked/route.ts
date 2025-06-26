import { NextRequest, NextResponse } from 'next/server'
import { mediaService } from '@/services/database'
import { dataForSeoService } from '@/services/dataforseo'
import { queueSentimentFetch } from '@/services/queue/sentiment-queue'
import { z } from 'zod'

// Params validation
const paramsSchema = z.object({
  id: z.string().uuid('Invalid media ID format')
})

interface AlsoLikedResponse {
  percentage: number | null
  status: 'found' | 'not_found' | 'error' | 'queued'
  cached: boolean
  message?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate params
    const { id } = paramsSchema.parse(params)

    // First, check if we already have the data
    const media = await mediaService.getMediaById(id)
    
    if (!media) {
      return NextResponse.json<AlsoLikedResponse>(
        { 
          percentage: null, 
          status: 'error',
          cached: false,
          message: 'Media not found' 
        },
        { status: 404 }
      )
    }

    // Return cached data if available
    if (media.also_liked_percentage !== null) {
      return NextResponse.json<AlsoLikedResponse>({
        percentage: media.also_liked_percentage,
        status: 'found',
        cached: true
      })
    }

    // Queue for background processing
    await queueSentimentFetch(id, 'high')

    return NextResponse.json<AlsoLikedResponse>({
      percentage: null,
      status: 'queued',
      cached: false,
      message: 'Sentiment fetch queued. Check back in a few moments.'
    })

  } catch (error) {
    console.error('Also-liked API error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json<AlsoLikedResponse>(
        { 
          percentage: null,
          status: 'error',
          cached: false,
          message: 'Invalid request' 
        },
        { status: 400 }
      )
    }

    return NextResponse.json<AlsoLikedResponse>(
      { 
        percentage: null,
        status: 'error',
        cached: false,
        message: 'Failed to fetch sentiment data' 
      },
      { status: 500 }
    )
  }
}

// POST endpoint for immediate fetch (requires authentication in production)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Validate params
    const { id } = paramsSchema.parse(params)

    // Check if DataForSEO is configured
    if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
      return NextResponse.json<AlsoLikedResponse>({
        percentage: null,
        status: 'error',
        cached: false,
        message: 'Sentiment service not configured'
      }, { status: 503 })
    }

    // Get media details
    const media = await mediaService.getMediaById(id)
    
    if (!media) {
      return NextResponse.json<AlsoLikedResponse>(
        { 
          percentage: null, 
          status: 'error',
          cached: false,
          message: 'Media not found' 
        },
        { status: 404 }
      )
    }

    // Return cached data if available
    if (media.also_liked_percentage !== null) {
      return NextResponse.json<AlsoLikedResponse>({
        percentage: media.also_liked_percentage,
        status: 'found',
        cached: true
      })
    }

    // Build multiple query strategies
    const mediaTypeStr = media.media_type === 'TV_SHOW' ? 'tv show' : 'movie'
    const year = media.release_date ? new Date(media.release_date).getFullYear() : null
    
    // Clean title for special characters
    const cleanTitle = media.title
      .replace(/['']/g, '') // Remove smart quotes
      .replace(/[éèêë]/g, 'e')
      .replace(/[áàäâ]/g, 'a')
      .replace(/[ñ]/g, 'n')
      .replace(/[öô]/g, 'o')
      .replace(/[üùû]/g, 'u')
      .replace(/[ç]/g, 'c')
    
    const queries: string[] = []
    
    // Build query strategies in order of preference
    if (media.media_type === 'TV_SHOW') {
      // TV shows - prioritize "tv show" queries
      if (year) {
        queries.push(`${media.title} ${year} tv show`)
        queries.push(`${media.title} (${year}) tv show`)
        
        // Add clean version if different
        if (cleanTitle !== media.title) {
          queries.push(`${cleanTitle} ${year} tv show`)
        }
        
        // For titles with colons, try without subtitle
        if (media.title.includes(':')) {
          const mainTitle = media.title.split(':')[0].trim()
          queries.push(`${mainTitle} ${year} tv show`)
        }
      }
      queries.push(`${media.title} tv show`)
      queries.push(`${media.title} series`)
    } else {
      // Movies - prioritize "movie" queries
      if (year) {
        queries.push(`${media.title} ${year} movie`)
        queries.push(`${media.title} (${year}) movie`)
        queries.push(`"${media.title}" ${year} film`)
        
        // Add clean version if different
        if (cleanTitle !== media.title) {
          queries.push(`${cleanTitle} ${year} movie`)
        }
        
        // For titles with colons, try without subtitle
        if (media.title.includes(':')) {
          const mainTitle = media.title.split(':')[0].trim()
          queries.push(`${mainTitle} ${year} movie`)
        }
        
        queries.push(`${media.title} ${year} film`)
      }
      queries.push(`${media.title} movie`)
    }
    
    // Add clean version without year if different
    if (cleanTitle !== media.title) {
      queries.push(`${cleanTitle} ${mediaTypeStr}`)
    }
    
    // Remove duplicates
    const uniqueQueries = [...new Set(queries)]
    
    // Try each query strategy
    for (const query of uniqueQueries) {
      console.log(`Trying query: "${query}"`)
      const result = await dataForSeoService.searchGoogleKnowledge(query)
      
      if (result.percentage !== null) {
        // Update the database
        await mediaService.createOrUpdateMedia({
          tmdbId: media.tmdb_id,
          mediaType: media.media_type,
          title: media.title,
          alsoLikedPercentage: result.percentage
        })

        return NextResponse.json<AlsoLikedResponse>({
          percentage: result.percentage,
          status: 'found',
          cached: false
        })
      }
    }

    return NextResponse.json<AlsoLikedResponse>({
      percentage: null,
      status: 'not_found',
      cached: false,
      message: 'No sentiment data found for this title'
    })

  } catch (error) {
    console.error('Also-liked POST error:', error)

    return NextResponse.json<AlsoLikedResponse>(
      { 
        percentage: null,
        status: 'error',
        cached: false,
        message: error instanceof Error ? error.message : 'Failed to fetch sentiment' 
      },
      { status: 500 }
    )
  }
}