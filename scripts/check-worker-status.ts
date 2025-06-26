#!/usr/bin/env tsx

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

import { readFileSync, existsSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkStatus() {
  console.log('🔍 Checking Worker Status')
  console.log('========================\n')
  
  // Check queue
  const queueFile = pathJoin(process.cwd(), 'data', 'also-liked-queue.json')
  if (existsSync(queueFile)) {
    const queue = JSON.parse(readFileSync(queueFile, 'utf-8'))
    console.log(`📋 Queue Status: ${queue.length} movies remaining`)
  } else {
    console.log('📋 No queue file found')
  }
  
  // Check database stats
  const { data: stats } = await supabase
    .from('media_items')
    .select('also_liked_percentage')
  
  if (stats) {
    const withPercentage = stats.filter(item => item.also_liked_percentage !== null && item.also_liked_percentage >= 0)
    const attempted = stats.filter(item => item.also_liked_percentage === null)
    
    console.log(`\n📊 Database Stats:`)
    console.log(`   Total movies: ${stats.length}`)
    console.log(`   With % liked data: ${withPercentage.length}`)
    console.log(`   No data available: ${attempted.length}`)
    console.log(`   Not yet processed: ${stats.length - withPercentage.length - attempted.length}`)
  }
  
  // Check recent updates
  const { data: recent } = await supabase
    .from('media_items')
    .select('title, also_liked_percentage, updated_at')
    .not('also_liked_percentage', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(10)
  
  if (recent && recent.length > 0) {
    console.log(`\n🕐 Recently Updated:`)
    recent.forEach(movie => {
      const time = new Date(movie.updated_at).toLocaleTimeString()
      console.log(`   ${time} - ${movie.title}: ${movie.also_liked_percentage}%`)
    })
  }
  
  // Check if worker is likely running
  if (recent && recent.length > 0) {
    const lastUpdate = new Date(recent[0].updated_at)
    const minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 1000 / 60)
    
    if (minutesAgo < 5) {
      console.log(`\n✅ Worker appears to be running (last update ${minutesAgo} minutes ago)`)
    } else {
      console.log(`\n⚠️  Worker may have stopped (last update ${minutesAgo} minutes ago)`)
    }
  }
}

checkStatus().catch(console.error)