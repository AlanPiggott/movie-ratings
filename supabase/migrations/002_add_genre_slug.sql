-- Add slug column to genres table
ALTER TABLE genres ADD COLUMN slug VARCHAR(255);

-- Create a function to generate slug from name
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          input_text,
          '[^a-zA-Z0-9\s-]', '', 'g'  -- Remove special characters
        ),
        '\s+', '-', 'g'  -- Replace spaces with hyphens
      ),
      '-+', '-', 'g'  -- Replace multiple hyphens with single hyphen
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Update existing genres with slugs
UPDATE genres SET slug = generate_slug(name);

-- Make slug NOT NULL and UNIQUE after populating
ALTER TABLE genres ALTER COLUMN slug SET NOT NULL;
ALTER TABLE genres ADD CONSTRAINT genres_slug_unique UNIQUE (slug);

-- Add index on slug for faster lookups
CREATE INDEX idx_genres_slug ON genres(slug);

-- Add a trigger to automatically generate slug on insert/update
CREATE OR REPLACE FUNCTION generate_genre_slug()
RETURNS TRIGGER AS $$
BEGIN
  NEW.slug = generate_slug(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER genre_slug_trigger
BEFORE INSERT OR UPDATE OF name ON genres
FOR EACH ROW
EXECUTE FUNCTION generate_genre_slug();