# Supabase Migration Guide

This guide will help you set up your database schema in Supabase using the provided SQL migration file.

## Prerequisites

1. A Supabase account and project
2. Your project's database credentials
3. The migration file: `001_initial_schema.sql`

## Method 1: Using Supabase Dashboard (Recommended)

### Step 1: Access SQL Editor

1. Log in to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar

### Step 2: Run the Migration

1. Click **New Query** button
2. Copy the entire contents of `001_initial_schema.sql`
3. Paste into the SQL editor
4. Click **Run** (or press `Cmd/Ctrl + Enter`)

### Step 3: Verify Migration

After running the migration, verify everything was created correctly:

1. Go to **Table Editor** in the left sidebar
2. You should see these tables:
   - `media_items`
   - `genres`
   - `media_genres`
   - `search_logs`
   - `api_fetch_logs`

3. Check that RLS is enabled (shield icon should be green for each table)

## Method 2: Using Supabase CLI

### Step 1: Install Supabase CLI

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows (using scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Step 2: Link Your Project

```bash
# Initialize Supabase in your project
supabase init

# Link to your remote project
supabase link --project-ref your-project-ref
```

### Step 3: Run Migration

```bash
# Apply the migration
supabase db push
```

## Method 3: Using psql (Direct Connection)

### Step 1: Get Connection String

1. In Supabase Dashboard, go to **Settings** → **Database**
2. Copy the **Connection string** (URI format)
3. Make sure to use the correct password

### Step 2: Run Migration

```bash
psql "your-connection-string" -f supabase/migrations/001_initial_schema.sql
```

## Post-Migration Setup

### 1. Update Environment Variables

Add these to your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

Find these values in **Settings** → **API** in your Supabase dashboard.

### 2. Enable Realtime (Optional)

If you want real-time updates:

1. Go to **Database** → **Replication**
2. Enable replication for tables you want to track in real-time
3. Typically: `media_items`, `search_logs`

### 3. Set Up Storage (Optional)

For movie posters and images:

1. Go to **Storage**
2. Create a bucket called `movie-posters`
3. Set it as public if you want direct URL access

## What This Migration Creates

### Tables

1. **media_items**
   - Stores movies and TV shows
   - Includes Google's "% liked" score
   - Tracks search popularity

2. **genres**
   - Movie/TV genre categories
   - Linked to TMDB genre IDs

3. **media_genres**
   - Many-to-many relationship between media and genres

4. **search_logs**
   - Tracks all searches for analytics
   - Helps identify popular content

5. **api_fetch_logs**
   - Monitors external API usage
   - Tracks costs and performance

### Database Functions

1. **update_updated_at_column()**
   - Automatically updates `updated_at` timestamps

2. **increment_search_count()**
   - Atomically increments search counters

3. **get_top_searches()**
   - Returns analytics on popular searches

4. **get_media_with_genres()**
   - Efficient query for media with all genres

### Row Level Security (RLS)

- **Public read access** on all tables
- **Service role** has full access (for your backend)
- **Authenticated users** can update media items
- **Anonymous users** can only read data

## Troubleshooting

### Common Issues

1. **"Extension does not exist"**
   - The `uuid-ossp` extension should be enabled by default in Supabase
   - If not, run: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`

2. **"Permission denied"**
   - Make sure you're using the correct database role
   - Use the service role key for backend operations

3. **"Relation already exists"**
   - The migration has already been run
   - To reset: Drop all tables first (be careful in production!)

### Rollback Script

If you need to undo the migration:

```sql
-- Drop all tables (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS api_fetch_logs CASCADE;
DROP TABLE IF EXISTS search_logs CASCADE;
DROP TABLE IF EXISTS media_genres CASCADE;
DROP TABLE IF EXISTS media_items CASCADE;
DROP TABLE IF EXISTS genres CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS media_type CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS increment_search_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_top_searches(TIMESTAMPTZ, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_media_with_genres(UUID) CASCADE;
```

## Next Steps

1. **Test the API connection** using the provided TypeScript services
2. **Import initial data** if you have existing movies/shows
3. **Set up scheduled functions** for data updates (optional)
4. **Configure backup schedule** in Supabase dashboard

## Support

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- Check the project's README for application-specific setup