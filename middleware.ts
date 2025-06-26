import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple admin password check
// In production, use proper authentication like Supabase Auth
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

export function middleware(request: NextRequest) {
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
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*']
}