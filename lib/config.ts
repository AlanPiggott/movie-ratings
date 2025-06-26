import { env } from './env'

/**
 * Application configuration with typed environment variables
 */
export const config = {
  /**
   * Database configuration
   */
  database: {
    url: env.DATABASE_URL,
  },

  /**
   * Supabase configuration
   */
  supabase: {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceKey: env.SUPABASE_SERVICE_KEY,
  },

  /**
   * TMDB API configuration
   */
  tmdb: {
    apiKey: env.TMDB_API_KEY || '',
    readAccessToken: env.TMDB_API_READ_ACCESS_TOKEN || '',
    baseUrl: 'https://api.themoviedb.org/3',
    imageBaseUrl: 'https://image.tmdb.org/t/p',
  },

  /**
   * DataForSEO API configuration
   */
  dataForSeo: {
    login: env.DATAFORSEO_LOGIN,
    password: env.DATAFORSEO_PASSWORD,
    baseUrl: 'https://api.dataforseo.com/v3',
  },

  /**
   * Google Custom Search API configuration (fallback)
   */
  google: {
    apiKey: env.GOOGLE_API_KEY,
    searchEngineId: env.GOOGLE_SEARCH_ENGINE_ID,
    baseUrl: 'https://customsearch.googleapis.com/customsearch/v1',
  },

  /**
   * Redis configuration (optional)
   */
  redis: {
    url: env.REDIS_URL,
    ttl: {
      movieData: 60 * 60 * 24, // 24 hours
      searchResults: 60 * 60, // 1 hour
      trendingData: 60 * 30, // 30 minutes
    },
  },

  /**
   * Authentication configuration (optional)
   */
  auth: {
    url: env.NEXTAUTH_URL,
    secret: env.NEXTAUTH_SECRET,
  },

  /**
   * Application configuration
   */
  app: {
    url: env.NEXT_PUBLIC_APP_URL,
    name: 'Movie Discovery Platform',
    description: 'Discover movies and TV shows with Google sentiment scores',
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
  },

  /**
   * API rate limiting
   */
  rateLimit: {
    tmdb: {
      requestsPerSecond: 40, // TMDB allows 40 requests per second
      requestsPerDay: 500000, // Varies by API key tier
    },
    dataForSeo: {
      requestsPerSecond: 10, // Typical rate limit
      requestsPerMonth: 100000, // Varies by plan
    },
    google: {
      requestsPerDay: 100, // Free tier limit
      requestsPerQuery: 10, // Results per query
    },
  },
} as const

export type Config = typeof config