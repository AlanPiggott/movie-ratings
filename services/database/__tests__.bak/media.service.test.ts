import { jest } from '@jest/globals'
import { MediaService } from '../media.service'
import { createMockSupabaseClient, MockSupabaseClient, resetSupabaseMocks } from '@/tests/utils/supabase-mock'
import { factories } from '@/tests/utils/factories'
import { DatabaseError } from '../base.service'

describe('MediaService', () => {
  let mediaService: MediaService
  let mockSupabase: MockSupabaseClient
  
  beforeEach(() => {
    // Create mock Supabase client with test data
    mockSupabase = createMockSupabaseClient({
      media_items: factories.createMany.mediaItems(5),
      genres: [
        { id: 'genre-1', tmdb_id: 28, name: 'Action' },
        { id: 'genre-2', tmdb_id: 18, name: 'Drama' },
        { id: 'genre-3', tmdb_id: 35, name: 'Comedy' },
      ],
      media_genres: [
        { id: 'mg-1', media_item_id: 'media-1', genre_id: 'genre-1' },
        { id: 'mg-2', media_item_id: 'media-1', genre_id: 'genre-2' },
      ],
    })
    
    // Create service instance with mocked Supabase
    mediaService = new MediaService()
    ;(mediaService as any).supabase = mockSupabase
    
    factories.reset()
  })

  afterEach(() => {
    resetSupabaseMocks(mockSupabase)
  })

  describe('searchMedia', () => {
    it('should search media with text query', async () => {
      const mockData = factories.createMany.mediaItems(3)
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          or: jest.fn().mockReturnValueOnce({
            range: jest.fn().mockResolvedValueOnce({
              data: mockData.map(item => ({
                ...item,
                media_genres: [{ genre: { id: 'genre-1', name: 'Action' } }]
              })),
              error: null,
              count: 3,
            })
          })
        })
      })

      const result = await mediaService.searchMedia('test movie')

      expect(result).toEqual({
        items: expect.arrayContaining([
          expect.objectContaining({
            title: expect.any(String),
            genres: expect.arrayContaining([{ id: 'genre-1', name: 'Action' }]),
          })
        ]),
        total: 3,
        page: 1,
        totalPages: 1,
        hasMore: false,
      })
      
      const orCall = mockSupabase.from.mock.results[0].value.select.mock.results[0].value.or
      expect(orCall).toHaveBeenCalledWith(expect.stringContaining('title.ilike.%test movie%'))
    })

    it('should apply media type filter', async () => {
      const mockMovies = factories.createMany.mediaItems(2, { media_type: 'MOVIE' })
      
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValueOnce({
          data: mockMovies,
          error: null,
          count: 2,
        })
      }
      
      mockSupabase.from.mockReturnValueOnce(mockQueryBuilder)

      const result = await mediaService.searchMedia('', { mediaType: 'MOVIE' })

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('media_type', 'MOVIE')
      expect(result.items).toHaveLength(2)
    })

    it('should apply year range filters', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValueOnce({
          data: [],
          error: null,
          count: 0,
        })
      }
      
      mockSupabase.from.mockReturnValueOnce(mockQueryBuilder)

      await mediaService.searchMedia('', { yearFrom: 2020, yearTo: 2023 })

      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('release_date', '2020-01-01')
      expect(mockQueryBuilder.lte).toHaveBeenCalledWith('release_date', '2023-12-31')
    })

    it('should apply rating filters', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValueOnce({
          data: [],
          error: null,
          count: 0,
        })
      }
      
      mockSupabase.from.mockReturnValueOnce(mockQueryBuilder)

      await mediaService.searchMedia('', { ratingMin: 7.0, ratingMax: 9.0 })

      expect(mockQueryBuilder.gte).toHaveBeenCalledWith('vote_average', 7.0)
      expect(mockQueryBuilder.lte).toHaveBeenCalledWith('vote_average', 9.0)
    })

    it('should filter by hasAlsoLiked', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValueOnce({
          data: [],
          error: null,
          count: 0,
        })
      }
      
      mockSupabase.from.mockReturnValueOnce(mockQueryBuilder)

      await mediaService.searchMedia('', { hasAlsoLiked: true })

      expect(mockQueryBuilder.not).toHaveBeenCalledWith('also_liked_percentage', 'is', null)
    })

    it('should handle sorting options', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValueOnce({
          data: [],
          error: null,
          count: 0,
        })
      }
      
      mockSupabase.from.mockReturnValueOnce(mockQueryBuilder)

      await mediaService.searchMedia('', { sortBy: 'releaseDate', sortOrder: 'asc' })

      expect(mockQueryBuilder.order).toHaveBeenCalledWith('release_date', { ascending: true })
    })

    it('should handle pagination correctly', async () => {
      const mockData = factories.createMany.mediaItems(20)
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockImplementation((start, end) => {
          return Promise.resolve({
            data: mockData.slice(start, end + 1),
            error: null,
            count: 20,
          })
        })
      }
      
      mockSupabase.from.mockReturnValueOnce(mockQueryBuilder)

      const result = await mediaService.searchMedia('', {}, { page: 2, limit: 5 })

      expect(mockQueryBuilder.range).toHaveBeenCalledWith(5, 9)
      expect(result.page).toBe(2)
      expect(result.totalPages).toBe(4)
      expect(result.hasMore).toBe(true)
    })

    it('should handle query errors', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          order: jest.fn().mockReturnValueOnce({
            range: jest.fn().mockResolvedValueOnce({
              data: null,
              error: { message: 'Database error' },
              count: null,
            })
          })
        })
      })

      await expect(mediaService.searchMedia('test')).rejects.toThrow(DatabaseError)
    })
  })

  describe('getMediaById', () => {
    it('should fetch media item with genres', async () => {
      const mockItem = factories.mediaItem({ id: 'test-id' })
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            single: jest.fn().mockResolvedValueOnce({
              data: {
                ...mockItem,
                media_genres: [
                  { genre: { id: 'genre-1', name: 'Action' } },
                  { genre: { id: 'genre-2', name: 'Drama' } }
                ]
              },
              error: null,
            })
          })
        })
      })

      const result = await mediaService.getMediaById('test-id')

      expect(result).toEqual({
        ...mockItem,
        genres: [
          { id: 'genre-1', name: 'Action' },
          { id: 'genre-2', name: 'Drama' }
        ]
      })
    })

    it('should return null for non-existent item', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            single: jest.fn().mockResolvedValueOnce({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            })
          })
        })
      })

      const result = await mediaService.getMediaById('non-existent')

      expect(result).toBeNull()
    })

    it('should handle database errors', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            single: jest.fn().mockResolvedValueOnce({
              data: null,
              error: { code: 'OTHER', message: 'Database error' },
            })
          })
        })
      })

      await expect(mediaService.getMediaById('test-id')).rejects.toThrow(DatabaseError)
    })
  })

  describe('createOrUpdateMedia', () => {
    it('should create new media item with genres', async () => {
      const newMediaData = {
        tmdbId: 12345,
        mediaType: 'MOVIE' as const,
        title: 'New Movie',
        releaseDate: '2024-01-01',
        genres: [
          { tmdbId: 28, name: 'Action' },
          { tmdbId: 18, name: 'Drama' }
        ]
      }

      // Mock checking for existing item
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            single: jest.fn().mockResolvedValueOnce({
              data: null,
              error: { code: 'PGRST116' }
            })
          })
        })
      })

      // Mock insert
      const createdItem = factories.mediaItem({ ...newMediaData, id: 'new-id' })
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            single: jest.fn().mockResolvedValueOnce({
              data: createdItem,
              error: null
            })
          })
        })
      })

      // Mock genre upserts
      mockSupabase.from.mockReturnValueOnce({
        upsert: jest.fn().mockResolvedValueOnce({ error: null })
      })
      mockSupabase.from.mockReturnValueOnce({
        upsert: jest.fn().mockResolvedValueOnce({ error: null })
      })

      // Mock getting genre IDs
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          in: jest.fn().mockResolvedValueOnce({
            data: [
              { id: 'genre-1', tmdb_id: 28 },
              { id: 'genre-2', tmdb_id: 18 }
            ],
            error: null
          })
        })
      })

      // Mock delete existing associations
      mockSupabase.from.mockReturnValueOnce({
        delete: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockResolvedValueOnce({ error: null })
        })
      })

      // Mock insert associations
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValueOnce({ error: null })
      })

      // Mock final fetch with genres
      const getMediaByIdSpy = jest.spyOn(mediaService, 'getMediaById')
        .mockResolvedValueOnce({ ...createdItem, genres: newMediaData.genres })

      const result = await mediaService.createOrUpdateMedia(newMediaData)

      expect(result).toMatchObject({
        title: 'New Movie',
        genres: expect.arrayContaining([
          expect.objectContaining({ name: 'Action' }),
          expect.objectContaining({ name: 'Drama' })
        ])
      })
      expect(getMediaByIdSpy).toHaveBeenCalledWith('new-id')
    })

    it('should update existing media item', async () => {
      const updateData = {
        tmdbId: 12345,
        mediaType: 'MOVIE' as const,
        title: 'Updated Movie',
        alsoLikedPercentage: 85
      }

      // Mock finding existing item
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            single: jest.fn().mockResolvedValueOnce({
              data: { id: 'existing-id' },
              error: null
            })
          })
        })
      })

      // Mock update
      const updatedItem = factories.mediaItem({ ...updateData, id: 'existing-id' })
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            select: jest.fn().mockReturnValueOnce({
              single: jest.fn().mockResolvedValueOnce({
                data: updatedItem,
                error: null
              })
            })
          })
        })
      })

      // Mock final fetch
      jest.spyOn(mediaService, 'getMediaById')
        .mockResolvedValueOnce({ ...updatedItem, genres: [] })

      const result = await mediaService.createOrUpdateMedia(updateData)

      expect(result.title).toBe('Updated Movie')
      expect(result.also_liked_percentage).toBe(85)
    })

    it('should handle date conversion', async () => {
      const dateString = '2024-06-15T12:00:00Z'
      const expectedDate = '2024-06-15'

      // Mock for non-existing item
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            single: jest.fn().mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
          })
        })
      })

      // Capture the insert call
      let insertedData: any
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockImplementation((data) => {
          insertedData = data
          return {
            select: jest.fn().mockReturnValueOnce({
              single: jest.fn().mockResolvedValueOnce({
                data: { id: 'new-id', ...data },
                error: null
              })
            })
          }
        })
      })

      jest.spyOn(mediaService, 'getMediaById').mockResolvedValueOnce({} as any)

      await mediaService.createOrUpdateMedia({
        tmdbId: 123,
        mediaType: 'MOVIE',
        title: 'Test',
        releaseDate: dateString
      })

      expect(insertedData.release_date).toBe(expectedDate)
    })
  })

  describe('incrementSearchCount', () => {
    it('should increment search count and update last searched', async () => {
      // Mock getting current count
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            single: jest.fn().mockResolvedValueOnce({
              data: { search_count: 5 },
              error: null
            })
          })
        })
      })

      // Mock update
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockResolvedValueOnce({
            error: null
          })
        })
      })

      // Mock final fetch
      const updatedItem = factories.mediaItem({ search_count: 6 })
      jest.spyOn(mediaService, 'getMediaById').mockResolvedValueOnce(updatedItem)

      const result = await mediaService.incrementSearchCount('test-id')

      expect(result.search_count).toBe(6)
      expect(mockSupabase.from.mock.calls[1][0]).toBe('media_items')
      const updateCall = mockSupabase.from.mock.results[1].value.update
      expect(updateCall).toHaveBeenCalledWith(expect.objectContaining({
        search_count: 6,
        last_searched: expect.any(String)
      }))
    })

    it('should handle missing item', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            single: jest.fn().mockResolvedValueOnce({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      })

      await expect(mediaService.incrementSearchCount('non-existent'))
        .rejects.toThrow(DatabaseError)
    })
  })

  describe('getPopularMedia', () => {
    it('should get popular media sorted by search count and popularity', async () => {
      const mockData = factories.createMany.mediaItems(5)
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValueOnce({
          data: mockData,
          error: null
        })
      }

      mockSupabase.from.mockReturnValueOnce(mockQueryBuilder)

      const result = await mediaService.getPopularMedia(undefined, 5)

      expect(mockQueryBuilder.order).toHaveBeenCalledWith('search_count', { ascending: false })
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('popularity', { ascending: false })
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(5)
      expect(result).toHaveLength(5)
    })

    it('should filter by media type when specified', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValueOnce({
          data: [],
          error: null
        })
      }

      mockSupabase.from.mockReturnValueOnce(mockQueryBuilder)

      await mediaService.getPopularMedia('MOVIE', 10)

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('media_type', 'MOVIE')
    })
  })

  describe('getMediaMissingAlsoLiked', () => {
    it('should get media without sentiment data that have been searched', async () => {
      const mockData = factories.createMany.mediaItems(3, { 
        also_liked_percentage: null,
        search_count: 10 
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          is: jest.fn().mockReturnValueOnce({
            gt: jest.fn().mockReturnValueOnce({
              order: jest.fn().mockReturnValueOnce({
                order: jest.fn().mockReturnValueOnce({
                  limit: jest.fn().mockResolvedValueOnce({
                    data: mockData,
                    error: null
                  })
                })
              })
            })
          })
        })
      })

      const result = await mediaService.getMediaMissingAlsoLiked(50)

      expect(result).toHaveLength(3)
      expect(result.every(item => item.also_liked_percentage === null)).toBe(true)
    })
  })

  describe('getMediaByGenre', () => {
    it('should get media items by genre name', async () => {
      // Mock getting genre ID
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            single: jest.fn().mockResolvedValueOnce({
              data: { id: 'genre-1' },
              error: null
            })
          })
        })
      })

      // Mock getting media items
      const mockData = factories.createMany.mediaItems(3)
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            order: jest.fn().mockReturnValueOnce({
              order: jest.fn().mockReturnValueOnce({
                limit: jest.fn().mockResolvedValueOnce({
                  data: mockData,
                  error: null
                })
              })
            })
          })
        })
      })

      const result = await mediaService.getMediaByGenre('Action', 20)

      expect(result).toHaveLength(3)
    })

    it('should return empty array if genre not found', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            single: jest.fn().mockResolvedValueOnce({
              data: null,
              error: { message: 'Not found' }
            })
          })
        })
      })

      const result = await mediaService.getMediaByGenre('NonExistentGenre')

      expect(result).toEqual([])
    })
  })

  describe('getTrendingMedia', () => {
    it('should get media items searched recently', async () => {
      const mockData = factories.createMany.mediaItems(5)
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValueOnce({
          data: mockData,
          error: null
        })
      }

      mockSupabase.from.mockReturnValueOnce(mockQueryBuilder)

      const result = await mediaService.getTrendingMedia(24, 5)

      expect(mockQueryBuilder.gte).toHaveBeenCalledWith(
        'last_searched',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      )
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('search_count', { ascending: false })
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('last_searched', { ascending: false })
      expect(result).toHaveLength(5)
    })

    it('should calculate correct time window', async () => {
      let capturedDate: string = ''
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockImplementation((field, date) => {
          capturedDate = date
          return mockQueryBuilder
        }),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValueOnce({
          data: [],
          error: null
        })
      }

      mockSupabase.from.mockReturnValueOnce(mockQueryBuilder)

      const now = new Date()
      await mediaService.getTrendingMedia(48, 10)

      const capturedTime = new Date(capturedDate).getTime()
      const expectedTime = now.getTime() - (48 * 60 * 60 * 1000)
      
      // Allow 1 second tolerance for test execution time
      expect(Math.abs(capturedTime - expectedTime)).toBeLessThan(1000)
    })
  })

  describe('Error handling', () => {
    it('should use retry logic for transient errors', async () => {
      let attempts = 0
      
      // Mock checking for existing - fail twice, then succeed
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockReturnValueOnce({
              single: jest.fn().mockRejectedValueOnce(new Error('Connection timeout'))
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockReturnValueOnce({
              single: jest.fn().mockRejectedValueOnce(new Error('Connection timeout'))
            })
          })
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockReturnValueOnce({
              single: jest.fn().mockImplementation(() => {
                attempts++
                return Promise.resolve({ data: null, error: { code: 'PGRST116' } })
              })
            })
          })
        })

      // Mock successful insert
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            single: jest.fn().mockResolvedValueOnce({
              data: { id: 'new-id' },
              error: null
            })
          })
        })
      })

      jest.spyOn(mediaService, 'getMediaById').mockResolvedValueOnce({} as any)

      await mediaService.createOrUpdateMedia({
        tmdbId: 123,
        mediaType: 'MOVIE',
        title: 'Test'
      })

      expect(attempts).toBe(1) // Should succeed on third attempt
    })

    it('should throw after max retries exceeded', async () => {
      // Mock all attempts to fail
      for (let i = 0; i < 4; i++) {
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockReturnValueOnce({
              single: jest.fn().mockRejectedValueOnce(new Error('Persistent error'))
            })
          })
        })
      }

      await expect(
        mediaService.createOrUpdateMedia({
          tmdbId: 123,
          mediaType: 'MOVIE',
          title: 'Test'
        })
      ).rejects.toThrow('Persistent error')
    })
  })
})