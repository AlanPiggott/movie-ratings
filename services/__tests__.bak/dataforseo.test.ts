import { jest } from '@jest/globals'
import { DataForSEOService } from '../dataforseo'
import { factories } from '@/tests/utils/factories'
import { mockFetch } from '@/tests/utils/test-helpers'
import * as googleParser from '@/lib/parsers/google-knowledge-panel'

// Mock the prisma client
jest.mock('@/lib/prisma/client', () => ({
  prisma: {
    apiFetchLog: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { cost: 0 } }),
    },
  },
}))

// Mock the parser module
jest.mock('@/lib/parsers/google-knowledge-panel', () => ({
  parseGoogleKnowledgePanel: jest.fn(),
  hasKnowledgePanel: jest.fn(),
  findAllPercentages: jest.fn(),
}))

describe('DataForSEOService', () => {
  let dataForSeoService: DataForSEOService
  let mockFetchInstance: jest.Mock
  const mockParseGoogleKnowledgePanel = googleParser.parseGoogleKnowledgePanel as jest.Mock
  const mockHasKnowledgePanel = googleParser.hasKnowledgePanel as jest.Mock

  beforeEach(() => {
    dataForSeoService = new DataForSEOService()
    factories.reset()
    jest.clearAllMocks()
    
    // Default mock implementations
    mockParseGoogleKnowledgePanel.mockReturnValue({ percentage: null })
    mockHasKnowledgePanel.mockReturnValue(false)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('searchGoogleKnowledge', () => {
    it('should successfully extract percentage from knowledge panel', async () => {
      const mockResponse = factories.dataForSeoTask({
        result: [{
          items: [{
            type: 'knowledge_graph',
            extended_snippet: '<div>85% liked this movie</div>',
          }],
        }],
      })

      mockFetchInstance = mockFetch([{
        url: /dataforseo\.com/,
        response: { data: mockResponse }
      }])

      mockHasKnowledgePanel.mockReturnValue(true)
      mockParseGoogleKnowledgePanel.mockReturnValue({ percentage: 85 })

      const result = await dataForSeoService.searchGoogleKnowledge('test movie')

      expect(result).toEqual({
        percentage: 85,
        cost: 0.0025,
        responseTime: expect.any(Number),
        rawHtml: '<div>85% liked this movie</div>',
      })
      expect(mockFetchInstance).toHaveBeenCalledTimes(1)
      expect(mockParseGoogleKnowledgePanel).toHaveBeenCalledWith('<div>85% liked this movie</div>')
    })

    it('should handle missing knowledge panel', async () => {
      const mockResponse = factories.dataForSeoTask({
        result: [{
          items: [{
            type: 'organic',
            description: 'Regular search result',
          }],
        }],
      })

      mockFetchInstance = mockFetch([{
        url: /dataforseo\.com/,
        response: { data: mockResponse }
      }])

      mockHasKnowledgePanel.mockReturnValue(false)

      const result = await dataForSeoService.searchGoogleKnowledge('unknown movie')

      expect(result).toEqual({
        percentage: null,
        cost: 0.0025,
        responseTime: expect.any(Number),
        rawHtml: undefined,
      })
    })

    it('should extract percentage from full HTML when not in structured data', async () => {
      const mockResponse = factories.dataForSeoTask({
        result: [{
          items: [],
          data: {
            html: '<html><div class="kp-panel">90% liked this film</div></html>',
          },
        }],
      })

      mockFetchInstance = mockFetch([{
        url: /dataforseo\.com/,
        response: { data: mockResponse }
      }])

      mockHasKnowledgePanel
        .mockReturnValueOnce(false) // First check on structured data
        .mockReturnValueOnce(true)  // Second check on full HTML

      mockParseGoogleKnowledgePanel.mockReturnValue({ percentage: 90 })

      const result = await dataForSeoService.searchGoogleKnowledge('test movie')

      expect(result.percentage).toBe(90)
      expect(result.rawHtml).toContain('kp-panel')
    })

    it('should retry on failure and eventually succeed', async () => {
      mockFetchInstance = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => factories.dataForSeoTask({
            result: [{
              items: [{
                type: 'knowledge_graph',
                extended_snippet: '<div>75% liked this movie</div>',
              }],
            }],
          }),
        })

      global.fetch = mockFetchInstance as any

      mockHasKnowledgePanel.mockReturnValue(true)
      mockParseGoogleKnowledgePanel.mockReturnValue({ percentage: 75 })

      const result = await dataForSeoService.searchGoogleKnowledge('test movie')

      expect(result.percentage).toBe(75)
      expect(mockFetchInstance).toHaveBeenCalledTimes(3)
    })

    it('should return error after all retries fail', async () => {
      mockFetchInstance = jest.fn()
        .mockRejectedValue(new Error('Persistent network error'))

      global.fetch = mockFetchInstance as any

      const result = await dataForSeoService.searchGoogleKnowledge('test movie')

      expect(result).toEqual({
        percentage: null,
        cost: 0.0018, // 3 failed attempts * 0.0006
        responseTime: expect.any(Number),
        error: 'Persistent network error',
      })
      expect(mockFetchInstance).toHaveBeenCalledTimes(3)
    })

    it('should handle API error response', async () => {
      mockFetchInstance = mockFetch([{
        url: /dataforseo\.com/,
        response: {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        }
      }])

      const result = await dataForSeoService.searchGoogleKnowledge('test movie')

      expect(result.percentage).toBeNull()
      expect(result.error).toContain('Unauthorized')
    })

    it('should handle non-20000 status code in response', async () => {
      const mockResponse = {
        version: '0.1.20240101',
        status_code: 40501,
        status_message: 'Invalid API key',
        time: '0.1234',
        cost: 0,
        tasks_count: 0,
        tasks_error: 1,
      }

      mockFetchInstance = mockFetch([{
        url: /dataforseo\.com/,
        response: { data: mockResponse }
      }])

      const result = await dataForSeoService.searchGoogleKnowledge('test movie')

      expect(result.percentage).toBeNull()
      expect(result.error).toContain('Invalid API key')
    })

    it('should construct request with correct parameters', async () => {
      const mockResponse = factories.dataForSeoTask()
      mockFetchInstance = mockFetch([{
        url: /dataforseo\.com/,
        response: { data: mockResponse }
      }])

      await dataForSeoService.searchGoogleKnowledge('Fight Club movie')

      const [url, options] = mockFetchInstance.mock.calls[0]
      const body = JSON.parse(options.body)

      expect(url).toContain('/serp/google/organic/live/regular')
      expect(options.method).toBe('POST')
      expect(options.headers.Authorization).toMatch(/^Basic /)
      expect(body[0]).toEqual({
        language_code: 'en',
        location_code: 2840,
        keyword: 'Fight Club movie',
        calculate_rectangles: false,
        load_html: true,
        device: 'desktop',
        os: 'windows',
      })
    })
  })

  describe('getTotalCosts', () => {
    it('should calculate total costs from logs', async () => {
      const { prisma } = require('@/lib/prisma/client')
      prisma.apiFetchLog.aggregate.mockResolvedValueOnce({
        _sum: { cost: 1.25 }
      })

      const since = new Date('2024-01-01')
      const totalCosts = await dataForSeoService.getTotalCosts(since)

      expect(totalCosts).toBe(1.25)
      expect(prisma.apiFetchLog.aggregate).toHaveBeenCalledWith({
        where: {
          endpoint: { contains: 'dataforseo.com' },
          createdAt: { gte: since },
        },
        _sum: { cost: true },
      })
    })

    it('should return 0 when no costs found', async () => {
      const { prisma } = require('@/lib/prisma/client')
      prisma.apiFetchLog.aggregate.mockResolvedValueOnce({
        _sum: { cost: null }
      })

      const totalCosts = await dataForSeoService.getTotalCosts(new Date())

      expect(totalCosts).toBe(0)
    })
  })

  describe('getUsageStats', () => {
    it('should calculate usage statistics correctly', async () => {
      const mockLogs = [
        factories.apiFetchLog({ statusCode: 200, responseTime: 100, cost: 0.001 }),
        factories.apiFetchLog({ statusCode: 200, responseTime: 150, cost: 0.001 }),
        factories.apiFetchLog({ statusCode: 500, responseTime: 200, cost: 0.0006 }),
      ]

      const { prisma } = require('@/lib/prisma/client')
      prisma.apiFetchLog.findMany.mockResolvedValueOnce(mockLogs)

      const since = new Date('2024-01-01')
      const stats = await dataForSeoService.getUsageStats(since)

      expect(stats).toEqual({
        totalCalls: 3,
        successfulCalls: 2,
        failedCalls: 1,
        totalCost: 0.0026,
        avgResponseTime: 150,
        successRate: 66.66666666666666,
      })
    })

    it('should handle empty logs', async () => {
      const { prisma } = require('@/lib/prisma/client')
      prisma.apiFetchLog.findMany.mockResolvedValueOnce([])

      const stats = await dataForSeoService.getUsageStats(new Date())

      expect(stats).toEqual({
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalCost: 0,
        avgResponseTime: NaN,
        successRate: NaN,
      })
    })

    it('should filter logs by date and endpoint', async () => {
      const { prisma } = require('@/lib/prisma/client')
      prisma.apiFetchLog.findMany.mockResolvedValueOnce([])

      const since = new Date('2024-01-01')
      await dataForSeoService.getUsageStats(since)

      expect(prisma.apiFetchLog.findMany).toHaveBeenCalledWith({
        where: {
          endpoint: { contains: 'dataforseo.com' },
          createdAt: { gte: since },
        },
        orderBy: { createdAt: 'desc' },
      })
    })
  })

  describe('Private methods behavior', () => {
    it('should implement exponential backoff for retries', async () => {
      let callTimes: number[] = []
      mockFetchInstance = jest.fn().mockImplementation(() => {
        callTimes.push(Date.now())
        return Promise.reject(new Error('Network error'))
      })

      global.fetch = mockFetchInstance as any

      await dataForSeoService.searchGoogleKnowledge('test')

      expect(callTimes).toHaveLength(3)
      
      // Check delays between calls (should be roughly 1s, 2s)
      const firstDelay = callTimes[1] - callTimes[0]
      const secondDelay = callTimes[2] - callTimes[1]
      
      expect(firstDelay).toBeGreaterThanOrEqual(900) // Allow some margin
      expect(firstDelay).toBeLessThan(1200)
      expect(secondDelay).toBeGreaterThanOrEqual(1900)
      expect(secondDelay).toBeLessThan(2200)
    })

    it('should log API calls with correct metadata', async () => {
      const { prisma } = require('@/lib/prisma/client')
      const mockResponse = factories.dataForSeoTask()
      
      mockFetchInstance = mockFetch([{
        url: /dataforseo\.com/,
        response: { data: mockResponse }
      }])

      await dataForSeoService.searchGoogleKnowledge('test query')

      expect(prisma.apiFetchLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          endpoint: expect.stringContaining('dataforseo.com'),
          method: 'POST',
          statusCode: 200,
          responseTime: expect.any(Number),
          cost: 0.0025,
          metadata: expect.objectContaining({
            query: 'test query',
            percentage: null,
            attempt: 1,
          }),
        }),
      })
    })
  })
})