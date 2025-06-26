'use client'

import Link from 'next/link'
import { createMediaUrl } from '@/lib/utils'

export default function TestNavigationPage() {
  // Test URLs
  const testCases = [
    { mediaType: 'movie' as const, title: 'Interstellar', id: 'test-movie-123' },
    { mediaType: 'tv' as const, title: 'Breaking Bad', id: 'test-tv-456' },
  ]

  return (
    <div className="min-h-screen bg-[#0E0F13] text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Navigation Test Page</h1>
      
      <div className="space-y-4 max-w-2xl">
        <p className="text-gray-400 mb-6">
          Click on these links to test navigation. Check the browser console for debug logs.
        </p>

        {testCases.map((test) => {
          const href = createMediaUrl(test.mediaType, test.title, test.id)
          return (
            <div key={test.id} className="border border-zinc-800 rounded-lg p-4">
              <h3 className="font-semibold mb-2">{test.title}</h3>
              <p className="text-sm text-gray-400 mb-2">
                Type: {test.mediaType} | ID: {test.id}
              </p>
              <p className="text-sm text-gray-400 mb-3">
                Generated URL: <code className="bg-zinc-800 px-2 py-1 rounded">{href}</code>
              </p>
              <Link 
                href={href}
                className="inline-block bg-[#F5C518] text-black px-4 py-2 rounded hover:bg-[#F5C518]/80 transition-colors"
                onClick={() => {
                  console.log(`Test Navigation: Clicking link to ${href}`)
                }}
              >
                Test Navigation →
              </Link>
            </div>
          )
        })}

        <div className="mt-8 p-4 bg-zinc-900 rounded-lg">
          <h3 className="font-semibold mb-2">Expected Behavior:</h3>
          <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
            <li>Clicking should navigate to /movie/test-movie-123 or /tv/test-tv-456</li>
            <li>You should see console logs when URLs are generated and clicked</li>
            <li>The page should show a "not found" error (since these are test IDs)</li>
            <li>If nothing happens on click, check browser console for errors</li>
          </ul>
        </div>

        <Link 
          href="/"
          className="inline-block mt-4 text-[#F5C518] hover:underline"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  )
}