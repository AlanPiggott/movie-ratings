import { NextRequest, NextResponse } from 'next/server'
import { dataForSeoService } from '@/services/dataforseo'
import { prisma } from '@/lib/prisma/client'
import { z } from 'zod'

// Request validation schema
const requestSchema = z.object({
  title: z.string().min(1).max(200),
  mediaType: z.enum(['MOVIE', 'TV_SHOW']).optional(),
  tmdbId: z.number().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const { title, mediaType, tmdbId } = requestSchema.parse(body)

    // Create search query with media type hint
    const searchQuery = mediaType === 'TV_SHOW' 
      ? `${title} TV show`
      : `${title} movie`

    // Search for sentiment using DataForSEO
    const result = await dataForSeoService.searchGoogleKnowledge(searchQuery)

    // Update database if we have a TMDB ID
    if (tmdbId && result.percentage !== null) {
      try {
        await prisma.mediaItem.update({
          where: { tmdbId },
          data: {
            alsoLikedPercentage: result.percentage,
            searchCount: { increment: 1 },
            lastSearched: new Date(),
          },
        })
      } catch (error) {
        // Media item might not exist yet, that's okay
        console.log('Could not update media item:', error)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        title,
        percentage: result.percentage,
        found: result.percentage !== null,
        cost: result.cost,
        responseTime: result.responseTime,
      },
    })
  } catch (error) {
    console.error('Sentiment search error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sentiment data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check API usage stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    
    const since = new Date()
    since.setDate(since.getDate() - days)
    
    const stats = await dataForSeoService.getUsageStats(since)
    
    return NextResponse.json({
      success: true,
      period: `Last ${days} days`,
      stats,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch usage stats',
      },
      { status: 500 }
    )
  }
}