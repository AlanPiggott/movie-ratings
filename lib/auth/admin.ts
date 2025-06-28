import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'

/**
 * Verify admin authentication for protected routes
 */
export async function verifyAdminAuth(request: NextRequest): Promise<boolean> {
  try {
    // Check for admin password in Authorization header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false
    }
    
    const token = authHeader.slice(7) // Remove "Bearer " prefix
    const adminPassword = env.ADMIN_PASSWORD || 'admin123' // Fallback for local dev
    
    // Simple password check - in production, you should use proper auth
    return token === adminPassword
  } catch (error) {
    console.error('Admin auth error:', error)
    return false
  }
}

/**
 * Middleware response for unauthorized requests
 */
export function unauthorizedResponse(message: string = 'Unauthorized') {
  return NextResponse.json(
    { error: message },
    { 
      status: 401,
      headers: {
        'WWW-Authenticate': 'Bearer realm="Admin"'
      }
    }
  )
}