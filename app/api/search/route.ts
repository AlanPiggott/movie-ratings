import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { mediaService } from '@/services/database'
import { tmdbService } from '@/services/tmdb.service'
import type { MediaType } from '@/services/database/media.service'

// Validation schema for query parameters
const searchSchema = z.object({
  q: z.string().min(1).max(100),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(50).optional().default(20),
})

// Response types
interface SearchResult {
  id: string
  title: string
  year: number | null
  mediaType: 'MOVIE' | 'TV_SHOW'
  posterPath: string | null
  alsoLikedPercentage: number | null
  imdbRating: number | null
  overview: string | null
}

interface SearchResponse {
  results: SearchResult[]
  source: 'database' | 'mixed' | 'external'
  total: number
  query: string
}

// Genre cache to avoid repeated API calls
let genreCache: { movies: Map<number, string>, tv: Map<number, string> } | null = null

// Helper function to clean title for special characters
function cleanTitle(title: string): string {
  return title
    .replace(/['']/g, '')
    .replace(/[éèêë]/g, 'e')
    .replace(/[áàäâ]/g, 'a')
    .replace(/[ñ]/g, 'n')
    .replace(/[öô]/g, 'o')
    .replace(/[üùû]/g, 'u')
    .replace(/[ç]/g, 'c')
}

// Fetch rating in background
async function fetchRatingInBackground(item: any) {
  try {
    const auth = Buffer.from(
      `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
    ).toString('base64')
    
    // Build queries
    const queries: string[] = []
    const cleanedTitle = cleanTitle(item.title)
    const year = item.release_date ? new Date(item.release_date).getFullYear() : null
    
    if (item.media_type === 'TV_SHOW') {
      if (year) {
        queries.push(`${item.title} ${year} tv show`)
        if (cleanedTitle !== item.title) {
          queries.push(`${cleanedTitle} ${year} tv show`)
        }
      }
      queries.push(`${item.title} tv show`)
    } else {
      if (year) {
        queries.push(`${item.title} ${year} movie`)
        if (cleanedTitle !== item.title) {
          queries.push(`${cleanedTitle} ${year} movie`)
        }
      }
      queries.push(`${item.title} movie`)
    }
    
    // Try first query only for background fetch (to keep it fast)
    const query = queries[0]
    
    // Create task
    const createResponse = await fetch('https://api.dataforseo.com/v3/serp/google/organic/task_post', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        language_code: 'en',
        location_code: 2840,
        keyword: query,
        device: 'desktop',
        os: 'windows'
      }])
    })
    
    if (!createResponse.ok) return
    
    const createData = await createResponse.json()
    if (createData.status_code !== 20000 || !createData.tasks?.[0]?.id) return
    
    const taskId = createData.tasks[0].id
    
    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // Fetch HTML
    const htmlResponse = await fetch(
      `https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`,
      {
        method: 'GET',
        headers: { 'Authorization': 'Basic ' + auth }
      }
    )
    
    if (!htmlResponse.ok) return
    
    const htmlData = await htmlResponse.json()
    if (htmlData.status_code !== 20000) return
    
    const html = htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html
    if (!html) return
    
    // Extract percentage
    const patterns = [
      /(\d{1,3})%\s*liked\s*this\s*(movie|film|show|series)/gi,
      /(\d{1,3})%\s*of\s*(?:Google\s*)?users\s*liked/gi,
      />(\d{1,3})%\s*liked\s*this/gi,
      /(\d{1,3})%\s*liked/gi
    ]
    
    for (const pattern of patterns) {
      const matches = html.match(pattern)
      if (matches) {
        for (const match of matches) {
          const percentMatch = match.match(/(\d{1,3})/)
          if (percentMatch) {
            const percentage = parseInt(percentMatch[1])
            if (percentage >= 0 && percentage <= 100) {
              // Update database with rating
              const { createClient } = await import('@supabase/supabase-js')
              const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_KEY!
              )
              
              await supabase.rpc('record_rating_update', {
                p_media_id: item.id,
                p_new_rating: percentage,
                p_previous_rating: null
              })
              
              console.log(`Background rating fetch: ${item.title} - ${percentage}%`)
              return
            }
          }
        }
      }
    }
  } catch (error) {
    // Silently fail - this is background processing
  }
}

export async function GET(request: NextRequest) {
  try {
    // Parse and validate query parameters
    const { searchParams } = new URL(request.url)
    const params = searchSchema.parse({
      q: searchParams.get('q'),
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    })

    const { q: query, page, limit } = params

    // Step 1: Search local database first
    const dbResults = await mediaService.searchMedia(
      query,
      {},
      { page: 1, limit: 50 } // Get more results to check if we need external search
    )

    // Transform database results to response format
    const dbSearchResults: SearchResult[] = dbResults.items.map(item => ({
      id: item.id,
      title: item.title,
      year: item.release_date ? new Date(item.release_date).getFullYear() : null,
      mediaType: item.media_type as MediaType,
      posterPath: item.poster_path,
      alsoLikedPercentage: item.also_liked_percentage,
      imdbRating: item.vote_average || null,
      overview: item.overview,
    }))

    // Step 2: Check if we need to search external API
    let finalResults = dbSearchResults
    let source: SearchResponse['source'] = 'database'
    let totalExternalResults = 0

    if (dbResults.total < 3) {
      try {
        // Search TMDB for additional results
        const tmdbResponse = await tmdbService.searchMulti(query, { page: 1 })
        totalExternalResults = tmdbResponse.total_results

        // Filter out adult content and items already in our database
        const existingTmdbIds = new Set(dbResults.items.map(item => item.tmdb_id))
        const newTmdbResults = tmdbResponse.results.filter(result => 
          result.media_type !== 'person' && // Exclude person results
          !existingTmdbIds.has(result.id)
        )

        if (newTmdbResults.length > 0) {
          // Load genre mapping if not cached
          if (!genreCache) {
            const genres = await tmdbService.getGenres()
            genreCache = {
              movies: new Map(genres.movies.map(g => [g.id, g.name])),
              tv: new Map(genres.tv.map(g => [g.id, g.name]))
            }
          }

          // Transform and save new items to database
          const savedItems = await Promise.all(
            newTmdbResults.slice(0, 10).map(async (tmdbItem) => {
              const transformed = tmdbService.transformSearchResult(tmdbItem)
              
              // Map genre IDs to genre objects
              const genreMap = tmdbItem.media_type === 'movie' ? genreCache!.movies : genreCache!.tv
              const genres = (transformed.genreIds || [])
                .map(id => ({
                  tmdbId: id,
                  name: genreMap.get(id) || 'Unknown'
                }))
                .filter(g => g.name !== 'Unknown')

              // Skip items without poster images
              if (!transformed.posterPath) {
                console.log(`Skipping ${transformed.title} - no poster image`)
                return null
              }

              try {
                // Save to database with source tracking
                const savedItem = await mediaService.createOrUpdateMedia({
                  tmdbId: transformed.tmdbId,
                  mediaType: transformed.mediaType,
                  title: transformed.title,
                  releaseDate: transformed.releaseDate,
                  posterPath: transformed.posterPath,
                  overview: transformed.overview,
                  originalTitle: transformed.originalTitle,
                  popularity: transformed.popularity,
                  voteAverage: transformed.voteAverage,
                  voteCount: transformed.voteCount,
                  genres,
                  contentSource: 'user_search'
                })
                
                // Immediately fetch Google rating for new item
                if (savedItem.also_liked_percentage === null && 
                    process.env.DATAFORSEO_LOGIN && 
                    process.env.DATAFORSEO_PASSWORD) {
                  // Queue for rating fetch in background
                  fetchRatingInBackground(savedItem).catch(error => {
                    console.error('Background rating fetch failed:', error)
                  })
                }

                return {
                  id: savedItem.id,
                  title: savedItem.title,
                  year: savedItem.release_date ? new Date(savedItem.release_date).getFullYear() : null,
                  mediaType: savedItem.media_type,
                  posterPath: savedItem.poster_path,
                  alsoLikedPercentage: savedItem.also_liked_percentage,
                  imdbRating: savedItem.vote_average || null,
                  overview: savedItem.overview || null,
                }
              } catch (error) {
                console.error('Failed to save TMDB item:', error)
                // Return the item anyway, just not saved
                return {
                  id: `tmdb-${transformed.tmdbId}`,
                  title: transformed.title,
                  year: transformed.releaseDate ? new Date(transformed.releaseDate).getFullYear() : null,
                  mediaType: transformed.mediaType,
                  posterPath: transformed.posterPath || null,
                  alsoLikedPercentage: null,
                  imdbRating: transformed.voteAverage || null,
                  overview: transformed.overview || null,
                }
              }
            })
          )

          // Combine results, filtering out null items
          finalResults = [...dbSearchResults, ...savedItems.filter(item => item !== null)]
          source = dbResults.total > 0 ? 'mixed' : 'external'
        }
      } catch (error) {
        // External search failed, continue with database results only
        console.error('TMDB search failed:', error)
        // Don't throw - we still have database results
      }
    }

    // Sort results by relevance (you can adjust this logic)
    finalResults.sort((a, b) => {
      // Prioritize exact title matches
      const aExact = a.title.toLowerCase() === query.toLowerCase() ? 1 : 0
      const bExact = b.title.toLowerCase() === query.toLowerCase() ? 1 : 0
      if (aExact !== bExact) return bExact - aExact

      // Then by having alsoLikedPercentage
      const aHasLiked = a.alsoLikedPercentage !== null ? 1 : 0
      const bHasLiked = b.alsoLikedPercentage !== null ? 1 : 0
      if (aHasLiked !== bHasLiked) return bHasLiked - aHasLiked

      // Then by rating
      return (b.imdbRating || 0) - (a.imdbRating || 0)
    })

    // Apply pagination to final results
    const paginatedResults = finalResults.slice(
      (page - 1) * limit,
      page * limit
    )

    // Return response with caching
    const response = NextResponse.json<SearchResponse>({
      results: paginatedResults,
      source,
      total: finalResults.length,
      query,
    })
    
    // Cache search results for 5 minutes
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    
    return response

  } catch (error) {
    console.error('Search error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid search parameters',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// OPTIONS method for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}