import { BaseService, DatabaseError, PaginatedResponse, PaginationOptions } from './base.service'
import type { MediaItem, Genre } from '@/lib/supabase'

// Define MediaType locally to match Supabase schema
export type MediaType = 'MOVIE' | 'TV_SHOW'

export interface MediaFilters {
  query?: string
  mediaType?: MediaType
  genres?: string[]
  yearFrom?: number
  yearTo?: number
  ratingMin?: number
  ratingMax?: number
  hasAlsoLiked?: boolean
  sortBy?: 'popularity' | 'releaseDate' | 'alsoLikedPercentage' | 'searchCount' | 'title'
  sortOrder?: 'asc' | 'desc'
}

export interface CreateOrUpdateMediaData {
  tmdbId: number
  mediaType: MediaType
  title: string
  releaseDate?: Date | string | null
  posterPath?: string | null
  overview?: string | null
  alsoLikedPercentage?: number | null
  originalTitle?: string | null
  popularity?: number | null
  voteAverage?: number | null
  voteCount?: number | null
  runtime?: number | null
  status?: string | null
  genres?: { tmdbId: number; name: string }[]
}

// Extended MediaItem type with genres
export interface MediaItemWithGenres extends MediaItem {
  genres?: Genre[]
}

/**
 * Service for handling all media-related database operations
 */
export class MediaService extends BaseService {
  /**
   * Search for media items with filters and pagination
   * @param query - Search query string
   * @param filters - Filter options
   * @param pagination - Pagination options
   * @returns Paginated list of media items
   */
  async searchMedia(
    query: string,
    filters: MediaFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResponse<MediaItemWithGenres>> {
    try {
      const {
        page = 1,
        limit = 20,
        orderBy = 'searchCount',
        order = 'desc'
      } = pagination

      const offset = (page - 1) * limit

      // Build the query
      let queryBuilder = this.supabase
        .from('media_items')
        .select(`
          *,
          media_genres!inner(
            genre:genres(*)
          )
        `, { count: 'exact' })

      // Always filter out items without poster images
      queryBuilder = queryBuilder.not('poster_path', 'is', null).not('poster_path', 'eq', '')

      // Text search
      if (query) {
        queryBuilder = queryBuilder.or(`title.ilike.%${query}%,original_title.ilike.%${query}%,overview.ilike.%${query}%`)
      }

      // Media type filter
      if (filters.mediaType) {
        queryBuilder = queryBuilder.eq('media_type', filters.mediaType)
      }

      // Year range filter
      if (filters.yearFrom || filters.yearTo) {
        if (filters.yearFrom) {
          queryBuilder = queryBuilder.gte('release_date', `${filters.yearFrom}-01-01`)
        }
        if (filters.yearTo) {
          queryBuilder = queryBuilder.lte('release_date', `${filters.yearTo}-12-31`)
        }
      }

      // Rating filter
      if (filters.ratingMin !== undefined || filters.ratingMax !== undefined) {
        if (filters.ratingMin !== undefined) {
          queryBuilder = queryBuilder.gte('vote_average', filters.ratingMin)
        }
        if (filters.ratingMax !== undefined) {
          queryBuilder = queryBuilder.lte('vote_average', filters.ratingMax)
        }
      }

      // Has also liked percentage filter
      if (filters.hasAlsoLiked !== undefined) {
        if (filters.hasAlsoLiked) {
          queryBuilder = queryBuilder.not('also_liked_percentage', 'is', null)
        } else {
          queryBuilder = queryBuilder.is('also_liked_percentage', null)
        }
      }

      // Sorting
      const sortField = this.mapSortField(filters.sortBy || orderBy)
      queryBuilder = queryBuilder.order(sortField, { ascending: (filters.sortOrder || order) === 'asc' })

      // Apply pagination
      queryBuilder = queryBuilder.range(offset, offset + limit - 1)

      // Execute query
      const { data, error, count } = await queryBuilder

      if (error) {
        throw new DatabaseError('Search failed', 'QUERY_ERROR', error.message)
      }

      // Transform the results to match our interface
      const transformedItems: MediaItemWithGenres[] = (data || []).map(item => {
        const genres = item.media_genres?.map((mg: any) => mg.genre).filter(Boolean) || []
        return {
          ...item,
          genres,
          media_genres: undefined // Remove the join table data
        }
      })

      return {
        items: transformedItems,
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: page * limit < (count || 0)
      }
    } catch (error) {
      this.handleError(error, 'searchMedia')
    }
  }

  /**
   * Get a single media item by ID
   * @param id - Media item ID
   * @returns Media item or null
   */
  async getMediaById(id: string): Promise<MediaItemWithGenres | null> {
    try {
      const { data, error } = await this.supabase
        .from('media_items')
        .select(`
          *,
          media_genres(
            genre:genres(*)
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null // Not found
        }
        throw new DatabaseError('Failed to get media item', 'QUERY_ERROR', error.message)
      }

      if (!data) {
        return null
      }

      // Transform the result
      const genres = data.media_genres?.map((mg: any) => mg.genre).filter(Boolean) || []
      return {
        ...data,
        genres,
        media_genres: undefined
      }
    } catch (error) {
      this.handleError(error, 'getMediaById')
    }
  }

  /**
   * Create or update a media item
   * @param data - Media item data
   * @returns Created or updated media item
   */
  async createOrUpdateMedia(data: CreateOrUpdateMediaData): Promise<MediaItemWithGenres> {
    try {
      return await this.executeWithRetry(async () => {
        // Convert date if string
        const releaseDate = data.releaseDate
          ? new Date(data.releaseDate).toISOString().split('T')[0]
          : null

        // First, check if the item exists
        const { data: existingItem } = await this.supabase
          .from('media_items')
          .select('id')
          .eq('tmdb_id', data.tmdbId)
          .single()

        let mediaItem: MediaItem

        if (existingItem) {
          // Update existing item
          const { data: updated, error } = await this.supabase
            .from('media_items')
            .update({
              title: data.title,
              release_date: releaseDate,
              poster_path: data.posterPath,
              overview: data.overview,
              also_liked_percentage: data.alsoLikedPercentage,
              original_title: data.originalTitle,
              popularity: data.popularity,
              vote_average: data.voteAverage,
              vote_count: data.voteCount,
              runtime: data.runtime,
              status: data.status,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingItem.id)
            .select()
            .single()

          if (error) {
            throw new DatabaseError('Failed to update media item', 'UPDATE_ERROR', error.message)
          }

          mediaItem = updated
        } else {
          // Create new item
          const { data: created, error } = await this.supabase
            .from('media_items')
            .insert({
              tmdb_id: data.tmdbId,
              media_type: data.mediaType,
              title: data.title,
              release_date: releaseDate,
              poster_path: data.posterPath,
              overview: data.overview,
              also_liked_percentage: data.alsoLikedPercentage,
              original_title: data.originalTitle,
              popularity: data.popularity,
              vote_average: data.voteAverage,
              vote_count: data.voteCount,
              runtime: data.runtime,
              status: data.status
            })
            .select()
            .single()

          if (error) {
            throw new DatabaseError('Failed to create media item', 'INSERT_ERROR', error.message)
          }

          mediaItem = created
        }

        // Handle genres if provided
        if (data.genres && data.genres.length > 0) {
          // Ensure all genres exist
          for (const genre of data.genres) {
            const { error } = await this.supabase
              .from('genres')
              .upsert({
                tmdb_id: genre.tmdbId,
                name: genre.name
              }, {
                onConflict: 'tmdb_id'
              })

            if (error && error.code !== '23505') { // Ignore unique constraint errors
              console.error('Failed to upsert genre:', error)
            }
          }

          // Get genre IDs
          const { data: genreRecords } = await this.supabase
            .from('genres')
            .select('id, tmdb_id')
            .in('tmdb_id', data.genres.map(g => g.tmdbId))

          if (genreRecords && genreRecords.length > 0) {
            // Delete existing genre associations
            await this.supabase
              .from('media_genres')
              .delete()
              .eq('media_item_id', mediaItem.id)

            // Create new associations
            const genreAssociations = genreRecords.map(genre => ({
              media_item_id: mediaItem.id,
              genre_id: genre.id
            }))

            await this.supabase
              .from('media_genres')
              .insert(genreAssociations)
          }
        }

        // Fetch the complete item with genres
        const completeItem = await this.getMediaById(mediaItem.id)
        if (!completeItem) {
          throw new DatabaseError('Failed to fetch created/updated item', 'FETCH_ERROR')
        }

        return completeItem
      })
    } catch (error) {
      this.handleError(error, 'createOrUpdateMedia')
    }
  }

  /**
   * Increment search count for a media item
   * @param id - Media item ID
   * @returns Updated media item
   */
  async incrementSearchCount(id: string): Promise<MediaItemWithGenres> {
    try {
      // First get current search count
      const { data: current, error: fetchError } = await this.supabase
        .from('media_items')
        .select('search_count')
        .eq('id', id)
        .single()

      if (fetchError) {
        throw new DatabaseError('Failed to fetch media item', 'FETCH_ERROR', fetchError.message)
      }

      // Update with incremented count
      const { error: updateError } = await this.supabase
        .from('media_items')
        .update({
          search_count: (current?.search_count || 0) + 1,
          last_searched: new Date().toISOString()
        })
        .eq('id', id)

      if (updateError) {
        throw new DatabaseError('Failed to update search count', 'UPDATE_ERROR', updateError.message)
      }

      // Fetch and return the updated item
      const updated = await this.getMediaById(id)
      if (!updated) {
        throw new DatabaseError('Failed to fetch updated item', 'FETCH_ERROR')
      }

      return updated
    } catch (error) {
      this.handleError(error, 'incrementSearchCount')
    }
  }

  /**
   * Get popular media items by type
   * @param type - Media type (optional)
   * @param limit - Number of items to return
   * @returns List of popular media items
   */
  async getPopularMedia(type?: MediaType, limit = 10): Promise<MediaItemWithGenres[]> {
    try {
      let query = this.supabase
        .from('media_items')
        .select(`
          *,
          media_genres(
            genre:genres(*)
          )
        `)
        .order('search_count', { ascending: false })
        .order('popularity', { ascending: false })
        .limit(limit)

      if (type) {
        query = query.eq('media_type', type)
      }

      const { data, error } = await query

      if (error) {
        throw new DatabaseError('Failed to get popular media', 'QUERY_ERROR', error.message)
      }

      // Transform the results
      return (data || []).map(item => {
        const genres = item.media_genres?.map((mg: any) => mg.genre).filter(Boolean) || []
        return {
          ...item,
          genres,
          media_genres: undefined
        }
      })
    } catch (error) {
      this.handleError(error, 'getPopularMedia')
    }
  }

  /**
   * Get media items missing "also liked" percentage
   * @param limit - Number of items to return
   * @returns List of media items without sentiment data
   */
  async getMediaMissingAlsoLiked(limit = 50): Promise<MediaItemWithGenres[]> {
    try {
      const { data, error } = await this.supabase
        .from('media_items')
        .select(`
          *,
          media_genres(
            genre:genres(*)
          )
        `)
        .is('also_liked_percentage', null)
        .gt('search_count', 0)
        .not('poster_path', 'is', null)
        .not('poster_path', 'eq', '')
        .order('search_count', { ascending: false })
        .order('popularity', { ascending: false })
        .limit(limit)

      if (error) {
        throw new DatabaseError('Failed to get media missing sentiment', 'QUERY_ERROR', error.message)
      }

      // Transform the results
      return (data || []).map(item => {
        const genres = item.media_genres?.map((mg: any) => mg.genre).filter(Boolean) || []
        return {
          ...item,
          genres,
          media_genres: undefined
        }
      })
    } catch (error) {
      this.handleError(error, 'getMediaMissingAlsoLiked')
    }
  }

  /**
   * Get media items by genre
   * @param genreName - Genre name
   * @param limit - Number of items to return
   * @returns List of media items in the genre
   */
  async getMediaByGenre(genreName: string, limit = 20): Promise<MediaItemWithGenres[]> {
    try {
      // First get the genre ID
      const { data: genreData, error: genreError } = await this.supabase
        .from('genres')
        .select('id')
        .eq('name', genreName)
        .single()

      if (genreError || !genreData) {
        return []
      }

      // Get media items with that genre
      const { data, error } = await this.supabase
        .from('media_items')
        .select(`
          *,
          media_genres!inner(
            genre:genres(*)
          )
        `)
        .eq('media_genres.genre_id', genreData.id)
        .not('poster_path', 'is', null)
        .not('poster_path', 'eq', '')
        .order('popularity', { ascending: false })
        .order('search_count', { ascending: false })
        .limit(limit)

      if (error) {
        throw new DatabaseError('Failed to get media by genre', 'QUERY_ERROR', error.message)
      }

      // Transform the results
      return (data || []).map(item => {
        const genres = item.media_genres?.map((mg: any) => mg.genre).filter(Boolean) || []
        return {
          ...item,
          genres,
          media_genres: undefined
        }
      })
    } catch (error) {
      this.handleError(error, 'getMediaByGenre')
    }
  }

  /**
   * Get trending media based on recent searches
   * @param hours - Number of hours to look back
   * @param limit - Number of items to return
   * @returns List of trending media items
   */
  async getTrendingMedia(hours = 24, limit = 10): Promise<MediaItemWithGenres[]> {
    try {
      const since = new Date()
      since.setHours(since.getHours() - hours)

      const { data, error } = await this.supabase
        .from('media_items')
        .select(`
          *,
          media_genres(
            genre:genres(*)
          )
        `)
        .gte('last_searched', since.toISOString())
        .order('search_count', { ascending: false })
        .order('last_searched', { ascending: false })
        .limit(limit)

      if (error) {
        throw new DatabaseError('Failed to get trending media', 'QUERY_ERROR', error.message)
      }

      // Transform the results
      return (data || []).map(item => {
        const genres = item.media_genres?.map((mg: any) => mg.genre).filter(Boolean) || []
        return {
          ...item,
          genres,
          media_genres: undefined
        }
      })
    } catch (error) {
      this.handleError(error, 'getTrendingMedia')
    }
  }

  /**
   * Helper: Map sort field names to database column names
   */
  private mapSortField(field: string): string {
    const fieldMap: Record<string, string> = {
      popularity: 'popularity',
      releaseDate: 'release_date',
      alsoLikedPercentage: 'also_liked_percentage',
      searchCount: 'search_count',
      title: 'title'
    }

    return fieldMap[field] || 'search_count'
  }
}

// Export singleton instance
export const mediaService = new MediaService()