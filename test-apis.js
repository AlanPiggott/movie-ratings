#!/usr/bin/env node

const baseUrl = 'http://localhost:3000';

console.log('🧪 Testing Movie Score APIs...\n');

async function testAPI(name, url) {
  try {
    console.log(`Testing ${name}...`);
    const start = Date.now();
    const response = await fetch(url);
    const time = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${name} - OK (${time}ms)`);
      return data;
    } else {
      console.log(`❌ ${name} - Failed: ${response.status} ${response.statusText}`);
      return null;
    }
  } catch (error) {
    console.log(`❌ ${name} - Error: ${error.message}`);
    return null;
  }
}

async function runTests() {
  // Test homepage API
  const homepage = await testAPI('Homepage API', `${baseUrl}/api/homepage`);
  if (homepage) {
    console.log(`   - Trending: ${homepage.trending?.length || 0} items`);
    console.log(`   - Popular Shows: ${homepage.popularShows?.length || 0} items`);
  }
  
  console.log('');
  
  // Test genre API
  const comedy = await testAPI('Genre API (Comedy)', `${baseUrl}/api/genres/comedy?mediaType=MOVIE`);
  if (comedy) {
    console.log(`   - Total items: ${comedy.total || 0}`);
    console.log(`   - Current page items: ${comedy.items?.length || 0}`);
  }
  
  console.log('');
  
  // Test if we can get a sample media item
  if (homepage?.trending?.[0]) {
    const mediaId = homepage.trending[0].id;
    const media = await testAPI(`Media Details (${mediaId})`, `${baseUrl}/api/media/${mediaId}`);
    if (media) {
      console.log(`   - Title: ${media.title}`);
      console.log(`   - Type: ${media.media_type}`);
    }
  }
  
  console.log('\n✨ API tests complete!');
}

// Check if server is running first
fetch(baseUrl)
  .then(() => {
    console.log('✅ Server is running\n');
    runTests();
  })
  .catch(() => {
    console.log('❌ Server is not running!');
    console.log('   Please start the server with: npm run dev');
  });