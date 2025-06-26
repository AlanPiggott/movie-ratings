#!/usr/bin/env tsx

// Simple script to create a retry queue from failed movies

import { readFileSync, writeFileSync } from 'fs'
import { join as pathJoin } from 'path'

// Load failed movies
const FAILED_FILE = pathJoin(process.cwd(), 'data', 'failed-movies.json')
const failedMovies = JSON.parse(readFileSync(FAILED_FILE, 'utf-8'))

// Extract just the movie info for the queue
const retryQueue = Object.values(failedMovies).map((failed: any) => ({
  tmdbId: failed.movie.tmdbId,
  title: failed.movie.title,
  original_title: failed.movie.original_title,
  year: failed.movie.year,
  mediaType: failed.movie.mediaType
}))

// Save as new queue
const QUEUE_FILE = pathJoin(process.cwd(), 'data', 'also-liked-queue.json')
writeFileSync(QUEUE_FILE, JSON.stringify(retryQueue, null, 2))

console.log('✅ Created retry queue with', retryQueue.length, 'movies')
console.log('📁 Saved to:', QUEUE_FILE)
console.log('\nThese movies failed because they are not in your database.')
console.log('\nNext steps:')
console.log('1. First run: npm run seed:popular')
console.log('   (This will add movies to your database)')
console.log('2. Then run: npm run worker:also-liked-fast')
console.log('   (This will update them with % liked data)')