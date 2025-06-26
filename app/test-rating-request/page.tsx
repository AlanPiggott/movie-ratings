'use client'

import { useState } from 'react'
import AudienceVerdict from '@/components/audience-verdict'
import { AudienceVerdictCompact } from '@/components/audience-verdict'
import RadialGauge from '@/components/radial-gauge'
import { useRatingRequest } from '@/lib/rating-requests'

export default function TestRatingRequestPage() {
  const [testPercentage, setTestPercentage] = useState<number | null>(null)
  
  // Test with a sample media ID (you'll need to get this from your database)
  const testMediaId = 'replace-with-actual-media-id' // Get from Supabase media_items table
  const { requestStatus, percentage: fetchedPercentage, handleRequestRating } = useRatingRequest(
    testMediaId,
    testPercentage !== null && testPercentage > 0
  )
  
  // Display either test percentage or fetched percentage
  const displayPercentage = testPercentage ?? fetchedPercentage

  return (
    <div className="min-h-screen bg-[#0E0F13] pt-20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Test Rating Request System</h1>
        
        <div className="space-y-8">
          {/* Test Controls */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Test Controls</h2>
            <div className="space-y-4">
              <div>
                <label className="text-gray-300 block mb-2">Set Test Percentage:</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setTestPercentage(null)}
                    className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                  >
                    No Data (null)
                  </button>
                  <button 
                    onClick={() => setTestPercentage(0)}
                    className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                  >
                    0%
                  </button>
                  <button 
                    onClick={() => setTestPercentage(75)}
                    className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                  >
                    75%
                  </button>
                  <button 
                    onClick={() => setTestPercentage(90)}
                    className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                  >
                    90%
                  </button>
                </div>
              </div>
              <div>
                <p className="text-gray-400">Current Request Status: <span className="text-white font-mono">{requestStatus}</span></p>
                {fetchedPercentage !== null && (
                  <p className="text-gray-400">Fetched Percentage: <span className="text-white font-mono">{fetchedPercentage}%</span></p>
                )}
              </div>
            </div>
          </div>

          {/* RadialGauge Test */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">RadialGauge Component</h2>
            <div className="flex items-center gap-8">
              <div>
                <p className="text-gray-400 mb-2">Large (Clickable)</p>
                <RadialGauge
                  percentage={displayPercentage}
                  size={120}
                  onClick={handleRequestRating}
                  requestStatus={requestStatus}
                  isClickable={true}
                />
              </div>
              <div>
                <p className="text-gray-400 mb-2">Medium</p>
                <RadialGauge
                  percentage={displayPercentage}
                  size={80}
                  onClick={handleRequestRating}
                  requestStatus={requestStatus}
                  isClickable={true}
                />
              </div>
              <div>
                <p className="text-gray-400 mb-2">Small</p>
                <RadialGauge
                  percentage={displayPercentage}
                  size={50}
                  onClick={handleRequestRating}
                  requestStatus={requestStatus}
                  isClickable={true}
                />
              </div>
            </div>
          </div>

          {/* AudienceVerdict Test */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">AudienceVerdict Component</h2>
            <div className="space-y-6">
              <div>
                <p className="text-gray-400 mb-2">No Box Style</p>
                <AudienceVerdict
                  percentage={displayPercentage}
                  showBox={false}
                  size="large"
                  mediaId={testMediaId}
                  mediaType="MOVIE"
                  onRequestRating={handleRequestRating}
                  requestStatus={requestStatus}
                />
              </div>
              <div>
                <p className="text-gray-400 mb-2">Box Style</p>
                <AudienceVerdict
                  percentage={displayPercentage}
                  showBox={true}
                  size="medium"
                  mediaId={testMediaId}
                  mediaType="MOVIE"
                  onRequestRating={handleRequestRating}
                  requestStatus={requestStatus}
                />
              </div>
            </div>
          </div>

          {/* AudienceVerdictCompact Test */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">AudienceVerdictCompact Component</h2>
            <div className="flex items-center gap-4">
              <AudienceVerdictCompact
                percentage={displayPercentage}
                mediaId={testMediaId}
                onRequestRating={handleRequestRating}
                requestStatus={requestStatus}
              />
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-blue-300 mb-4">How to Test</h2>
            <ol className="space-y-2 text-gray-300">
              <li>1. Click "No Data (null)" to simulate a movie without ratings</li>
              <li>2. Click on any gauge or "Get rating" button to trigger a request</li>
              <li>3. The status should change from "idle" to "pending" to "fetching"</li>
              <li>4. The existing sentiment queue will process the request automatically</li>
              <li>5. Refresh the page to see if the rating was saved</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}