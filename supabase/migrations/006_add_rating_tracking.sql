-- Migration: Add rating tracking fields for automated update system
-- This enables intelligent scheduling of rating updates based on content age and popularity

-- Add tracking columns to media_items
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS rating_last_updated TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS rating_update_tier INTEGER DEFAULT NULL CHECK (rating_update_tier >= 1 AND rating_update_tier <= 5);
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS rating_check_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS rating_unchanged_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS rating_update_priority INTEGER DEFAULT 0 NOT NULL;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_media_items_rating_last_updated ON media_items(rating_last_updated);
CREATE INDEX IF NOT EXISTS idx_media_items_rating_update_tier ON media_items(rating_update_tier);
CREATE INDEX IF NOT EXISTS idx_media_items_tier_updated ON media_items(rating_update_tier, rating_last_updated);

-- Function to get items due for rating update
CREATE OR REPLACE FUNCTION get_items_due_for_rating_update(
    p_limit INTEGER DEFAULT 100,
    p_dry_run BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id UUID,
    tmdb_id INTEGER,
    title VARCHAR,
    media_type media_type,
    release_date DATE,
    rating_update_tier INTEGER,
    rating_last_updated TIMESTAMPTZ,
    also_liked_percentage INTEGER,
    search_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.tmdb_id,
        m.title,
        m.media_type,
        m.release_date,
        m.rating_update_tier,
        m.rating_last_updated,
        m.also_liked_percentage,
        m.search_count
    FROM media_items m
    WHERE 
        -- Must have a tier assigned
        m.rating_update_tier IS NOT NULL
        -- And meet update criteria based on tier
        AND (
            -- Tier 1: Update every 14 days
            (m.rating_update_tier = 1 AND (
                m.rating_last_updated IS NULL 
                OR m.rating_last_updated < NOW() - INTERVAL '14 days'
            ))
            -- Tier 2: Update every 30 days
            OR (m.rating_update_tier = 2 AND (
                m.rating_last_updated IS NULL 
                OR m.rating_last_updated < NOW() - INTERVAL '30 days'
            ))
            -- Tier 3: Update every 90 days
            OR (m.rating_update_tier = 3 AND (
                m.rating_last_updated IS NULL 
                OR m.rating_last_updated < NOW() - INTERVAL '90 days'
            ))
            -- Tier 4: Update every 180 days
            OR (m.rating_update_tier = 4 AND (
                m.rating_last_updated IS NULL 
                OR m.rating_last_updated < NOW() - INTERVAL '180 days'
            ))
            -- Tier 5 items are never updated automatically
        )
    ORDER BY 
        -- Prioritize items that have never been updated
        CASE WHEN m.rating_last_updated IS NULL THEN 0 ELSE 1 END,
        -- Then by priority override
        m.rating_update_priority DESC,
        -- Then by search popularity
        m.search_count DESC,
        -- Finally by how long since last update
        m.rating_last_updated ASC NULLS FIRST
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to record rating update
CREATE OR REPLACE FUNCTION record_rating_update(
    p_media_id UUID,
    p_new_rating INTEGER,
    p_previous_rating INTEGER
)
RETURNS void AS $$
BEGIN
    UPDATE media_items
    SET 
        rating_last_updated = NOW(),
        rating_check_count = rating_check_count + 1,
        rating_unchanged_count = CASE 
            WHEN p_new_rating = p_previous_rating THEN rating_unchanged_count + 1
            ELSE 0
        END,
        also_liked_percentage = p_new_rating
    WHERE id = p_media_id;
END;
$$ LANGUAGE plpgsql;

-- Create table for tracking update statistics
CREATE TABLE IF NOT EXISTS rating_update_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_date DATE NOT NULL DEFAULT CURRENT_DATE,
    items_updated INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    api_calls_made INTEGER DEFAULT 0,
    total_cost DECIMAL(10,4) DEFAULT 0,
    runtime_seconds INTEGER,
    error_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create unique index to ensure one log per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_rating_update_logs_run_date ON rating_update_logs(run_date);

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_items_due_for_rating_update(INTEGER, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION record_rating_update(UUID, INTEGER, INTEGER) TO service_role;
GRANT ALL ON rating_update_logs TO service_role;