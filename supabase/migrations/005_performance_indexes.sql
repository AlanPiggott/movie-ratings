-- Performance optimization indexes for Movie Score
-- These indexes improve query performance for common access patterns

-- Composite index for homepage queries (most popular with ratings)
CREATE INDEX IF NOT EXISTS idx_media_items_rating_popularity 
ON media_items(media_type, also_liked_percentage, popularity DESC)
WHERE also_liked_percentage IS NOT NULL;

-- Index for recent releases with ratings
CREATE INDEX IF NOT EXISTS idx_media_items_release_date_rating
ON media_items(media_type, release_date DESC, also_liked_percentage)
WHERE also_liked_percentage IS NOT NULL;

-- Index for high-rated content (90%+)
CREATE INDEX IF NOT EXISTS idx_media_items_high_rating
ON media_items(media_type, also_liked_percentage DESC, vote_count DESC)
WHERE also_liked_percentage >= 90;

-- Index for genre-based queries
CREATE INDEX IF NOT EXISTS idx_media_genres_lookup
ON media_genres(genre_id, media_item_id);

-- Partial index for items without ratings (for rating requests)
CREATE INDEX IF NOT EXISTS idx_media_items_no_rating
ON media_items(id, media_type, title)
WHERE also_liked_percentage IS NULL;

-- Index for text search on title
CREATE INDEX IF NOT EXISTS idx_media_items_title_search
ON media_items USING gin(to_tsvector('english', title));

-- Analyze tables to update statistics
ANALYZE media_items;
ANALYZE media_genres;
ANALYZE genres;