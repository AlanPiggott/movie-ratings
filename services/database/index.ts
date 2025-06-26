/**
 * Database service layer exports
 * 
 * This module provides a clean interface for all database operations,
 * keeping business logic separate from API routes.
 */

export { mediaService } from './media.service'
export { DatabaseError } from './base.service'

// Re-export types
export type {
  ServiceResponse,
  PaginationOptions,
  PaginatedResponse
} from './base.service'

export type {
  MediaFilters,
  CreateOrUpdateMediaData
} from './media.service'

/**
 * Database health check
 * @returns true if database is connected
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const { mediaService } = await import('./media.service')
    return await mediaService.checkConnection()
  } catch {
    return false
  }
}

/**
 * Initialize database services
 * This can be used to warm up connections on app start
 */
export async function initializeDatabaseServices(): Promise<void> {
  try {
    // Import services to initialize them
    await import('./media.service')
    
    // Perform a health check
    const isHealthy = await checkDatabaseHealth()
    if (!isHealthy) {
      throw new Error('Database connection failed')
    }
    
    console.log('✅ Database services initialized successfully')
  } catch (error) {
    console.error('❌ Failed to initialize database services:', error)
    throw error
  }
}