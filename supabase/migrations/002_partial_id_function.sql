-- Create a function to find media by partial ID
CREATE OR REPLACE FUNCTION find_media_by_partial_id(partial_id text)
RETURNS SETOF media_items
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM media_items 
  WHERE id::text ILIKE partial_id || '%'
  LIMIT 1;
$$;