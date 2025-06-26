#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { processWatchProviders } from '../lib/utils/watch-providers'

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
  envVars.SUPABASE_SERVICE_KEY! // Use service key for updates
)

async function updateWatchProviderLinks() {
  console.log('Fetching all media items with watch providers...')
  
  // Get all media with watch providers
  const { data: mediaItems, error } = await supabase
    .from('media_items')
    .select('id, title, tmdb_id, media_type, release_date, watch_providers')
    .not('watch_providers', 'is', null)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching media:', error)
    return
  }

  console.log(`Found ${mediaItems?.length || 0} items with watch providers`)
  
  let updated = 0
  let failed = 0

  for (const item of mediaItems || []) {
    try {
      // Process watch providers to add/update links
      const mediaInfo = {
        title: item.title,
        year: item.release_date ? new Date(item.release_date).getFullYear() : undefined,
        mediaType: item.media_type === 'MOVIE' ? 'movie' as const : 'tv' as const,
        tmdbId: item.tmdb_id
      }
      
      const processedProviders = processWatchProviders(
        item.watch_providers,
        mediaInfo
      )
      
      // Update the database with processed providers
      const { error: updateError } = await supabase
        .from('media_items')
        .update({ 
          watch_providers: processedProviders,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)
      
      if (updateError) {
        console.error(`Failed to update ${item.title}:`, updateError)
        failed++
      } else {
        updated++
        if (updated % 100 === 0) {
          console.log(`Updated ${updated} items...`)
        }
      }
      
    } catch (err) {
      console.error(`Error processing ${item.title}:`, err)
      failed++
    }
  }

  console.log('\n=== Update Complete ===')
  console.log(`Total items: ${mediaItems?.length || 0}`)
  console.log(`Successfully updated: ${updated}`)
  console.log(`Failed: ${failed}`)
}

updateWatchProviderLinks()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
  })