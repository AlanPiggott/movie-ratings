#!/usr/bin/env tsx

// Test script to verify "Miracle in Cell No. 7" can be found

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'

dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

// Clean title function from updated script
function cleanTitle(title: string): string {
  return title
    .replace(/['']/g, '')
    .replace(/[éèêë]/g, 'e')
    .replace(/[áàäâ]/g, 'a')
    .replace(/[ñ]/g, 'n')
    .replace(/[öô]/g, 'o')
    .replace(/[üùû]/g, 'u')
    .replace(/[ç]/g, 'c')
}

async function testMovie() {
  const title = "Miracle in Cell No. 7"
  const year = 2019
  const cleanedTitle = cleanTitle(title)
  
  console.log('Testing queries for:', title)
  console.log('Cleaned title:', cleanedTitle)
  console.log('')
  
  // Build queries like the updated script
  const queries = [
    `${title} ${year} movie`,
    `${title} (${year}) movie`,
    `"${title}" ${year} film`,
    `${title} ${year} film`,
    `${title} movie`
  ]
  
  // Add colon handling if applicable
  if (title.includes(':')) {
    const mainTitle = title.split(':')[0].trim()
    queries.push(`${mainTitle} ${year} movie`)
  }
  
  console.log('Query strategies that will be tried:')
  queries.forEach((q, i) => console.log(`${i + 1}. ${q}`))
  
  console.log('\nThe parentheses format should help find movies like this.')
  console.log('Google often displays: "Miracle in Cell No. 7 (2019)"')
}

testMovie()