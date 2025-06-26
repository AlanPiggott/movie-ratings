-- Add TV-specific genres that might be missing
INSERT INTO genres (tmdb_id, name) VALUES
    (10759, 'Action & Adventure'),
    (10762, 'Kids'),
    (10763, 'News'),
    (10764, 'Reality'),
    (10765, 'Sci-Fi & Fantasy'),
    (10766, 'Soap'),
    (10767, 'Talk'),
    (10768, 'War & Politics')
ON CONFLICT (tmdb_id) DO NOTHING;