'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestPage() {
  const [genres, setGenres] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchGenres() {
      try {
        const { data, error } = await supabase
          .from('genres')
          .select('*')
          .order('name')

        if (error) throw error
        setGenres(data || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchGenres()
  }, [])

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Supabase Connection Test</h1>
      
      {loading && <p>Loading...</p>}
      
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded">
          Error: {error}
        </div>
      )}
      
      {!loading && !error && (
        <div>
          <p className="text-green-500 mb-4">✅ Successfully connected to Supabase!</p>
          
          <h2 className="text-xl font-semibold mb-4">Available Genres ({genres.length}):</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {genres.map((genre) => (
              <div key={genre.id} className="bg-secondary p-2 rounded">
                {genre.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}