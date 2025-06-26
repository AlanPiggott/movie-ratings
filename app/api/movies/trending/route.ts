import { NextResponse } from 'next/server'

// Temporary mock data until database is connected
export async function GET() {
  const mockMovies = [
    {
      id: '1',
      tmdbId: 550,
      mediaType: 'MOVIE',
      title: 'Fight Club',
      releaseDate: '1999-10-15',
      posterPath: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
      overview: 'A ticking-time-bomb insomniac and a slippery soap salesman...',
      alsoLikedPercentage: 88,
      voteAverage: 8.4,
    },
    {
      id: '2',
      tmdbId: 680,
      mediaType: 'MOVIE',
      title: 'Pulp Fiction',
      releaseDate: '1994-09-10',
      posterPath: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg',
      overview: 'A burger-loving hit man, his philosophical partner...',
      alsoLikedPercentage: 92,
      voteAverage: 8.5,
    },
  ]

  return NextResponse.json({ results: mockMovies })
}