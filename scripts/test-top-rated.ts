#!/usr/bin/env tsx

// Test version that only processes 5 movies and 5 TV shows

// Load environment variables from .env.local FIRST
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'

// Load .env.local file before any other imports
const result = dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

if (result.error) {
  console.error('❌ Error loading .env.local:', result.error)
  process.exit(1)
}

console.log('🧪 Test Mode: Processing only 5 movies and 5 TV shows')
console.log('=' .repeat(50))

// Temporarily modify process.argv to test with limited items
process.env.TEST_MODE = 'true'
process.env.TEST_PAGES = '1' // Only fetch 1 page (20 items)
process.env.TEST_LIMIT = '5' // Only process first 5 of each type

// Now import and run the main script after env vars are loaded
require('./update-top-rated-content')