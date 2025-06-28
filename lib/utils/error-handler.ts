import { NextResponse } from 'next/server'

/**
 * Create a safe error response that doesn't leak sensitive information
 */
export function createErrorResponse(
  error: unknown,
  fallbackMessage: string = 'An error occurred',
  statusCode: number = 500
) {
  // Log the actual error for debugging (server-side only)
  if (process.env.NODE_ENV === 'development') {
    console.error('API Error:', error)
  }
  
  // In production, return generic error message
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: fallbackMessage },
      { status: statusCode }
    )
  }
  
  // In development, include more details
  const errorMessage = error instanceof Error ? error.message : String(error)
  return NextResponse.json(
    { 
      error: fallbackMessage,
      details: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    },
    { status: statusCode }
  )
}

/**
 * Log errors safely without exposing sensitive information
 */
export function logError(context: string, error: unknown) {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${context}]`, error)
  } else {
    // In production, log minimal information
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[${context}] Error: ${message}`)
  }
}