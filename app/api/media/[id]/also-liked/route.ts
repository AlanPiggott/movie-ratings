import { NextRequest, NextResponse } from 'next/server'
import { mediaService } from '@/services/database'
import { dataForSeoService } from '@/services/dataforseo'
import { supabaseAdmin } from '@/lib/supabase'
import { z } from 'zod'

// In-memory request deduplication (resets on server restart)
const activeRequests = new Map<string, Promise<AlsoLikedResponse>>()

// Clean up stale requests older than 30 seconds
setInterval(() => {
  if (activeRequests.size > 100) {
    // If map gets too large, clear it to prevent memory issues
    console.log('[also-liked API] Clearing active requests map - size exceeded 100')
    activeRequests.clear()
  }
}, 30000)

// Params validation
const paramsSchema = z.object({
  id: z.string().uuid('Invalid media ID format')
})

interface AlsoLikedResponse {
  percentage: number | null
  status: 'found' | 'not_found' | 'error' | 'queued' | 'limit_reached'
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
    
    // Check if daily limit is reached
    const { data: limitReached } = await supabaseAdmin
      .rpc('is_daily_limit_reached', { p_media_id: id })
    
    if (limitReached) {
      return NextResponse.json<AlsoLikedResponse>({
        percentage: null,
        status: 'limit_reached',
        cached: false,
        message: 'Daily fetch limit reached. Try again tomorrow.'
      })
    }

    // Don't queue here - let the POST endpoint handle it
    // This prevents double searching when auto-fetch is enabled
    return NextResponse.json<AlsoLikedResponse>({
      percentage: null,
      status: 'not_found',
      cached: false,
      message: 'No rating data available yet.'
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
  console.log(`[POST /api/media/${params.id}/also-liked] Request received at:`, new Date().toISOString())
  
  try {
    // Validate params
    const { id } = paramsSchema.parse(params)
    
    // Check if there's already an active request for this media
    const existingRequest = activeRequests.get(id)
    if (existingRequest) {
      console.log(`[POST /api/media/${id}/also-liked] Deduplicating - returning existing request`)
      return NextResponse.json(await existingRequest)
    }

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
      console.log(`[POST /api/media/${id}/also-liked] Returning cached data:`, media.also_liked_percentage)
      return NextResponse.json<AlsoLikedResponse>({
        percentage: media.also_liked_percentage,
        status: 'found',
        cached: true
      })
    }
    
    // Check if daily limit is reached
    const { data: limitReached } = await supabaseAdmin
      .rpc('is_daily_limit_reached', { p_media_id: id })
    
    if (limitReached) {
      return NextResponse.json<AlsoLikedResponse>({
        percentage: null,
        status: 'limit_reached',
        cached: false,
        message: 'Daily fetch limit reached. Try again tomorrow.'
      })
    }
    
    // Record the fetch attempt
    console.log(`[POST /api/media/${id}/also-liked] Recording fetch attempt for:`, media.title)
    await supabaseAdmin
      .rpc('record_fetch_attempt', { p_media_id: id, p_success: false })

    // Build limited query strategies (max 3)
    const year = media.release_date ? new Date(media.release_date).getFullYear() : null
    
    const queries: string[] = []
    
    // Build query strategies - max 3 per media type
    if (media.media_type === 'TV_SHOW') {
      // Query 1: Title + year + "tv show" (most specific)
      if (year) {
        queries.push(`${media.title} ${year} tv show`)
      }
      // Query 2: Title + "tv show" 
      queries.push(`${media.title} tv show`)
      // Query 3: Title + "series" (fallback)
      queries.push(`${media.title} series`)
    } else {
      // Movies
      // Query 1: Title + year + "movie" (most specific)
      if (year) {
        queries.push(`${media.title} ${year} movie`)
      }
      // Query 2: Title + "movie"
      queries.push(`${media.title} movie`)
      // Query 3: Title + "film" (fallback)
      queries.push(`${media.title} film`)
    }
    
    // Limit to exactly 3 queries
    const uniqueQueries = [...new Set(queries)].slice(0, 3)
    
    // Create a promise for this request and store it
    const requestPromise = (async (): Promise<AlsoLikedResponse> => {
      try {
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
            
            // Mark the attempt as successful
            await supabaseAdmin
              .rpc('record_fetch_attempt', { p_media_id: id, p_success: true })
            
            console.log(`✅ Found rating ${result.percentage}% for "${media.title}" - stopping search`)

            return {
              percentage: result.percentage,
              status: 'found',
              cached: false
            }
          }
        }
        
        console.log(`❌ No rating found for "${media.title}" after trying all ${uniqueQueries.length} queries`)
        
        // Queue for background retry later (but don't wait for it)
        const { queueSentimentFetch } = await import('@/services/queue/sentiment-queue')
        queueSentimentFetch(id, 'low').catch(console.error)
        
        return {
          percentage: null,
          status: 'not_found',
          cached: false,
          message: 'No sentiment data found for this title'
        }
      } finally {
        // Clean up the active request after completion
        activeRequests.delete(id)
      }
    })()
    
    // Store the promise to prevent duplicate requests
    activeRequests.set(id, requestPromise)
    
    // Wait for and return the result
    const result = await requestPromise
    return NextResponse.json<AlsoLikedResponse>(result)


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