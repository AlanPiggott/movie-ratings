import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple admin password check
// In production, use proper authentication like Supabase Auth
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

export function middleware(request: NextRequest) {
  // Create response with security headers
  const response = NextResponse.next()
  
  // Add security headers to all responses
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // Add HSTS for production only
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    )
  }
  
  // Only protect admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Check for auth cookie
    const authCookie = request.cookies.get('adminAuth')
    
    // For API routes, check authorization header
    if (request.nextUrl.pathname.startsWith('/api/admin')) {
      const authHeader = request.headers.get('authorization')
      if (authHeader !== `Bearer ${ADMIN_PASSWORD}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }
    
    // For pages, redirect to login if not authenticated
    if (!authCookie || authCookie.value !== 'true') {
      // Allow access to login endpoint
      if (request.nextUrl.pathname === '/admin/login') {
        return NextResponse.next()
      }
      
      // Redirect to login page
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ]
}