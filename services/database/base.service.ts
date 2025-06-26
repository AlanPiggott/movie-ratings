import { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

/**
 * Base service class with common database functionality
 */
export abstract class BaseService {
  protected supabase: SupabaseClient<Database>

  constructor() {
    this.supabase = supabaseAdmin
  }

  /**
   * Handle database errors and throw user-friendly messages
   */
  protected handleError(error: any, context: string): never {
    console.error(`Database error in ${context}:`, error)

    if (error.code === 'P2002') {
      throw new DatabaseError('A record with this unique value already exists', 'UNIQUE_CONSTRAINT')
    }
    
    if (error.code === 'P2025') {
      throw new DatabaseError('Record not found', 'NOT_FOUND')
    }
    
    if (error.code === 'P2003') {
      throw new DatabaseError('Foreign key constraint failed', 'FOREIGN_KEY_CONSTRAINT')
    }
    
    if (error.code === 'P2021') {
      throw new DatabaseError('Table does not exist', 'TABLE_NOT_FOUND')
    }
    
    if (error.code === 'P2024') {
      throw new DatabaseError('Operation timed out', 'TIMEOUT')
    }

    throw new DatabaseError(
      'An unexpected database error occurred',
      'UNKNOWN',
      error.message
    )
  }

  /**
   * Execute a database transaction with retry logic
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
  ): Promise<T> {
    let lastError: any

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error: any) {
        lastError = error
        
        // Don't retry on certain errors
        if (
          error.code === 'P2002' || // Unique constraint
          error.code === 'P2003' || // Foreign key constraint
          error.code === 'P2025'    // Record not found
        ) {
          throw error
        }

        // Wait before retrying
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt))
        }
      }
    }

    throw lastError
  }

  /**
   * Check if database is connected
   */
  async checkConnection(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('media_items')
        .select('id')
        .limit(1)
      return !error
    } catch {
      return false
    }
  }
}

/**
 * Custom database error class
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: string
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}

/**
 * Type definitions for service responses
 */
export interface ServiceResponse<T> {
  success: boolean
  data?: T
  error?: string
  metadata?: Record<string, any>
}

export interface PaginationOptions {
  page?: number
  limit?: number
  orderBy?: string
  order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
  hasMore: boolean
}