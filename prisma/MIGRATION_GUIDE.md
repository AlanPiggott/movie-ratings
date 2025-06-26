# Prisma Migration Guide

## Initial Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up your PostgreSQL database**
   - Create a new PostgreSQL database
   - Update the `DATABASE_URL` in `.env.local`

## Migration Commands

### Create and Apply Migrations

1. **Generate Prisma Client**
   ```bash
   npm run prisma:generate
   ```

2. **Create a new migration**
   ```bash
   npm run prisma:migrate:create -- --name init
   ```

3. **Apply migrations to database**
   ```bash
   npm run prisma:migrate
   ```

4. **Deploy migrations (production)**
   ```bash
   npm run prisma:migrate:deploy
   ```

### Database Management

1. **Push schema changes (development only)**
   ```bash
   npm run db:push
   ```

2. **Reset database and apply all migrations**
   ```bash
   npm run prisma:migrate:reset
   ```

3. **Seed the database**
   ```bash
   npm run db:seed
   ```

4. **Open Prisma Studio (GUI)**
   ```bash
   npm run prisma:studio
   ```

## Schema Overview

### Main Tables

1. **media_items**
   - Stores both movies and TV shows
   - Tracks Google's "% liked" score (`alsoLikedPercentage`)
   - Includes search metrics (`searchCount`, `lastSearched`)

2. **genres**
   - Movie/TV show categories
   - Many-to-many relationship with media items

3. **search_logs**
   - Tracks user searches
   - Helps identify popular content

4. **api_fetch_logs**
   - Monitors API usage
   - Tracks costs and rate limits

### Indexes

The schema includes indexes optimized for:
- **Search**: `title`, `title + releaseDate`
- **Filtering**: `mediaType`, `genres`
- **Sorting**: `alsoLikedPercentage`, `searchCount`, `releaseDate`
- **Performance**: Composite indexes for common query patterns

## Common Tasks

### Add a new media item
```typescript
const newMovie = await prisma.mediaItem.create({
  data: {
    tmdbId: 123456,
    mediaType: 'MOVIE',
    title: 'Example Movie',
    releaseDate: new Date('2024-01-01'),
    alsoLikedPercentage: 85,
    genres: {
      connect: [
        { id: 'genre-id-1' },
        { id: 'genre-id-2' }
      ]
    }
  }
})
```

### Update search metrics
```typescript
await prisma.mediaItem.update({
  where: { id: mediaItemId },
  data: {
    searchCount: { increment: 1 },
    lastSearched: new Date()
  }
})
```

### Log API usage
```typescript
await prisma.apiFetchLog.create({
  data: {
    endpoint: '/api/3/movie/popular',
    statusCode: 200,
    responseTime: 150,
    cost: 0.001
  }
})
```