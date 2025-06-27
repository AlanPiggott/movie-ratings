#!/usr/bin/env npx tsx

// Script to help set up GitHub Secrets for the rating update workflow
// This reads your .env.local and shows you what secrets to add

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'

// Load environment variables
const envResult = dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })
if (envResult.error) {
  console.error('❌ Error loading .env.local:', envResult.error)
  process.exit(1)
}

// Get repository info from git
import { execSync } from 'child_process'

function getRepoInfo() {
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf8' }).trim()
    
    // Extract owner and repo from various URL formats
    let owner = '', repo = ''
    
    if (remoteUrl.includes('github.com')) {
      const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(\.git)?$/)
      if (match) {
        owner = match[1]
        repo = match[2]
      }
    }
    
    return { owner, repo, url: remoteUrl }
  } catch {
    return { owner: 'YOUR_GITHUB_USERNAME', repo: 'YOUR_REPO_NAME', url: '' }
  }
}

function maskSecret(value: string): string {
  if (!value || value.length < 8) return value
  
  const visibleChars = 4
  const start = value.substring(0, visibleChars)
  const end = value.substring(value.length - visibleChars)
  const masked = '*'.repeat(Math.max(0, value.length - (visibleChars * 2)))
  
  return `${start}${masked}${end}`
}

function main() {
  console.log('🔐 GitHub Secrets Setup Guide')
  console.log('============================\n')
  
  const { owner, repo } = getRepoInfo()
  const secretsUrl = `https://github.com/${owner}/${repo}/settings/secrets/actions/new`
  
  console.log('Repository detected:')
  console.log(`  Owner: ${owner}`)
  console.log(`  Repo: ${repo}`)
  console.log(`  Secrets URL: ${secretsUrl}\n`)
  
  console.log('Required GitHub Secrets for Rating Updates:')
  console.log('==========================================\n')
  
  const secrets = [
    {
      name: 'NEXT_PUBLIC_SUPABASE_URL',
      value: process.env.NEXT_PUBLIC_SUPABASE_URL,
      description: 'Supabase project URL'
    },
    {
      name: 'SUPABASE_SERVICE_KEY',
      value: process.env.SUPABASE_SERVICE_KEY,
      description: 'Supabase service role key (keep this secret!)'
    },
    {
      name: 'DATAFORSEO_LOGIN',
      value: process.env.DATAFORSEO_LOGIN,
      description: 'DataForSEO login email'
    },
    {
      name: 'DATAFORSEO_PASSWORD',
      value: process.env.DATAFORSEO_PASSWORD,
      description: 'DataForSEO password'
    }
  ]
  
  secrets.forEach((secret, index) => {
    console.log(`${index + 1}. ${secret.name}`)
    console.log(`   Description: ${secret.description}`)
    console.log(`   Current value: ${secret.value ? maskSecret(secret.value) : 'NOT SET'}`)
    console.log(`   Full value: ${secret.value || 'NOT SET'}\n`)
  })
  
  console.log('\n📋 Setup Instructions:')
  console.log('=====================\n')
  console.log('1. Go to your repository settings:')
  console.log(`   ${secretsUrl}`)
  console.log('\n2. Add each secret above with the exact name and full value')
  console.log('\n3. Optional: Add repository variables for limits:')
  console.log('   - RATING_UPDATE_DAILY_LIMIT (default: 1000)')
  console.log('   - RATING_UPDATE_BATCH_SIZE (default: 100)')
  
  console.log('\n📊 Current Configuration:')
  console.log('========================')
  console.log(`Daily limit: ${process.env.RATING_UPDATE_DAILY_LIMIT || '1000'} items`)
  console.log(`Batch size: ${process.env.RATING_UPDATE_BATCH_SIZE || '100'} items`)
  console.log(`Estimated daily cost: $${((parseInt(process.env.RATING_UPDATE_DAILY_LIMIT || '1000') * 2 * 0.0006)).toFixed(2)}`)
  
  console.log('\n✅ After adding secrets:')
  console.log('=======================')
  console.log('1. The workflow will run daily at 3 AM UTC')
  console.log('2. You can manually trigger it from Actions tab')
  console.log('3. Monitor costs at: /api/admin/rating-stats')
  
  // Check if secrets are already set in env
  const allSecretsSet = secrets.every(s => s.value)
  if (allSecretsSet) {
    console.log('\n✅ All required values found in .env.local!')
    console.log('   Copy the full values above to GitHub Secrets')
  } else {
    console.log('\n⚠️  Some secrets are missing in .env.local')
    console.log('   Make sure to set them before deploying')
  }
}

main()