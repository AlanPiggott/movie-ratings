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
                // Save to database
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
                  genres
                })

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