import { jest } from '@jest/globals'
import { TMDBService } from '../tmdb.service'
import { factories } from '@/tests/utils/factories'
import { mockFetch } from '@/tests/utils/test-helpers'

describe('TMDBService', () => {
  let tmdbService: TMDBService
  let mockFetchInstance: jest.Mock

  beforeEach(() => {
    tmdbService = new TMDBService()
    factories.reset()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('searchMulti', () => {
    it('should search for movies and TV shows successfully', async () => {
      const mockMovies = factories.createMany.tmdbMovies(2)
      const mockTvShows = factories.createMany.tmdbTvShows(2)
      const mockResponse = factories.tmdbSearchResponse([...mockMovies, ...mockTvShows])

      mockFetchInstance = mockFetch([{
        url: /\/search\/multi/,
        response: { data: mockResponse }
      }])

      const result = await tmdbService.searchMulti('test query')

      expect(result).toEqual(mockResponse)
      expect(mockFetchInstance).toHaveBeenCalledTimes(1)
      expect(mockFetchInstance).toHaveBeenCalledWith(
        expect.stringContaining('/search/multi?'),
        expect.objectContaining({
          headers: expect.any(Object),
          signal: expect.any(AbortSignal)
        })
      )
    })

    it('should handle search parameters correctly', async () => {
      const mockResponse = factories.tmdbSearchResponse([])
      mockFetchInstance = mockFetch([{
        url: /\/search\/multi/,
        response: { data: mockResponse }
      }])

      await tmdbService.searchMulti('test', {
        page: 2,
        includeAdult: true,
        language: 'es-ES',
        region: 'ES'
      })

      const callUrl = mockFetchInstance.mock.calls[0][0]
      expect(callUrl).toContain('page=2')
      expect(callUrl).toContain('include_adult=true')
      expect(callUrl).toContain('language=es-ES')
      expect(callUrl).toContain('region=ES')
    })

    it('should throw error when API returns non-ok response', async () => {
      mockFetchInstance = mockFetch([{
        url: /\/search\/multi/,
        response: { 
          ok: false,
          status: 401,
          statusText: 'Unauthorized'
        }
      }])

      await expect(tmdbService.searchMulti('test')).rejects.toThrow('TMDB API error: Unauthorized')
    })
  })

  describe('getMovieDetails', () => {
    it('should fetch movie details successfully', async () => {
      const movieId = 550
      const mockMovie = {
        id: movieId,
        title: 'Fight Club',
        release_date: '1999-10-15',
        runtime: 139,
        overview: 'A ticking-time-bomb insomniac...',
        genres: [{ id: 18, name: 'Drama' }]
      }

      mockFetchInstance = mockFetch([{
        url: `/movie/${movieId}`,
        response: { data: mockMovie }
      }])

      const result = await tmdbService.getMovieDetails(movieId)

      expect(result).toEqual(mockMovie)
      expect(mockFetchInstance).toHaveBeenCalledWith(
        expect.stringContaining(`/movie/${movieId}?`),
        expect.any(Object)
      )
    })

    it('should handle API timeout', async () => {
      const movieId = 550
      mockFetchInstance = jest.fn().mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 100)
        })
      )
      global.fetch = mockFetchInstance as any

      await expect(tmdbService.getMovieDetails(movieId)).rejects.toThrow()
    })

    it('should include correct headers and parameters', async () => {
      const movieId = 123
      mockFetchInstance = mockFetch([{
        url: `/movie/${movieId}`,
        response: { data: {} }
      }])

      await tmdbService.getMovieDetails(movieId)

      const [url, options] = mockFetchInstance.mock.calls[0]
      expect(url).toContain('api_key=')
      expect(url).toContain('language=en-US')
      expect(options.headers).toBeDefined()
      expect(options.signal).toBeInstanceOf(AbortSignal)
    })
  })

  describe('getTVDetails', () => {
    it('should fetch TV show details successfully', async () => {
      const tvId = 1396
      const mockTvShow = {
        id: tvId,
        name: 'Breaking Bad',
        first_air_date: '2008-01-20',
        number_of_seasons: 5,
        number_of_episodes: 62,
        genres: [{ id: 18, name: 'Drama' }, { id: 80, name: 'Crime' }]
      }

      mockFetchInstance = mockFetch([{
        url: `/tv/${tvId}`,
        response: { data: mockTvShow }
      }])

      const result = await tmdbService.getTVDetails(tvId)

      expect(result).toEqual(mockTvShow)
      expect(mockFetchInstance).toHaveBeenCalledWith(
        expect.stringContaining(`/tv/${tvId}?`),
        expect.any(Object)
      )
    })

    it('should handle network errors', async () => {
      const tvId = 1396
      mockFetchInstance = jest.fn().mockRejectedValue(new Error('Network error'))
      global.fetch = mockFetchInstance as any

      await expect(tmdbService.getTVDetails(tvId)).rejects.toThrow('Network error')
    })

    it('should handle non-ok responses', async () => {
      const tvId = 999999
      mockFetchInstance = mockFetch([{
        url: `/tv/${tvId}`,
        response: { 
          ok: false,
          status: 404,
          statusText: 'Not Found'
        }
      }])

      await expect(tmdbService.getTVDetails(tvId)).rejects.toThrow('TMDB API error: Not Found')
    })
  })

  describe('transformSearchResult', () => {
    it('should transform movie result correctly', () => {
      const tmdbMovie = factories.tmdbMovie({
        media_type: 'movie',
        title: 'Test Movie',
        original_title: 'Original Test Movie',
        release_date: '2024-01-01'
      })

      const result = tmdbService.transformSearchResult(tmdbMovie)

      expect(result).toEqual({
        tmdbId: tmdbMovie.id,
        mediaType: 'MOVIE',
        title: 'Test Movie',
        originalTitle: 'Original Test Movie',
        releaseDate: '2024-01-01',
        posterPath: tmdbMovie.poster_path,
        backdropPath: tmdbMovie.backdrop_path,
        overview: tmdbMovie.overview,
        popularity: tmdbMovie.popularity,
        voteAverage: tmdbMovie.vote_average,
        voteCount: tmdbMovie.vote_count,
        genreIds: tmdbMovie.genre_ids
      })
    })

    it('should transform TV show result correctly', () => {
      const tmdbTvShow = factories.tmdbTvShow({
        media_type: 'tv',
        name: 'Test Show',
        original_name: 'Original Test Show',
        first_air_date: '2024-01-01'
      })

      const result = tmdbService.transformSearchResult(tmdbTvShow)

      expect(result).toEqual({
        tmdbId: tmdbTvShow.id,
        mediaType: 'TV_SHOW',
        title: 'Test Show',
        originalTitle: 'Original Test Show',
        releaseDate: '2024-01-01',
        posterPath: tmdbTvShow.poster_path,
        backdropPath: tmdbTvShow.backdrop_path,
        overview: tmdbTvShow.overview,
        popularity: tmdbTvShow.popularity,
        voteAverage: tmdbTvShow.vote_average,
        voteCount: tmdbTvShow.vote_count,
        genreIds: tmdbTvShow.genre_ids
      })
    })

    it('should handle missing optional fields', () => {
      const minimalMovie = {
        id: 123,
        title: 'Minimal Movie',
        media_type: 'movie' as const
      }

      const result = tmdbService.transformSearchResult(minimalMovie)

      expect(result).toEqual({
        tmdbId: 123,
        mediaType: 'MOVIE',
        title: 'Minimal Movie',
        originalTitle: undefined,
        releaseDate: undefined,
        posterPath: undefined,
        backdropPath: undefined,
        overview: undefined,
        popularity: undefined,
        voteAverage: undefined,
        voteCount: undefined,
        genreIds: undefined
      })
    })
  })

  describe('getTrending', () => {
    it('should fetch trending movies with default time window', async () => {
      const mockMovies = factories.createMany.tmdbMovies(5)
      const mockResponse = {
        ...factories.tmdbSearchResponse(mockMovies),
        results: mockMovies
      }

      mockFetchInstance = mockFetch([{
        url: /\/trending\/movie\/day/,
        response: { data: mockResponse }
      }])

      const result = await tmdbService.getTrending('movie')

      expect(result.results).toHaveLength(5)
      expect(result.results[0]).toHaveProperty('media_type', 'movie')
      expect(mockFetchInstance).toHaveBeenCalledWith(
        expect.stringContaining('/trending/movie/day?'),
        expect.any(Object)
      )
    })

    it('should fetch trending TV shows with week time window', async () => {
      const mockTvShows = factories.createMany.tmdbTvShows(3)
      const mockResponse = {
        ...factories.tmdbSearchResponse(mockTvShows),
        results: mockTvShows
      }

      mockFetchInstance = mockFetch([{
        url: /\/trending\/tv\/week/,
        response: { data: mockResponse }
      }])

      const result = await tmdbService.getTrending('tv', 'week')

      expect(result.results).toHaveLength(3)
      expect(result.results[0]).toHaveProperty('media_type', 'tv')
      expect(mockFetchInstance).toHaveBeenCalledWith(
        expect.stringContaining('/trending/tv/week?'),
        expect.any(Object)
      )
    })

    it('should add media_type to results', async () => {
      const mockResults = [
        { id: 1, title: 'Movie 1' },
        { id: 2, title: 'Movie 2' }
      ]
      const mockResponse = factories.tmdbSearchResponse(mockResults)

      mockFetchInstance = mockFetch([{
        url: /\/trending\/movie/,
        response: { data: mockResponse }
      }])

      const result = await tmdbService.getTrending('movie')

      result.results.forEach(item => {
        expect(item).toHaveProperty('media_type', 'movie')
      })
    })
  })

  describe('discoverMovies', () => {
    it('should discover movies with filters', async () => {
      const mockMovies = factories.createMany.tmdbMovies(10)
      const mockResponse = factories.tmdbSearchResponse(mockMovies)

      mockFetchInstance = mockFetch([{
        url: /\/discover\/movie/,
        response: { data: mockResponse }
      }])

      const filters = {
        'primary_release_date.gte': '2024-01-01',
        'vote_average.gte': '7',
        'with_genres': '28,12'
      }

      const result = await tmdbService.discoverMovies(filters)

      expect(result.results).toHaveLength(10)
      expect(result.results[0]).toHaveProperty('media_type', 'movie')
      
      const callUrl = mockFetchInstance.mock.calls[0][0]
      expect(callUrl).toContain('primary_release_date.gte=2024-01-01')
      expect(callUrl).toContain('vote_average.gte=7')
      expect(callUrl).toContain('with_genres=28%2C12')
    })

    it('should use default parameters when no filters provided', async () => {
      const mockResponse = factories.tmdbSearchResponse([])
      mockFetchInstance = mockFetch([{
        url: /\/discover\/movie/,
        response: { data: mockResponse }
      }])

      await tmdbService.discoverMovies()

      const callUrl = mockFetchInstance.mock.calls[0][0]
      expect(callUrl).toContain('language=en-US')
      expect(callUrl).toContain('region=US')
    })

    it('should add media_type to all results', async () => {
      const mockResults = [
        { id: 1, title: 'Movie 1' },
        { id: 2, title: 'Movie 2' }
      ]
      const mockResponse = factories.tmdbSearchResponse(mockResults)

      mockFetchInstance = mockFetch([{
        url: /\/discover\/movie/,
        response: { data: mockResponse }
      }])

      const result = await tmdbService.discoverMovies()

      result.results.forEach(item => {
        expect(item).toHaveProperty('media_type', 'movie')
      })
    })
  })

  describe('getGenres', () => {
    it('should fetch both movie and TV genres', async () => {
      const movieGenres = [
        { id: 28, name: 'Action' },
        { id: 12, name: 'Adventure' }
      ]
      const tvGenres = [
        { id: 10759, name: 'Action & Adventure' },
        { id: 16, name: 'Animation' }
      ]

      mockFetchInstance = mockFetch([
        {
          url: /\/genre\/movie\/list/,
          response: { data: { genres: movieGenres } }
        },
        {
          url: /\/genre\/tv\/list/,
          response: { data: { genres: tvGenres } }
        }
      ])

      const result = await tmdbService.getGenres()

      expect(result).toEqual({
        movies: movieGenres,
        tv: tvGenres
      })
      expect(mockFetchInstance).toHaveBeenCalledTimes(2)
    })

    it('should handle partial failures gracefully', async () => {
      const movieGenres = [{ id: 28, name: 'Action' }]

      mockFetchInstance = jest.fn()
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: async () => ({ genres: movieGenres })
        }))
        .mockImplementationOnce(() => Promise.reject(new Error('Network error')))

      global.fetch = mockFetchInstance as any

      await expect(tmdbService.getGenres()).rejects.toThrow('Network error')
    })
  })

  describe('getImageUrl', () => {
    it('should build correct image URL with default size', () => {
      const path = '/abc123.jpg'
      const result = tmdbService.getImageUrl(path)
      
      expect(result).toBe('https://image.tmdb.org/t/p/w500/abc123.jpg')
    })

    it('should build correct image URL with custom size', () => {
      const path = '/xyz789.jpg'
      const result = tmdbService.getImageUrl(path, 'original')
      
      expect(result).toBe('https://image.tmdb.org/t/p/original/xyz789.jpg')
    })

    it('should return null for empty path', () => {
      expect(tmdbService.getImageUrl(null)).toBeNull()
      expect(tmdbService.getImageUrl(undefined)).toBeNull()
      expect(tmdbService.getImageUrl('')).toBeNull()
    })
  })

  describe('checkApiKey', () => {
    it('should throw error when API key is not configured', () => {
      // Mock the config to have empty API key
      const originalApiKey = process.env.TMDB_API_KEY
      process.env.TMDB_API_KEY = ''
      
      const serviceWithoutKey = new TMDBService()
      
      expect(() => {
        (serviceWithoutKey as any).checkApiKey()
      }).toThrow('TMDB API key is not configured')
      
      // Restore original
      process.env.TMDB_API_KEY = originalApiKey
    })
  })
})