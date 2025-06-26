import { prisma } from '@/lib/prisma/client'

async function searchForSinners() {
  try {
    console.log('Searching for movie "Sinners" in the database...\n')
    
    // Search for movies with "Sinners" in the title
    const results = await prisma.mediaItem.findMany({
      where: {
        title: {
          contains: 'Sinners',
          mode: 'insensitive'
        },
        mediaType: 'MOVIE'
      },
      include: {
        genres: {
          include: {
            genre: true
          }
        }
      },
      orderBy: {
        releaseDate: 'desc'
      }
    })
    
    if (results.length === 0) {
      console.log('No movies found with "Sinners" in the title.')
    } else {
      console.log(`Found ${results.length} movie(s) with "Sinners" in the title:\n`)
      
      results.forEach((movie, index) => {
        console.log(`${index + 1}. ${movie.title}`)
        console.log(`   ID: ${movie.id}`)
        console.log(`   TMDB ID: ${movie.tmdbId}`)
        console.log(`   Release Date: ${movie.releaseDate ? new Date(movie.releaseDate).toLocaleDateString() : 'N/A'}`)
        console.log(`   Also Liked Percentage: ${movie.alsoLikedPercentage !== null ? movie.alsoLikedPercentage + '%' : 'Not available'}`)
        console.log(`   Overview: ${movie.overview ? movie.overview.substring(0, 150) + '...' : 'No overview available'}`)
        console.log(`   Genres: ${movie.genres.map(g => g.genre.name).join(', ') || 'No genres'}`)
        console.log(`   Vote Average: ${movie.voteAverage || 'N/A'}`)
        console.log(`   Vote Count: ${movie.voteCount || 'N/A'}`)
        console.log(`   Popularity: ${movie.popularity || 'N/A'}`)
        console.log(`   Runtime: ${movie.runtime ? movie.runtime + ' minutes' : 'N/A'}`)
        console.log(`   Status: ${movie.status || 'N/A'}`)
        console.log(`   Last Searched: ${movie.lastSearched ? new Date(movie.lastSearched).toLocaleString() : 'Never'}`)
        console.log(`   Search Count: ${movie.searchCount}`)
        console.log('-'.repeat(80))
      })
    }
    
    // Also try exact match
    console.log('\nSearching for exact match "Sinners"...')
    const exactMatch = await prisma.mediaItem.findFirst({
      where: {
        title: 'Sinners',
        mediaType: 'MOVIE'
      },
      include: {
        genres: {
          include: {
            genre: true
          }
        }
      }
    })
    
    if (exactMatch) {
      console.log('\nFound exact match:')
      console.log(`Title: ${exactMatch.title}`)
      console.log(`ID: ${exactMatch.id}`)
      console.log(`TMDB ID: ${exactMatch.tmdbId}`)
    } else {
      console.log('No exact match found for "Sinners"')
    }
    
  } catch (error) {
    console.error('Error searching for movie:', error)
  } finally {
    await prisma.$disconnect()
  }
}

searchForSinners()