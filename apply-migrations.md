# Database Migrations

Copy and paste this entire SQL block into your Supabase SQL editor:

```sql
ALTER TABLE search_logs 
ADD COLUMN IF NOT EXISTS results JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS found BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS api_used BOOLEAN DEFAULT false;

UPDATE search_logs 
SET found = (results_count > 0)
WHERE found IS NULL;

CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_found ON search_logs(found);
CREATE INDEX IF NOT EXISTS idx_search_logs_api_used ON search_logs(api_used);

DROP FUNCTION IF EXISTS get_top_searches(TIMESTAMPTZ, INTEGER);
DROP FUNCTION IF EXISTS get_top_searches(INTEGER, TIMESTAMP WITH TIME ZONE);

CREATE OR REPLACE FUNCTION get_top_searches(
  p_limit INTEGER DEFAULT 10,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  search_query TEXT,
  search_count BIGINT,
  found_count BIGINT,
  not_found_count BIGINT,
  api_used_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.query AS search_query,
    COUNT(*) AS search_count,
    COUNT(*) FILTER (WHERE sl.found = true) AS found_count,
    COUNT(*) FILTER (WHERE sl.found = false) AS not_found_count,
    COUNT(*) FILTER (WHERE sl.api_used = true) AS api_used_count
  FROM search_logs sl
  WHERE sl.created_at >= p_start_date
  GROUP BY sl.query
  ORDER BY COUNT(*) DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE VIEW today_search_stats AS
SELECT 
  COUNT(*) AS total_searches,
  COUNT(*) FILTER (WHERE found = true) AS found_count,
  COUNT(*) FILTER (WHERE found = false) AS not_found_count,
  COUNT(*) FILTER (WHERE api_used = true) AS api_used_count
FROM search_logs
WHERE created_at >= CURRENT_DATE;

GRANT SELECT ON today_search_stats TO authenticated;
GRANT SELECT ON today_search_stats TO anon;
GRANT EXECUTE ON FUNCTION get_top_searches(INTEGER, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_searches(INTEGER, TIMESTAMP WITH TIME ZONE) TO anon;
```