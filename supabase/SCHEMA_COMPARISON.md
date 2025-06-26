# Schema Comparison: Prisma vs Supabase

This document outlines the key differences between the original Prisma schema and the Supabase PostgreSQL implementation.

## Data Types Mapping

| Prisma Type | PostgreSQL Type | Notes |
|-------------|-----------------|-------|
| `String @id @default(cuid())` | `UUID DEFAULT uuid_generate_v4()` | Using UUID v4 instead of CUID |
| `Int` | `INTEGER` | Standard mapping |
| `String` | `VARCHAR(n)` | Added length constraints |
| `String? @db.Text` | `TEXT` | For long text fields |
| `DateTime` | `TIMESTAMPTZ` | Using timezone-aware timestamps |
| `Float` | `DECIMAL(p,s)` | More precise for money/ratings |
| `Boolean` | `BOOLEAN` | Standard mapping |
| `Json` | `JSONB` | Binary JSON for better performance |
| `Enum` | `CREATE TYPE ... AS ENUM` | Custom PostgreSQL enum |

## Key Enhancements in Supabase

### 1. Row Level Security (RLS)
```sql
-- Every table has RLS enabled
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Example policies
CREATE POLICY "Allow public read" ON media_items
    FOR SELECT USING (true);
```

### 2. Automatic Timestamps
- Added `created_at` to all tables (not just some)
- `updated_at` uses a trigger function for automatic updates

### 3. Check Constraints
```sql
-- Rating must be 0-10
vote_average DECIMAL(3,1) CHECK (vote_average >= 0 AND vote_average <= 10)

-- Percentage must be 0-100
also_liked_percentage INTEGER CHECK (also_liked_percentage >= 0 AND also_liked_percentage <= 100)
```

### 4. Better Data Types
- `INET` for IP addresses (validates format)
- `JSONB` for metadata (queryable JSON)
- `DECIMAL` for precise numbers (ratings, money)

## Database Functions Added

### 1. Auto-update Timestamps
```sql
CREATE TRIGGER update_media_items_updated_at 
BEFORE UPDATE ON media_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. Atomic Counter Increment
```sql
-- Prevents race conditions when updating search counts
increment_search_count(media_id UUID)
```

### 3. Analytics Functions
```sql
-- Get top searches with CTR
get_top_searches(since_date, limit_count)

-- Get media with all genres in one query
get_media_with_genres(media_id)
```

## Security Model

### Public (Anonymous) Users
- Can read all tables
- Cannot insert/update/delete

### Authenticated Users  
- Can update media items (for future features)
- Can read all tables

### Service Role (Backend)
- Full access to all tables
- Used by your Next.js API routes

## Performance Optimizations

### 1. Composite Indexes
```sql
-- Optimized for common query patterns
CREATE INDEX idx_media_items_media_type_release_date 
ON media_items(media_type, release_date);
```

### 2. Partial Indexes (Future)
```sql
-- Example: Index only popular items
CREATE INDEX idx_popular_media 
ON media_items(search_count) 
WHERE search_count > 100;
```

### 3. JSONB Indexing
```sql
-- Metadata is JSONB, which can be indexed
CREATE INDEX idx_api_logs_metadata 
ON api_fetch_logs USING gin(metadata);
```

## Migration Considerations

### From Prisma to Supabase

1. **IDs**: CUIDs → UUIDs (both are unique, UUIDs are more standard)
2. **Relations**: Same structure, different syntax
3. **Defaults**: More explicit in PostgreSQL
4. **Validation**: Check constraints instead of Zod/app-level

### Data Migration Script (Example)

```sql
-- If migrating existing data from Prisma
INSERT INTO media_items (
    id, tmdb_id, media_type, title, -- etc
) SELECT 
    uuid_generate_v4(), -- or convert CUID to UUID
    tmdb_id,
    media_type::media_type,
    title -- etc
FROM old_media_items;
```

## Advantages of This Approach

1. **Performance**: Native PostgreSQL features are faster
2. **Security**: RLS provides database-level security
3. **Consistency**: Triggers ensure data integrity
4. **Scalability**: Better indexing and query optimization
5. **Real-time**: Supabase can stream changes to clients
6. **Maintenance**: Less ORM overhead, direct SQL when needed

## Best Practices

1. Always use parameterized queries (Supabase client handles this)
2. Let the database handle timestamps (don't set in app code)
3. Use the service role key only in server-side code
4. Enable RLS on all tables (even if policies are permissive)
5. Use database functions for complex operations