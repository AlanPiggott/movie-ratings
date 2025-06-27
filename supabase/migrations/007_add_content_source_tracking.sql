-- Add content source tracking to media_items and rating_update_logs

-- Add content_source field to track how items entered the system
ALTER TABLE media_items ADD COLUMN IF NOT EXISTS content_source TEXT DEFAULT 'user_search' 
  CHECK (content_source IN ('user_search', 'now_playing', 'upcoming', 'on_the_air', 'airing_today', 'trending', 'backfill', 'manual'));

-- Add index for content_source for analytics
CREATE INDEX IF NOT EXISTS idx_media_items_content_source ON media_items(content_source);

-- Add fields to rating_update_logs for better tracking
ALTER TABLE rating_update_logs ADD COLUMN IF NOT EXISTS update_source TEXT DEFAULT 'scheduled';
ALTER TABLE rating_update_logs ADD COLUMN IF NOT EXISTS new_items_added INTEGER DEFAULT 0;

-- Update the record_rating_update function to set rating_update_tier for new items
CREATE OR REPLACE FUNCTION record_rating_update(
  p_media_id UUID,
  p_new_rating INTEGER,
  p_previous_rating INTEGER
) RETURNS void AS $$
BEGIN
  UPDATE media_items
  SET 
    also_liked_percentage = p_new_rating,
    rating_last_updated = CURRENT_TIMESTAMP,
    rating_check_count = rating_check_count + 1,
    rating_unchanged_count = CASE 
      WHEN p_new_rating = p_previous_rating THEN rating_unchanged_count + 1
      ELSE 0
    END,
    -- Assign tier 1 to new items getting their first rating
    rating_update_tier = CASE 
      WHEN rating_update_tier IS NULL THEN 1
      ELSE rating_update_tier
    END
  WHERE id = p_media_id;
END;
$$ LANGUAGE plpgsql;