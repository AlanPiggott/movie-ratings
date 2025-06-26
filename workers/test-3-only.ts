#!/usr/bin/env tsx

// Load environment variables from .env.local
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// Create a test queue with only 3 items
const QUEUE_FILE = join(process.cwd(), 'data', 'also-liked-queue.json')
const TEST_QUEUE_FILE = join(process.cwd(), 'data', 'also-liked-queue-test.json')

// Load full queue
const fullQueue = JSON.parse(readFileSync(QUEUE_FILE, 'utf-8'))

// Save first 3 items to test queue
const testQueue = fullQueue.slice(0, 3)
writeFileSync(TEST_QUEUE_FILE, JSON.stringify(testQueue, null, 2))

// Temporarily rename files
const { execSync } = require('child_process')

console.log('🧪 Setting up test with 3 items...')
console.log('Items to test:')
testQueue.forEach((item: any, i: number) => {
  console.log(`${i + 1}. ${item.title} (${item.year || 'N/A'})`)
})

// Backup original queue and use test queue
execSync(`mv "${QUEUE_FILE}" "${QUEUE_FILE}.backup"`)
execSync(`cp "${TEST_QUEUE_FILE}" "${QUEUE_FILE}"`)

console.log('\n📋 Running worker with test queue...\n')

// Run the worker
try {
  execSync('npm run worker:also-liked', { stdio: 'inherit' })
} catch (error) {
  console.error('Worker failed:', error)
}

// Restore original queue
console.log('\n🔄 Restoring original queue...')
execSync(`mv "${QUEUE_FILE}.backup" "${QUEUE_FILE}"`)
execSync(`rm "${TEST_QUEUE_FILE}"`)

console.log('✅ Test complete!')