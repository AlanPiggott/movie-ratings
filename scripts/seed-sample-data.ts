import { PrismaClient, MediaType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding sample data...')

  // Popular movies with scores
  const popularMovies = [
    {
      tmdbId: 550,
      mediaType: MediaType.MOVIE,
      title: 'Fight Club',
      releaseDate: new Date('1999-10-15'),
      posterPath: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
      overview: 'A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression.',
      alsoLikedPercentage: 88,
      searchCount: 1250,
      popularity: 61.416,
      voteAverage: 8.433,
      voteCount: 26280,
      runtime: 139,
      status: 'Released',
    },
    {
      tmdbId: 155,
      mediaType: MediaType.MOVIE,
      title: 'The Dark Knight',
      releaseDate: new Date('2008-07-16'),
      posterPath: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
      overview: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham.',
      alsoLikedPercentage: 94,
      searchCount: 2500,
      popularity: 123.167,
      voteAverage: 8.516,
      voteCount: 29750,
      runtime: 152,
      status: 'Released',
    },
    {
      tmdbId: 27205,
      mediaType: MediaType.MOVIE,
      title: 'Inception',
      releaseDate: new Date('2010-07-15'),
      posterPath: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg',
      overview: 'Cobb steals information from his targets by entering their dreams.',
      alsoLikedPercentage: 91,
      searchCount: 1800,
      popularity: 99.754,
      voteAverage: 8.367,
      voteCount: 33850,
      runtime: 148,
      status: 'Released',
    },
    {
      tmdbId: 680,
      mediaType: MediaType.MOVIE,
      title: 'Pulp Fiction',
      releaseDate: new Date('1994-10-14'),
      posterPath: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg',
      overview: 'A burger-loving hit man, his philosophical partner, a drug-addled gangster\'s moll.',
      alsoLikedPercentage: 92,
      searchCount: 1500,
      popularity: 72.342,
      voteAverage: 8.488,
      voteCount: 25230,
      runtime: 154,
      status: 'Released',
    },
    {
      tmdbId: 13,
      mediaType: MediaType.MOVIE,
      title: 'Forrest Gump',
      releaseDate: new Date('1994-07-06'),
      posterPath: '/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg',
      overview: 'The history of the United States from the 1950s to the \'70s unfolds from the perspective of an Alabama man.',
      alsoLikedPercentage: 95,
      searchCount: 1200,
      popularity: 55.245,
      voteAverage: 8.475,
      voteCount: 24780,
      runtime: 142,
      status: 'Released',
    },
  ]

  // Recent movies (2024)
  const recentMovies = [
    {
      tmdbId: 653346,
      mediaType: MediaType.MOVIE,
      title: 'Kingdom of the Planet of the Apes',
      releaseDate: new Date('2024-05-08'),
      posterPath: '/gKkl37BQuKTanygYQG1pyYgLVgf.jpg',
      overview: 'Several generations in the future following Caesar\'s reign.',
      alsoLikedPercentage: 82,
      searchCount: 450,
      popularity: 285.164,
      voteAverage: 7.2,
      voteCount: 1250,
      runtime: 145,
      status: 'Released',
    },
    {
      tmdbId: 519182,
      mediaType: MediaType.MOVIE,
      title: 'Despicable Me 4',
      releaseDate: new Date('2024-06-20'),
      posterPath: '/7WJosHRKGIbWKHuinFrEH0BB2Jg.jpg',
      overview: 'Gru, Lucy, Margo, Edith, and Agnes welcome a new member to the family.',
      alsoLikedPercentage: 78,
      searchCount: 320,
      popularity: 156.789,
      voteAverage: 7.1,
      voteCount: 890,
      runtime: 95,
      status: 'Released',
    },
  ]

  // Popular TV Shows
  const tvShows = [
    {
      tmdbId: 1396,
      mediaType: MediaType.TV_SHOW,
      title: 'Breaking Bad',
      releaseDate: new Date('2008-01-20'),
      posterPath: '/3xnWaLQjelJDDF7LT1WBo6f4BRe.jpg',
      overview: 'When Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer.',
      alsoLikedPercentage: 96,
      searchCount: 2100,
      popularity: 245.931,
      voteAverage: 8.87,
      voteCount: 11693,
      status: 'Ended',
    },
    {
      tmdbId: 94997,
      mediaType: MediaType.TV_SHOW,
      title: 'House of the Dragon',
      releaseDate: new Date('2022-08-21'),
      posterPath: '/7QMsOTMUswlwxJP0rTTZfmz2tX2.jpg',
      overview: 'The Targaryen dynasty is at the absolute apex of its power.',
      alsoLikedPercentage: 84,
      searchCount: 1500,
      popularity: 189.456,
      voteAverage: 8.1,
      voteCount: 4230,
      status: 'Returning Series',
    },
    {
      tmdbId: 1399,
      mediaType: MediaType.TV_SHOW,
      title: 'Game of Thrones',
      releaseDate: new Date('2011-04-17'),
      posterPath: '/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg',
      overview: 'Seven noble families fight for control of the mythical land of Westeros.',
      alsoLikedPercentage: 89,
      searchCount: 3200,
      popularity: 456.789,
      voteAverage: 8.4,
      voteCount: 22100,
      status: 'Ended',
    },
  ]

  // All-time favorites (90%+)
  const allTimeFavorites = [
    {
      tmdbId: 238,
      mediaType: MediaType.MOVIE,
      title: 'The Godfather',
      releaseDate: new Date('1972-03-24'),
      posterPath: '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
      overview: 'The aging patriarch of an organized crime dynasty transfers control.',
      alsoLikedPercentage: 97,
      searchCount: 2200,
      popularity: 105.234,
      voteAverage: 8.7,
      voteCount: 18200,
      runtime: 175,
      status: 'Released',
    },
    {
      tmdbId: 424,
      mediaType: MediaType.MOVIE,
      title: 'Schindler\'s List',
      releaseDate: new Date('1993-12-15'),
      posterPath: '/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg',
      overview: 'The true story of how businessman Oskar Schindler saved over a thousand Jewish lives.',
      alsoLikedPercentage: 96,
      searchCount: 980,
      popularity: 45.678,
      voteAverage: 8.6,
      voteCount: 14100,
      runtime: 195,
      status: 'Released',
    },
  ]

  // Seed all data
  console.log('🎬 Creating movies and TV shows...')
  
  const allMedia = [...popularMovies, ...recentMovies, ...tvShows, ...allTimeFavorites]
  
  for (const item of allMedia) {
    await prisma.mediaItem.upsert({
      where: { tmdbId: item.tmdbId },
      update: item,
      create: item,
    })
  }

  console.log('✅ Sample data seeded successfully!')
  console.log(`📊 Created ${popularMovies.length} popular movies`)
  console.log(`📊 Created ${recentMovies.length} recent movies`)
  console.log(`📊 Created ${tvShows.length} TV shows`)
  console.log(`📊 Created ${allTimeFavorites.length} all-time favorites`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error seeding data:', e)
    await prisma.$disconnect()
    process.exit(1)
  })