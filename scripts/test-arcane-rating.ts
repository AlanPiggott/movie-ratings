#!/usr/bin/env tsx

// Quick test to verify we get the correct 95% for Arcane

// Load environment variables FIRST
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'

const envResult = dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })
if (envResult.error) {
  console.error('❌ Error loading .env.local:', envResult.error)
  process.exit(1)
}

import { dataForSeoService } from '../services/dataforseo'

async function testArcane() {
  console.log('🧪 Testing Arcane rating extraction...')
  console.log('=' .repeat(50))
  
  const queries = [
    'Arcane 2021 tv show',
    'Arcane tv show',
    'Arcane League of Legends tv show',
    '"Arcane" 2021 series'
  ]
  
  for (const query of queries) {
    console.log(`\n🔍 Trying: "${query}"`)
    
    try {
      const result = await dataForSeoService.searchGoogleKnowledge(query)
      
      if (result.percentage !== null) {
        console.log(`✅ Found: ${result.percentage}% liked this`)
        console.log(`💰 Cost: $${result.cost.toFixed(4)}`)
        
        // If we found 95%, we're good!
        if (result.percentage === 95) {
          console.log('\n🎉 SUCCESS! Found the correct 95% rating for Arcane')
          return
        }
      } else {
        console.log('❌ No percentage found')
      }
    } catch (error) {
      console.error('❌ Error:', error)
    }
    
    // Wait between queries
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  
  console.log('\n⚠️  Did not find the expected 95% rating')
}

testArcane().catch(console.error)