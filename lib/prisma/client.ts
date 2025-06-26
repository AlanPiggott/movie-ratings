import { PrismaClient } from '@prisma/client'
import { config } from '@/lib/config'

declare global {
  var prisma: PrismaClient | undefined
}

/**
 * Create Prisma client with connection pooling configuration
 */
function createPrismaClient() {
  return new PrismaClient({
    // Connection pool configuration
    datasources: {
      db: {
        url: config.database.url
      }
    },
    // Log configuration
    log: config.app.isDevelopment
      ? ['query', 'error', 'warn']
      : ['error'],
    // Error formatting
    errorFormat: config.app.isDevelopment ? 'pretty' : 'minimal',
  })
}

// Create singleton instance with connection pooling
export const prisma = globalThis.prisma || createPrismaClient()

// Ensure we don't create multiple instances in development
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma
}

// Connection management utilities
export const db = {
  /**
   * Connect to database (called automatically by Prisma when needed)
   */
  async connect() {
    await prisma.$connect()
  },

  /**
   * Disconnect from database
   */
  async disconnect() {
    await prisma.$disconnect()
  },

  /**
   * Check if database is reachable
   */
  async healthCheck() {
    try {
      await prisma.$queryRaw`SELECT 1`
      return true
    } catch {
      return false
    }
  },

  /**
   * Get connection pool metrics
   * Note: $metrics API is not available in the current Prisma version
   */
  async getMetrics() {
    // TODO: Enable when Prisma metrics are configured
    // const metrics = await prisma.$metrics.json()
    // return metrics
    return { message: 'Metrics not available' }
  }
}

// Graceful shutdown
if (process.env.NODE_ENV === 'production') {
  process.on('SIGINT', async () => {
    await db.disconnect()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await db.disconnect()
    process.exit(0)
  })
}