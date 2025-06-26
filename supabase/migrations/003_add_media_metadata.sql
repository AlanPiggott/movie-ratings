-- Add additional metadata columns to media_items table

ALTER TABLE media_items
ADD COLUMN IF NOT EXISTS watch_providers JSONB,
ADD COLUMN IF NOT EXISTS recommendations JSONB,
ADD COLUMN IF NOT EXISTS content_rating VARCHAR(20),
ADD COLUMN IF NOT EXISTS keywords JSONB,
ADD COLUMN IF NOT EXISTS external_ids JSONB;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_media_items_content_rating ON media_items(content_rating);

-- Add comment descriptions
COMMENT ON COLUMN media_items.watch_providers IS 'Streaming/rental/purchase providers with direct links';
COMMENT ON COLUMN media_items.recommendations IS 'TMDB recommended similar content';
COMMENT ON COLUMN media_items.content_rating IS 'MPAA/TV content rating (PG, R, etc)';
COMMENT ON COLUMN media_items.keywords IS 'Associated keywords/tags';
COMMENT ON COLUMN media_items.external_ids IS 'External IDs (IMDB, TVDB, etc)';