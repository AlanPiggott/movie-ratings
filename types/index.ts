export type MediaType = 'MOVIE' | 'TV_SHOW'

export interface MediaItem {
  id: string
  tmdbId: number
  mediaType: MediaType
  title: string
  releaseDate?: Date | null
  posterPath?: string | null
  overview?: string | null
  alsoLikedPercentage?: number | null
  searchCount: number
  lastSearched?: Date | null
  createdAt: Date
  updatedAt: Date
  originalTitle?: string | null
  backdropPath?: string | null
  popularity?: number | null
  voteAverage?: number | null
  voteCount?: number | null
  runtime?: number | null
  status?: string | null
  genres?: Genre[]
}

export interface Genre {
  id: string
  tmdbId: number
  name: string
}


export interface ApiFetchLog {
  id: string
  endpoint: string
  method: string
  statusCode?: number | null
  responseTime?: number | null
  cost?: number | null
  errorMessage?: string | null
  metadata?: any
  createdAt: Date
}

export interface SearchFilters {
  query?: string
  genres?: string[]
  yearFrom?: number
  yearTo?: number
  ratingMin?: number
  ratingMax?: number
  providers?: string[]
  sortBy?: 'popularity' | 'release_date' | 'vote_average' | 'google_score'
  sortOrder?: 'asc' | 'desc'
}

export interface TMDBMovie {
  id: number
  imdb_id?: string
  title: string
  original_title: string
  overview: string
  release_date: string
  runtime: number
  poster_path: string | null
  backdrop_path: string | null
  popularity: number
  vote_average: number
  vote_count: number
  genre_ids?: number[]
  genres?: Array<{
    id: number
    name: string
  }>
  status: string
  tagline: string
  homepage: string
  budget: number
  revenue: number
  adult: boolean
}

export interface TMDBResponse<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}