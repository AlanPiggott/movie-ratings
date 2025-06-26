#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Load .env.local
const envPath = path.join(__dirname, '../.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const envVars = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('='))
    .filter(([key]) => key)
    .map(([key, value]) => [key.trim(), value?.trim()?.replace(/^['"']|['"']$/g, '') || ''])
)

const supabase = createClient(
  envVars.NEXT_PUBLIC_SUPABASE_URL!,
  envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function listGenres() {
  const { data: genres, error } = await supabase
    .from('genres')
    .select('*')
    .order('name')

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('All genres in database:\n')
  genres?.forEach(genre => {
    const slug = genre.name.toLowerCase().replace(/\s+/g, '-')
    console.log(`${genre.name} (ID: ${genre.tmdb_id})`)
    console.log(`  Movie URL: /genre/movie/${slug}`)
    console.log(`  TV URL: /genre/tv/${slug}`)
    console.log('')
  })
  
  console.log(`Total: ${genres?.length || 0} genres`)
}

listGenres()