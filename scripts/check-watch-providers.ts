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

async function checkWatchProviders() {
  // Check movies with watch providers
  const { data, error } = await supabase
    .from('media_items')
    .select('id, title, tmdb_id, watch_providers')
    .not('watch_providers', 'is', null)
    .eq('media_type', 'MOVIE')
    .limit(5)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`Found ${data?.length || 0} movies with watch providers:\n`)

  data?.forEach(item => {
    console.log(`Title: ${item.title}`)
    console.log(`ID: ${item.id}`)
    console.log(`TMDB ID: ${item.tmdb_id}`)
    
    if (item.watch_providers) {
      const providers = item.watch_providers as any
      
      if (providers.flatrate?.length > 0) {
        console.log('  Streaming:')
        providers.flatrate.forEach((p: any) => {
          console.log(`    - ${p.provider_name} (ID: ${p.provider_id})${p.link ? ' [Has Link]' : ' [No Link]'}`)
        })
      }
      
      if (providers.rent?.length > 0) {
        console.log('  Rent:')
        providers.rent.forEach((p: any) => {
          console.log(`    - ${p.provider_name} (ID: ${p.provider_id})${p.link ? ' [Has Link]' : ' [No Link]'}`)
        })
      }
      
      if (providers.buy?.length > 0) {
        console.log('  Buy:')
        providers.buy.forEach((p: any) => {
          console.log(`    - ${p.provider_name} (ID: ${p.provider_id})${p.link ? ' [Has Link]' : ' [No Link]'}`)
        })
      }
    }
    
    console.log('\n---\n')
  })
}

checkWatchProviders()