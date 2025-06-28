# Vercel Deployment Instructions

## IMPORTANT: Environment Variable Update Required

Your Vercel deployment is failing because of an environment variable name mismatch. You need to update your Vercel environment variables.

### Current Issue
- Your code expects: `SUPABASE_SERVICE_KEY`
- You have in Vercel: `SUPABASE_SERVICE_ROLE_KEY`

### Fix Instructions

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Find the variable named `SUPABASE_SERVICE_ROLE_KEY`
4. Delete it or rename it to `SUPABASE_SERVICE_KEY`
5. Make sure you have all these environment variables (with exact names):

```
NEXT_PUBLIC_SUPABASE_URL=https://odydmpdogagroxlrhipb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9keWRtcGRvZ2Fncm94bHJoaXBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMjA3NTcsImV4cCI6MjA2NTY5Njc1N30.MbEnZxAeFVeuqBGrfnqgo4pwTskdWezWLVBiNY9XN-Q
SUPABASE_SERVICE_KEY=[YOUR SERVICE ROLE KEY - currently in SUPABASE_SERVICE_ROLE_KEY]
TMDB_API_KEY=f2ce2d9951bc015ad27f8c9661c62bfc
TMDB_API_READ_ACCESS_TOKEN=eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmMmNlMmQ5OTUxYmMwMTVhZDI3ZjhjOTY2MWM2MmJmYyIsIm5iZiI6MTc0OTk4MzExNS4zMzcsInN1YiI6IjY4NGU5ZjhiMTZmYTEzZTEwYTFiZjE0ZiIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.VWomrWD8CcjI_PK8JHukNMoxZ9U1hVRDhlkXGbZxtN4
DATAFORSEO_LOGIN=info@anchorinchrist.com
DATAFORSEO_PASSWORD=ba4f9cbbe0c1051d
NEXT_PUBLIC_APP_URL=https://[your-project-name].vercel.app
ADMIN_PASSWORD=admin123
RATING_UPDATE_ENABLED=true
RATING_UPDATE_DAILY_LIMIT=1000
RATING_UPDATE_MONTHLY_LIMIT=20000
RATING_UPDATE_BATCH_SIZE=100
```

### Key Points:
- **MUST rename**: `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_KEY`
- **MUST update**: `NEXT_PUBLIC_APP_URL` to your actual Vercel URL after first deployment

## All Fixes Applied

I've fixed all the TypeScript and build errors:

1. ✅ Fixed environment variable mapping in lib/env.ts
2. ✅ Updated tsconfig.json to exclude test backup files
3. ✅ Fixed Tailwind CSS warning in fetch-rating-button.tsx
4. ✅ Suppressed Supabase warning in next.config.js
5. ✅ Fixed all TypeScript type errors for 'limit_reached' status
6. ✅ Fixed variable scoping issues in audience-verdict.tsx
7. ✅ Fixed mediaType type in genre-page.tsx

The local build now completes successfully. Once you update the environment variable name in Vercel, your deployment should succeed!