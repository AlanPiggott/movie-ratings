-- Create table to track rating fetch attempts per media item
CREATE TABLE IF NOT EXISTS rating_fetch_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  success BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient querying by media_id and date
CREATE INDEX idx_fetch_attempts_media_date ON rating_fetch_attempts(media_id, attempted_at);

-- Index for daily cleanup queries
CREATE INDEX idx_fetch_attempts_date ON rating_fetch_attempts(attempted_at);

-- Function to count today's attempts for a media item
CREATE OR REPLACE FUNCTION count_daily_fetch_attempts(p_media_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM rating_fetch_attempts
    WHERE media_id = p_media_id
      AND attempted_at::date = CURRENT_DATE
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check if daily limit is reached
CREATE OR REPLACE FUNCTION is_daily_limit_reached(p_media_id UUID, p_limit INTEGER DEFAULT 3)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN count_daily_fetch_attempts(p_media_id) >= p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to record a fetch attempt
CREATE OR REPLACE FUNCTION record_fetch_attempt(p_media_id UUID, p_success BOOLEAN DEFAULT FALSE)
RETURNS VOID AS $$
BEGIN
  INSERT INTO rating_fetch_attempts (media_id, success)
  VALUES (p_media_id, p_success);
END;
$$ LANGUAGE plpgsql;

-- Optional: Clean up old attempts (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_attempts()
RETURNS VOID AS $$
BEGIN
  DELETE FROM rating_fetch_attempts
  WHERE attempted_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT, INSERT ON rating_fetch_attempts TO authenticated;
GRANT EXECUTE ON FUNCTION count_daily_fetch_attempts TO authenticated;
GRANT EXECUTE ON FUNCTION is_daily_limit_reached TO authenticated;
GRANT EXECUTE ON FUNCTION record_fetch_attempt TO authenticated;