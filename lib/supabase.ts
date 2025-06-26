import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Validate required environment variables
if (!env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}
if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable')
}

/**
 * Supabase client for public/client-side operations
 * Uses the anon key which has RLS (Row Level Security) policies applied
 */
export const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    db: {
      schema: 'public',
    },
  }
)

/**
 * Supabase admin client for server-side operations
 * Uses the service role key which bypasses RLS
 * 
 * WARNING: Never expose this client to the browser!
 * Only use in server-side code (API routes, server components, etc.)
 */
export const supabaseAdmin = (() => {
  // Only validate service key when creating admin client (server-side only)
  if (typeof window === 'undefined' && !env.SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_KEY environment variable')
  }
  
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_KEY || '',  // Type assertion since we validated above
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: 'public',
      },
    }
  )
})()

/**
 * Database types for Supabase
 * These match our Prisma schema
 */
export interface Database {
  public: {
    Tables: {
      media_items: {
        Row: {
          id: string
          tmdb_id: number
          media_type: 'MOVIE' | 'TV_SHOW'
          title: string
          release_date: string | null
          poster_path: string | null
          overview: string | null
          also_liked_percentage: number | null
          search_count: number
          last_searched: string | null
          created_at: string
          updated_at: string
          original_title: string | null
          backdrop_path: string | null
          popularity: number | null
          vote_average: number | null
          vote_count: number | null
          runtime: number | null
          status: string | null
        }
        Insert: Omit<Database['public']['Tables']['media_items']['Row'], 'id' | 'created_at' | 'updated_at' | 'search_count'> & {
          id?: string
          created_at?: string
          updated_at?: string
          search_count?: number
        }
        Update: Partial<Database['public']['Tables']['media_items']['Insert']>
      }
      genres: {
        Row: {
          id: string
          tmdb_id: number
          name: string
        }
        Insert: Omit<Database['public']['Tables']['genres']['Row'], 'id'> & {
          id?: string
        }
        Update: Partial<Database['public']['Tables']['genres']['Insert']>
      }
      media_genres: {
        Row: {
          id: string
          media_item_id: string
          genre_id: string
        }
        Insert: Omit<Database['public']['Tables']['media_genres']['Row'], 'id'> & {
          id?: string
        }
        Update: Partial<Database['public']['Tables']['media_genres']['Insert']>
      }
      api_fetch_logs: {
        Row: {
          id: string
          endpoint: string
          method: string
          status_code: number | null
          response_time: number | null
          cost: number | null
          error_message: string | null
          metadata: any | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['api_fetch_logs']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['api_fetch_logs']['Insert']>
      }
    }
  }
}

// Type helpers
export type MediaItem = Database['public']['Tables']['media_items']['Row']
export type Genre = Database['public']['Tables']['genres']['Row']
export type MediaGenre = Database['public']['Tables']['media_genres']['Row']
export type ApiFetchLog = Database['public']['Tables']['api_fetch_logs']['Row']