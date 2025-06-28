import { z } from 'zod'

/**
 * Specify your server-side environment variables schema here.
 * This way you can ensure the app isn't built with invalid env vars.
 */
const server = z.object({
  // Database (optional since we're using Supabase)
  DATABASE_URL: z.string().url().optional().describe('PostgreSQL connection string'),
  
  // Supabase
  SUPABASE_SERVICE_KEY: z.string().min(1).describe('Supabase service role key'),
  
  // TMDB API (making optional for now)
  TMDB_API_KEY: z.string().min(1).optional().describe('TMDB API v3 key'),
  TMDB_API_READ_ACCESS_TOKEN: z.string().min(1).optional().describe('TMDB API v4 read access token'),
  
  // DataForSEO API (making optional for now)
  DATAFORSEO_LOGIN: z.string().min(1).optional().describe('DataForSEO login/email'),
  DATAFORSEO_PASSWORD: z.string().min(1).optional().describe('DataForSEO password'),
  
  // Google Custom Search API (alternative to DataForSEO)
  GOOGLE_API_KEY: z.string().optional().describe('Google API key for Custom Search'),
  GOOGLE_SEARCH_ENGINE_ID: z.string().optional().describe('Google Custom Search Engine ID'),
  
  // Redis (optional)
  REDIS_URL: z.string().url().optional().describe('Redis connection URL for caching'),
  
  // NextAuth (optional)
  NEXTAUTH_URL: z.string().url().optional().describe('NextAuth URL for authentication'),
  NEXTAUTH_SECRET: z.string().min(32).optional().describe('NextAuth secret for JWT'),
  
  // Node
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

/**
 * Specify your client-side environment variables schema here.
 * This way you can ensure the app isn't built with invalid env vars.
 * To expose them to the client, prefix them with `NEXT_PUBLIC_`.
 */
const client = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().describe('Public app URL'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().describe('Supabase project URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).describe('Supabase anonymous key'),
})

/**
 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
 * middlewares) or client-side so we need to destruct manually.
 */
const processEnv = {
  // Server
  DATABASE_URL: process.env.DATABASE_URL || undefined,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  TMDB_API_KEY: process.env.TMDB_API_KEY || undefined,
  TMDB_API_READ_ACCESS_TOKEN: process.env.TMDB_API_READ_ACCESS_TOKEN || undefined,
  DATAFORSEO_LOGIN: process.env.DATAFORSEO_LOGIN || undefined,
  DATAFORSEO_PASSWORD: process.env.DATAFORSEO_PASSWORD || undefined,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || undefined,
  GOOGLE_SEARCH_ENGINE_ID: process.env.GOOGLE_SEARCH_ENGINE_ID || undefined,
  REDIS_URL: process.env.REDIS_URL || undefined,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || undefined,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || undefined,
  NODE_ENV: process.env.NODE_ENV,
  // Client
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
}

// Don't touch the part below
// --------------------------

const merged = server.merge(client)

/** @typedef {z.input<typeof merged>} MergedInput */
/** @typedef {z.infer<typeof merged>} MergedOutput */
/** @typedef {z.SafeParseReturnType<MergedInput, MergedOutput>} MergedSafeParseReturn */

let env = /** @type {MergedOutput} */ (process.env)

if (!!process.env.SKIP_ENV_VALIDATION == false) {
  const isServer = typeof window === 'undefined'

  const parsed = /** @type {MergedSafeParseReturn} */ (
    isServer
      ? merged.safeParse(processEnv) // on server we can validate all env vars
      : client.safeParse(processEnv) // on client we can only validate the ones that are exposed
  )

  if (parsed.success === false) {
    console.error(
      '❌ Invalid environment variables:',
      parsed.error.flatten().fieldErrors,
    )
    throw new Error('Invalid environment variables')
  }

  env = new Proxy(parsed.data as z.infer<typeof merged>, {
    get(target, prop) {
      if (typeof prop !== 'string') return undefined
      // Throw a descriptive error if a server-side env var is accessed on the client
      // Otherwise it would just be returning `undefined` and be annoying to debug
      if (!isServer && !prop.startsWith('NEXT_PUBLIC_'))
        throw new Error(
          process.env.NODE_ENV === 'production'
            ? '❌ Attempted to access a server-side environment variable on the client'
            : `❌ Attempted to access server-side environment variable '${prop}' on the client`,
        )
      return target[prop as keyof typeof target]
    },
  })
}

export { env }