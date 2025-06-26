import { jest } from '@jest/globals'
import { GET, OPTIONS } from '../route'
import { createMockNextRequest } from '@/tests/utils/test-helpers'
import { factories } from '@/tests/utils/factories'
import { mediaService } from '@/services/database'
import { tmdbService } from '@/services/tmdb.service'
import { NextResponse } from 'next/server'

// Mock dependencies
jest.mock('@/services/database', () => ({
  mediaService: {
    searchMedia: jest.fn(),
    createOrUpdateMedia: jest.fn(),
  },
}))

jest.mock('@/services/tmdb.service', () => ({
  tmdbService: {
    searchMulti: jest.fn(),
    getGenres: jest.fn(),
    transformSearchResult: jest.fn(),
  },
}))

describe('Search API Route', () => {
  const mockSearchMedia = mediaService.searchMedia as jest.Mock
  const mockCreateOrUpdateMedia = mediaService.createOrUpdateMedia as jest.Mock
  const mockSearchMulti = tmdbService.searchMulti as jest.Mock
  const mockGetGenres = tmdbService.getGenres as jest.Mock
  const mockTransformSearchResult = tmdbService.transformSearchResult as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    factories.reset()
  })

  describe('GET /api/search', () => {
    it('should return results from database when sufficient matches exist', async () => {
      const mockDbResults = factories.createMany.mediaItems(5)
      mockSearchMedia.mockResolvedValueOnce({
        items: mockDbResults,
        total: 5,
        page: 1,
        totalPages: 1,
      })

      const request = createMockNextRequest({
        url: 'http://localhost:3000/api/search?q=test+movie',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.source).toBe('database')
      expect(data.results).toHaveLength(5)
      expect(data.query).toBe('test movie')
      expect(mockSearchMulti).not.toHaveBeenCalled()
    })

    it('should search external API when database has insufficient results', async () => {
      // Mock database returning only 1 result
      const dbItem = factories.mediaItem({ title: 'Database Movie' })
      mockSearchMedia.mockResolvedValueOnce({
        items: [dbItem],
        total: 1,
        page: 1,
        totalPages: 1,
      })

      // Mock TMDB API response
      const tmdbMovies = factories.createMany.tmdbMovies(3)
      mockSearchMulti.mockResolvedValueOnce({
        page: 1,
        results: tmdbMovies,
        total_pages: 1,
        total_results: 3,
      })

      // Mock genre mapping
      mockGetGenres.mockResolvedValueOnce({
        movies: [{ id: 28, name: 'Action' }],
        tv: [{ id: 10759, name: 'Action & Adventure' }],
      })

      // Mock transform function
      mockTransformSearchResult.mockImplementation((result) => ({
        tmdbId: result.id,
        mediaType: 'MOVIE',
        title: result.title,
        releaseDate: result.release_date,
        posterPath: result.poster_path,
        overview: result.overview,
        genreIds: result.genre_ids,
        voteAverage: result.vote_average,
      }))

      // Mock saving to database
      mockCreateOrUpdateMedia.mockImplementation((data) => 
        Promise.resolve({
          id: `saved-${data.tmdbId}`,
          ...data,
          media_type: data.mediaType,
          poster_path: data.posterPath,
          also_liked_percentage: null,
          release_date: data.releaseDate,
          vote_average: data.voteAverage,
        })
      )

      const request = createMockNextRequest({
        url: 'http://localhost:3000/api/search?q=action',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.source).toBe('mixed')
      expect(data.results.length).toBeGreaterThan(1)
      expect(mockSearchMulti).toHaveBeenCalledWith('action', { page: 1 })
      expect(mockCreateOrUpdateMedia).toHaveBeenCalledTimes(3)
    })

    it('should handle pagination parameters correctly', async () => {
      const mockDbResults = factories.createMany.mediaItems(30)
      mockSearchMedia.mockResolvedValueOnce({
        items: mockDbResults,
        total: 30,
        page: 1,
        totalPages: 2,
      })

      const request = createMockNextRequest({
        url: 'http://localhost:3000/api/search?q=test&page=2&limit=10',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.results).toHaveLength(10)
      expect(data.total).toBe(30)
    })

    it('should handle invalid query parameters', async () => {
      const request = createMockNextRequest({
        url: 'http://localhost:3000/api/search?q=',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid search parameters')
      expect(data.details).toBeDefined()
    })

    it('should handle database search errors gracefully', async () => {
      mockSearchMedia.mockRejectedValueOnce(new Error('Database connection failed'))

      const request = createMockNextRequest({
        url: 'http://localhost:3000/api/search?q=test',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Search failed')
      expect(data.message).toBe('Database connection failed')
    })

    it('should continue with database results when external API fails', async () => {
      const mockDbResults = factories.createMany.mediaItems(2)
      mockSearchMedia.mockResolvedValueOnce({
        items: mockDbResults,
        total: 2,
        page: 1,
        totalPages: 1,
      })

      mockSearchMulti.mockRejectedValueOnce(new Error('TMDB API error'))

      const request = createMockNextRequest({
        url: 'http://localhost:3000/api/search?q=test',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.source).toBe('database')
      expect(data.results).toHaveLength(2)
    })

    it('should filter out person results from TMDB', async () => {
      mockSearchMedia.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        totalPages: 0,
      })

      const tmdbResults = [
        { ...factories.tmdbMovie(), media_type: 'movie' },
        { id: 999, name: 'Tom Cruise', media_type: 'person' },
        { ...factories.tmdbTvShow(), media_type: 'tv' },
      ]

      mockSearchMulti.mockResolvedValueOnce({
        page: 1,
        results: tmdbResults,
        total_pages: 1,
        total_results: 3,
      })

      mockGetGenres.mockResolvedValueOnce({ movies: [], tv: [] })
      mockTransformSearchResult.mockImplementation((result) => ({
        tmdbId: result.id,
        mediaType: result.media_type === 'movie' ? 'MOVIE' : 'TV_SHOW',
        title: result.title || result.name,
      }))

      mockCreateOrUpdateMedia.mockImplementation((data) => 
        Promise.resolve({ id: `saved-${data.tmdbId}`, ...data })
      )

      const request = createMockNextRequest({
        url: 'http://localhost:3000/api/search?q=test',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.results).toHaveLength(2)
      expect(data.results.every(r => r.mediaType !== 'person')).toBe(true)
      expect(mockCreateOrUpdateMedia).toHaveBeenCalledTimes(2)
    })

    it('should sort results by relevance', async () => {
      const mockDbResults = [
        factories.mediaItem({ 
          title: 'Test Movie', 
          also_liked_percentage: 85,
          vote_average: 7.5 
        }),
        factories.mediaItem({ 
          title: 'Another Film', 
          also_liked_percentage: null,
          vote_average: 8.5 
        }),
        factories.mediaItem({ 
          title: 'test movie', // Exact match (case insensitive)
          also_liked_percentage: 70,
          vote_average: 6.0 
        }),
      ]

      mockSearchMedia.mockResolvedValueOnce({
        items: mockDbResults,
        total: 3,
        page: 1,
        totalPages: 1,
      })

      const request = createMockNextRequest({
        url: 'http://localhost:3000/api/search?q=test+movie',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // First should be exact match
      expect(data.results[0].title.toLowerCase()).toBe('test movie')
      // Then by having alsoLikedPercentage
      expect(data.results[1].alsoLikedPercentage).not.toBeNull()
    })

    it('should handle saving failures gracefully', async () => {
      mockSearchMedia.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        totalPages: 0,
      })

      const tmdbMovie = factories.tmdbMovie()
      mockSearchMulti.mockResolvedValueOnce({
        page: 1,
        results: [tmdbMovie],
        total_pages: 1,
        total_results: 1,
      })

      mockGetGenres.mockResolvedValueOnce({ movies: [], tv: [] })
      mockTransformSearchResult.mockReturnValueOnce({
        tmdbId: tmdbMovie.id,
        mediaType: 'MOVIE',
        title: tmdbMovie.title,
      })

      // Mock save failure
      mockCreateOrUpdateMedia.mockRejectedValueOnce(new Error('Save failed'))

      const request = createMockNextRequest({
        url: 'http://localhost:3000/api/search?q=test',
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.results).toHaveLength(1)
      // Should still return the result with temporary ID
      expect(data.results[0].id).toMatch(/^tmdb-/)
    })

    it('should cache genre mappings', async () => {
      // First request
      mockSearchMedia.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        totalPages: 0,
      })

      mockSearchMulti.mockResolvedValue({
        page: 1,
        results: [factories.tmdbMovie()],
        total_pages: 1,
        total_results: 1,
      })

      mockGetGenres.mockResolvedValueOnce({
        movies: [{ id: 28, name: 'Action' }],
        tv: [],
      })

      mockTransformSearchResult.mockReturnValue({
        tmdbId: 1,
        mediaType: 'MOVIE',
        title: 'Test',
        genreIds: [28],
      })

      mockCreateOrUpdateMedia.mockResolvedValue({ id: 'test-1' })

      // First request
      await GET(createMockNextRequest({
        url: 'http://localhost:3000/api/search?q=test1',
      }))

      // Second request
      await GET(createMockNextRequest({
        url: 'http://localhost:3000/api/search?q=test2',
      }))

      // Genres should only be fetched once
      expect(mockGetGenres).toHaveBeenCalledTimes(1)
    })
  })

  describe('OPTIONS /api/search', () => {
    it('should return CORS headers', async () => {
      const response = await OPTIONS()

      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS')
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type')
    })
  })
})