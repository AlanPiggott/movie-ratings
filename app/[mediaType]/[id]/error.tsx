'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-white mb-4">Something went wrong!</h1>
        <p className="text-gray-400 mb-8">
          We encountered an error while loading this page. Please try again.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-6 py-3 rounded-full transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="bg-transparent border border-gray-600 hover:bg-gray-800 text-gray-300 hover:text-white font-medium px-6 py-3 rounded-full transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}