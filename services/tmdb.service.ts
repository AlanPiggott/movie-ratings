import { config } from '@/lib/config'
import type { MediaType } from '@/services/database/media.service'

interface TMDBSearchResult {
  id: number
  title?: string // for movies
  name?: string // for TV shows
  release_date?: string // for movies
  first_air_date?: string // for TV shows
  media_type: 'movie' | 'tv' | 'person'
  poster_path?: string | null
  overview?: string
  vote_average?: number
  vote_count?: number
  popularity?: number
  genre_ids?: number[]
  original_title?: string
  original_name?: string
}

interface TMDBSearchResponse {
  page: number
  results: TMDBSearchResult[]
  total_pages: number
  total_results: number
}

interface TMDBGenre {
  id: number
  name: string
}

interface TMDBMovieDetails {
  id: number
  imdb_id?: string | null
  title: string
  original_title?: string
  release_date?: string
  runtime?: number | null
  overview?: string
  poster_path?: string | null
  vote_average?: number
  vote_count?: number
  popularity?: number
  status?: string
  tagline?: string | null
  homepage?: string | null
  budget?: number
  revenue?: number
  genres?: TMDBGenre[]
}

interface TMDBTVDetails {
  id: number
  name: string
  original_name?: string
  first_air_date?: string
  episode_run_time?: number[]
  overview?: string
  poster_path?: string | null
  vote_average?: number
  vote_count?: number
  popularity?: number
  status?: string
  tagline?: string | null
  homepage?: string | null
  genres?: TMDBGenre[]
  number_of_episodes?: number
  number_of_seasons?: number
}

export class TMDBService {
  private baseUrl = config.tmdb.baseUrl
  private apiKey = config.tmdb.apiKey
  private headers = {
    'Authorization': `Bearer ${config.tmdb.readAccessToken}`,
    'Content-Type': 'application/json',
  }

  private checkApiKey() {
    if (!this.apiKey || this.apiKey === '') {
      throw new Error('TMDB API key is not configured')
    }
  }

  /**
   * Search for movies and TV shows
   * @param query - Search query
   * @param options - Search options
   * @returns Search results from TMDB
   */
  async searchMulti(
    query: string,
    options: {
      page?: number
      includeAdult?: boolean
      language?: string
      region?: string
    } = {}
  ): Promise<TMDBSearchResponse> {
    this.checkApiKey()
    
    const {
      page = 1,
      includeAdult = false,
      language = 'en-US',
      region = 'US'
    } = options

    const params = new URLSearchParams({
      api_key: this.apiKey,
      query,
      page: page.toString(),
      include_adult: includeAdult.toString(),
      language,
      region
    })

    const response = await fetch(
      `${this.baseUrl}/search/multi?${params}`,
      {
        headers: this.headers,
        signal: AbortSignal.timeout(2000) // 2 second timeout
      }
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get detailed movie information with append_to_response
   * @param movieId - TMDB movie ID
   * @returns Movie details with credits, videos, recommendations, and watch providers
   */
  async getMovieDetails(movieId: number): Promise<TMDBMovieDetails> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      language: 'en-US',
      append_to_response: 'credits,videos,recommendations,watch/providers'
    })

    const response = await fetch(
      `${this.baseUrl}/movie/${movieId}?${params}`,
      {
        headers: this.headers,
        signal: AbortSignal.timeout(3000)
      }
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get detailed TV show information with append_to_response
   * @param tvId - TMDB TV show ID
   * @returns TV show details with credits, videos, recommendations, and watch providers
   */
  async getTVDetails(tvId: number): Promise<TMDBTVDetails> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      language: 'en-US',
      append_to_response: 'credits,videos,recommendations,watch/providers'
    })

    const response = await fetch(
      `${this.baseUrl}/tv/${tvId}?${params}`,
      {
        headers: this.headers,
        signal: AbortSignal.timeout(3000)
      }
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Transform TMDB search result to our format
   */
  transformSearchResult(result: TMDBSearchResult) {
    const isMovie = result.media_type === 'movie'
    
    return {
      tmdbId: result.id,
      mediaType: (isMovie ? 'MOVIE' : 'TV_SHOW') as MediaType,
      title: isMovie ? result.title! : result.name!,
      originalTitle: isMovie ? result.original_title : result.original_name,
      releaseDate: isMovie ? result.release_date : result.first_air_date,
      posterPath: result.poster_path,
      overview: result.overview,
      popularity: result.popularity,
      voteAverage: result.vote_average,
      voteCount: result.vote_count,
      genreIds: result.genre_ids
    }
  }

  /**
   * Get trending movies or TV shows
   * @param mediaType - 'movie' or 'tv'
   * @param timeWindow - 'day' or 'week'
   * @returns Trending results
   */
  async getTrending(
    mediaType: 'movie' | 'tv',
    timeWindow: 'day' | 'week' = 'day'
  ): Promise<TMDBSearchResponse> {
    this.checkApiKey()
    
    const params = new URLSearchParams({
      api_key: this.apiKey,
      language: 'en-US'
    })

    const response = await fetch(
      `${this.baseUrl}/trending/${mediaType}/${timeWindow}?${params}`,
      {
        headers: this.headers,
        signal: AbortSignal.timeout(2000)
      }
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`)
    }

    const data = await response.json()
    // Add media_type to results since trending endpoint doesn't include it
    data.results = data.results.map((item: any) => ({
      ...item,
      media_type: mediaType
    }))

    return data
  }

  /**
   * Discover movies with various filters
   * @param filters - Discovery filters
   * @returns Movie results
   */
  async discoverMovies(filters: Record<string, any> = {}): Promise<TMDBSearchResponse> {
    this.checkApiKey()
    
    const params = new URLSearchParams({
      api_key: this.apiKey,
      language: 'en-US',
      region: 'US',
      ...filters
    })

    const response = await fetch(
      `${this.baseUrl}/discover/movie?${params}`,
      {
        headers: this.headers,
        signal: AbortSignal.timeout(2000)
      }
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`)
    }

    const data = await response.json()
    // Add media_type to results
    data.results = data.results.map((item: any) => ({
      ...item,
      media_type: 'movie'
    }))

    return data
  }

  /**
   * Discover TV shows with various filters
   * @param filters - Discovery filters
   * @returns TV show results
   */
  async discoverTvShows(filters: Record<string, any> = {}): Promise<TMDBSearchResponse> {
    this.checkApiKey()
    
    const params = new URLSearchParams({
      api_key: this.apiKey,
      language: 'en-US',
      ...filters
    })

    const response = await fetch(
      `${this.baseUrl}/discover/tv?${params}`,
      {
        headers: this.headers,
        signal: AbortSignal.timeout(2000)
      }
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.statusText}`)
    }

    const data = await response.json()
    // Add media_type and convert name to title for consistency
    data.results = data.results.map((item: any) => ({
      ...item,
      media_type: 'tv',
      title: item.name,
      release_date: item.first_air_date
    }))

    return data
  }

  /**
   * Get genre mapping for movies and TV shows
   */
  async getGenres(): Promise<{ movies: TMDBGenre[], tv: TMDBGenre[] }> {
    const [movieGenres, tvGenres] = await Promise.all([
      this.getMovieGenres(),
      this.getTVGenres()
    ])

    return { movies: movieGenres, tv: tvGenres }
  }

  private async getMovieGenres(): Promise<TMDBGenre[]> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      language: 'en-US'
    })

    const response = await fetch(
      `${this.baseUrl}/genre/movie/list?${params}`,
      { headers: this.headers }
    )

    const data = await response.json()
    return data.genres
  }

  private async getTVGenres(): Promise<TMDBGenre[]> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      language: 'en-US'
    })

    const response = await fetch(
      `${this.baseUrl}/genre/tv/list?${params}`,
      { headers: this.headers }
    )

    const data = await response.json()
    return data.genres
  }

  /**
   * Build full image URL
   */
  getImageUrl(path: string | null | undefined, size: 'w200' | 'w500' | 'original' = 'w500'): string | null {
    if (!path) return null
    return `${config.tmdb.imageBaseUrl}/${size}${path}`
  }
}

// Export singleton instance
export const tmdbService = new TMDBService()