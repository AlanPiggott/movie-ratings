import { PrismaClient, MediaType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Seed Genres
  const genres = [
    { tmdbId: 28, name: 'Action' },
    { tmdbId: 12, name: 'Adventure' },
    { tmdbId: 16, name: 'Animation' },
    { tmdbId: 35, name: 'Comedy' },
    { tmdbId: 80, name: 'Crime' },
    { tmdbId: 99, name: 'Documentary' },
    { tmdbId: 18, name: 'Drama' },
    { tmdbId: 10751, name: 'Family' },
    { tmdbId: 14, name: 'Fantasy' },
    { tmdbId: 36, name: 'History' },
    { tmdbId: 27, name: 'Horror' },
    { tmdbId: 10402, name: 'Music' },
    { tmdbId: 9648, name: 'Mystery' },
    { tmdbId: 10749, name: 'Romance' },
    { tmdbId: 878, name: 'Science Fiction' },
    { tmdbId: 10770, name: 'TV Movie' },
    { tmdbId: 53, name: 'Thriller' },
    { tmdbId: 10752, name: 'War' },
    { tmdbId: 37, name: 'Western' },
  ]

  console.log('📝 Creating genres...')
  for (const genre of genres) {
    await prisma.genre.upsert({
      where: { tmdbId: genre.tmdbId },
      update: {},
      create: genre,
    })
  }

  // Seed sample media items (movies and TV shows)
  const sampleMediaItems = [
    {
      tmdbId: 550,
      mediaType: MediaType.MOVIE,
      title: 'Fight Club',
      releaseDate: new Date('1999-10-15'),
      posterPath: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
      overview: 'A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy.',
      alsoLikedPercentage: 88,
      searchCount: 1250,
      lastSearched: new Date(),
      popularity: 61.416,
      voteAverage: 8.433,
      voteCount: 26280,
      runtime: 139,
      status: 'Released',
    },
    {
      tmdbId: 1396,
      mediaType: MediaType.TV_SHOW,
      title: 'Breaking Bad',
      releaseDate: new Date('2008-01-20'),
      posterPath: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
      overview: 'When Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given a prognosis of only two years left to live.',
      alsoLikedPercentage: 96,
      searchCount: 2100,
      lastSearched: new Date(),
      popularity: 245.931,
      voteAverage: 8.87,
      voteCount: 11693,
      status: 'Ended',
    },
  ]

  console.log('🎬 Creating sample media items...')
  for (const item of sampleMediaItems) {
    await prisma.mediaItem.upsert({
      where: { tmdbId: item.tmdbId },
      update: {},
      create: item,
    })
  }

  // Create genre associations
  console.log('🔗 Creating genre associations...')
  
  // Fight Club genres: Drama, Thriller
  const fightClub = await prisma.mediaItem.findUnique({ where: { tmdbId: 550 } })
  const dramaGenre = await prisma.genre.findUnique({ where: { name: 'Drama' } })
  const thrillerGenre = await prisma.genre.findUnique({ where: { name: 'Thriller' } })

  if (fightClub && dramaGenre && thrillerGenre) {
    await prisma.mediaGenre.createMany({
      data: [
        { mediaItemId: fightClub.id, genreId: dramaGenre.id },
        { mediaItemId: fightClub.id, genreId: thrillerGenre.id },
      ],
      skipDuplicates: true,
    })
  }

  // Breaking Bad genres: Crime, Drama, Thriller
  const breakingBad = await prisma.mediaItem.findUnique({ where: { tmdbId: 1396 } })
  const crimeGenre = await prisma.genre.findUnique({ where: { name: 'Crime' } })

  if (breakingBad && crimeGenre && dramaGenre && thrillerGenre) {
    await prisma.mediaGenre.createMany({
      data: [
        { mediaItemId: breakingBad.id, genreId: crimeGenre.id },
        { mediaItemId: breakingBad.id, genreId: dramaGenre.id },
        { mediaItemId: breakingBad.id, genreId: thrillerGenre.id },
      ],
      skipDuplicates: true,
    })
  }


  // Sample API fetch logs
  console.log('📊 Creating sample API fetch logs...')
  await prisma.apiFetchLog.createMany({
    data: [
      {
        endpoint: '/api/3/movie/550',
        method: 'GET',
        statusCode: 200,
        responseTime: 125,
        cost: 0.001,
        createdAt: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
      },
      {
        endpoint: '/api/3/tv/1396',
        method: 'GET',
        statusCode: 200,
        responseTime: 98,
        cost: 0.001,
        createdAt: new Date(Date.now() - 1000 * 60 * 10), // 10 minutes ago
      },
      {
        endpoint: '/api/3/search/multi',
        method: 'GET',
        statusCode: 429,
        responseTime: 45,
        errorMessage: 'Rate limit exceeded',
        metadata: { retryAfter: 60 },
        createdAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      },
    ],
  })

  console.log('✅ Database seed completed!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error during seeding:', e)
    await prisma.$disconnect()
    process.exit(1)
  })