#!/usr/bin/env tsx

// Debug why all tasks are failing immediately

import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN!
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD!
const authHeader = 'Basic ' + Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64')

async function debugAPI() {
  console.log('🔍 Debugging DataForSEO API Issue')
  console.log('=================================\n')
  
  // Test 1: Check basic connectivity
  console.log('1. Testing API connectivity...')
  try {
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/task_post', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        language_code: 'en',
        location_code: 2840,
        keyword: 'Oppenheimer 2023 movie'
      }])
    })
    
    const data = await response.json()
    console.log('Response status:', response.status)
    console.log('Response data:', JSON.stringify(data, null, 2))
    
    if (data.tasks?.[0]?.id) {
      const taskId = data.tasks[0].id
      console.log('\n2. Task created successfully:', taskId)
      
      // Wait a moment
      console.log('Waiting 2 seconds...')
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Check task status endpoint
      console.log('\n3. Checking task status endpoint...')
      const statusResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/${taskId}`, {
        method: 'GET',
        headers: { 'Authorization': authHeader }
      })
      
      const statusData = await statusResponse.json()
      console.log('Status response:', JSON.stringify(statusData, null, 2))
      
      // Also try the regular endpoint (not just HTML)
      console.log('\n4. Checking regular task_get endpoint...')
      const regularResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/tasks_ready`, {
        method: 'GET',
        headers: { 'Authorization': authHeader }
      })
      
      const regularData = await regularResponse.json()
      console.log('Tasks ready response:', JSON.stringify(regularData, null, 2).substring(0, 500) + '...')
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
  
  // Test the actual working approach we know works
  console.log('\n\n5. Testing the approach that worked before...')
  try {
    // Create task
    const response = await fetch('https://api.dataforseo.com/v3/serp/google/organic/task_post', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        language_code: 'en',
        location_code: 2840,
        keyword: 'Oppenheimer 2023 movie'
      }])
    })
    
    const data = await response.json()
    const taskId = data.tasks?.[0]?.id
    
    if (taskId) {
      console.log('Task created:', taskId)
      
      // Wait 8 seconds like before
      console.log('Waiting 8 seconds...')
      await new Promise(resolve => setTimeout(resolve, 8000))
      
      // Get HTML directly
      const htmlResponse = await fetch(`https://api.dataforseo.com/v3/serp/google/organic/task_get/html/${taskId}`, {
        method: 'GET',
        headers: { 'Authorization': authHeader }
      })
      
      const htmlData = await htmlResponse.json()
      console.log('HTML endpoint status:', htmlData.status_code)
      console.log('Has HTML?', !!htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html)
      
      if (htmlData.tasks?.[0]?.result?.[0]?.items?.[0]?.html) {
        const html = htmlData.tasks[0].result[0].items[0].html
        const match = html.match(/(\d{1,3})%\s*liked\s*this/i)
        console.log('Found percentage?', !!match)
        if (match) {
          console.log('✅ SUCCESS: Found', match[1] + '%')
        }
      }
    }
    
  } catch (error) {
    console.error('Error in working approach:', error)
  }
}

// Run debug
debugAPI().catch(console.error)