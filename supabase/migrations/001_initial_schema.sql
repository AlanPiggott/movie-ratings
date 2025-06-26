-- Movie Discovery Platform - Initial Schema Migration
-- This migration creates all tables with Supabase-specific features
-- including RLS (Row Level Security) and automatic timestamps

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE media_type AS ENUM ('MOVIE', 'TV_SHOW');

-- =====================================================
-- GENRES TABLE
-- =====================================================
CREATE TABLE genres (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tmdb_id INTEGER NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for genres
CREATE INDEX idx_genres_name ON genres(name);
CREATE INDEX idx_genres_tmdb_id ON genres(tmdb_id);

-- Enable RLS on genres
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for genres (read-only for everyone)
CREATE POLICY "Allow public read access on genres" ON genres
    FOR SELECT USING (true);

-- =====================================================
-- MEDIA_ITEMS TABLE
-- =====================================================
CREATE TABLE media_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tmdb_id INTEGER NOT NULL UNIQUE,
    media_type media_type NOT NULL,
    title VARCHAR(500) NOT NULL,
    release_date DATE,
    poster_path VARCHAR(500),
    overview TEXT,
    also_liked_percentage INTEGER CHECK (also_liked_percentage >= 0 AND also_liked_percentage <= 100),
    search_count INTEGER DEFAULT 0 NOT NULL,
    last_searched TIMESTAMPTZ,
    original_title VARCHAR(500),
    backdrop_path VARCHAR(500),
    popularity DECIMAL(10,4),
    vote_average DECIMAL(3,1) CHECK (vote_average >= 0 AND vote_average <= 10),
    vote_count INTEGER,
    runtime INTEGER,
    status VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for media_items
CREATE INDEX idx_media_items_title ON media_items(title);
CREATE INDEX idx_media_items_media_type ON media_items(media_type);
CREATE INDEX idx_media_items_release_date ON media_items(release_date);
CREATE INDEX idx_media_items_also_liked_percentage ON media_items(also_liked_percentage);
CREATE INDEX idx_media_items_search_count ON media_items(search_count);
CREATE INDEX idx_media_items_tmdb_id ON media_items(tmdb_id);
CREATE INDEX idx_media_items_media_type_release_date ON media_items(media_type, release_date);
CREATE INDEX idx_media_items_title_release_date ON media_items(title, release_date);

-- Enable RLS on media_items
ALTER TABLE media_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for media_items
CREATE POLICY "Allow public read access on media_items" ON media_items
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to update media_items" ON media_items
    FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow service role to insert media_items" ON media_items
    FOR INSERT WITH CHECK (true);

-- =====================================================
-- MEDIA_GENRES TABLE (Junction table)
-- =====================================================
CREATE TABLE media_genres (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    media_item_id UUID NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
    genre_id UUID NOT NULL REFERENCES genres(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(media_item_id, genre_id)
);

-- Create indexes for media_genres
CREATE INDEX idx_media_genres_media_item_id ON media_genres(media_item_id);
CREATE INDEX idx_media_genres_genre_id ON media_genres(genre_id);

-- Enable RLS on media_genres
ALTER TABLE media_genres ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for media_genres
CREATE POLICY "Allow public read access on media_genres" ON media_genres
    FOR SELECT USING (true);

CREATE POLICY "Allow service role to manage media_genres" ON media_genres
    FOR ALL USING (true);


-- =====================================================
-- API_FETCH_LOGS TABLE
-- =====================================================
CREATE TABLE api_fetch_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) DEFAULT 'GET' NOT NULL,
    status_code INTEGER,
    response_time INTEGER, -- in milliseconds
    cost DECIMAL(10,6), -- API cost if applicable
    error_message TEXT,
    metadata JSONB, -- Additional data like rate limits
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for api_fetch_logs
CREATE INDEX idx_api_fetch_logs_endpoint ON api_fetch_logs(endpoint);
CREATE INDEX idx_api_fetch_logs_created_at ON api_fetch_logs(created_at);
CREATE INDEX idx_api_fetch_logs_status_code ON api_fetch_logs(status_code);

-- Enable RLS on api_fetch_logs
ALTER TABLE api_fetch_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for api_fetch_logs
CREATE POLICY "Allow service role to manage api_fetch_logs" ON api_fetch_logs
    FOR ALL USING (true);

-- =====================================================
-- DATABASE FUNCTIONS
-- =====================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_genres_updated_at BEFORE UPDATE ON genres
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_media_items_updated_at BEFORE UPDATE ON media_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment search count atomically
CREATE OR REPLACE FUNCTION increment_search_count(media_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE media_items 
    SET search_count = search_count + 1,
        last_searched = NOW()
    WHERE id = media_id;
END;
$$ language 'plpgsql';


-- Function to get media with genres (for efficient querying)
CREATE OR REPLACE FUNCTION get_media_with_genres(media_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'id', m.id,
        'tmdb_id', m.tmdb_id,
        'media_type', m.media_type,
        'title', m.title,
        'release_date', m.release_date,
        'poster_path', m.poster_path,
        'overview', m.overview,
        'also_liked_percentage', m.also_liked_percentage,
        'search_count', m.search_count,
        'last_searched', m.last_searched,
        'genres', COALESCE(
            json_agg(
                json_build_object(
                    'id', g.id,
                    'tmdb_id', g.tmdb_id,
                    'name', g.name
                ) ORDER BY g.name
            ) FILTER (WHERE g.id IS NOT NULL), 
            '[]'::json
        )
    ) INTO result
    FROM media_items m
    LEFT JOIN media_genres mg ON m.id = mg.media_item_id
    LEFT JOIN genres g ON mg.genre_id = g.id
    WHERE m.id = media_id
    GROUP BY m.id;
    
    RETURN result;
END;
$$ language 'plpgsql';

-- =====================================================
-- GRANT PERMISSIONS (for Supabase)
-- =====================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant permissions on tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, UPDATE ON media_items TO authenticated;
GRANT SELECT ON genres, media_genres TO authenticated;

-- Grant permissions on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION increment_search_count(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_top_searches(TIMESTAMPTZ, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_media_with_genres(UUID) TO anon, authenticated, service_role;

-- =====================================================
-- INITIAL DATA (Optional)
-- =====================================================

-- Insert common movie/TV genres
INSERT INTO genres (tmdb_id, name) VALUES
    (28, 'Action'),
    (12, 'Adventure'),
    (16, 'Animation'),
    (35, 'Comedy'),
    (80, 'Crime'),
    (99, 'Documentary'),
    (18, 'Drama'),
    (10751, 'Family'),
    (14, 'Fantasy'),
    (36, 'History'),
    (27, 'Horror'),
    (10402, 'Music'),
    (9648, 'Mystery'),
    (10749, 'Romance'),
    (878, 'Science Fiction'),
    (10770, 'TV Movie'),
    (53, 'Thriller'),
    (10752, 'War'),
    (37, 'Western')
ON CONFLICT (tmdb_id) DO NOTHING;