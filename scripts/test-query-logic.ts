#!/usr/bin/env tsx

// Test the query building logic matches the optimized script

const TEST_CASES = [
  { title: 'Miracle in Cell No. 7', year: 2019, mediaType: 'MOVIE' },
  { title: 'Spider-Man: Into the Spider-Verse', year: 2018, mediaType: 'MOVIE' },
  { title: 'Amélie', year: 2001, mediaType: 'MOVIE' },
  { title: "Pan's Labyrinth", year: 2006, mediaType: 'MOVIE' },
  { title: 'Arcane', year: 2021, mediaType: 'TV_SHOW' }
]

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

function buildQueries(media: typeof TEST_CASES[0]): string[] {
  const queries: string[] = []
  const mediaTypeStr = media.mediaType === 'TV_SHOW' ? 'tv show' : 'movie'
  const cleanedTitle = cleanTitle(media.title)
  const year = media.year
  
  if (media.mediaType === 'TV_SHOW') {
    // TV shows - prioritize "tv show" queries
    if (year) {
      queries.push(`${media.title} ${year} tv show`)
      queries.push(`${media.title} (${year}) tv show`)
      
      // Add clean version if different
      if (cleanedTitle !== media.title) {
        queries.push(`${cleanedTitle} ${year} tv show`)
      }
      
      // For titles with colons, try without subtitle
      if (media.title.includes(':')) {
        const mainTitle = media.title.split(':')[0].trim()
        queries.push(`${mainTitle} ${year} tv show`)
      }
    }
    queries.push(`${media.title} tv show`)
    queries.push(`${media.title} series`)
  } else {
    // Movies - prioritize "movie" queries
    if (year) {
      queries.push(`${media.title} ${year} movie`)
      queries.push(`${media.title} (${year}) movie`)
      queries.push(`"${media.title}" ${year} film`)
      
      // Add clean version if different
      if (cleanedTitle !== media.title) {
        queries.push(`${cleanedTitle} ${year} movie`)
      }
      
      // For titles with colons, try without subtitle
      if (media.title.includes(':')) {
        const mainTitle = media.title.split(':')[0].trim()
        queries.push(`${mainTitle} ${year} movie`)
      }
      
      queries.push(`${media.title} ${year} film`)
    }
    queries.push(`${media.title} movie`)
  }
  
  // Add clean version without year if different
  if (cleanedTitle !== media.title) {
    queries.push(`${cleanedTitle} ${mediaTypeStr}`)
  }
  
  // Remove duplicates
  return [...new Set(queries)]
}

console.log('Query Building Test')
console.log('=' .repeat(60))

for (const testCase of TEST_CASES) {
  console.log(`\n${testCase.title} (${testCase.year}) - ${testCase.mediaType}`)
  console.log('-' .repeat(60))
  
  const queries = buildQueries(testCase)
  queries.forEach((q, i) => {
    console.log(`  ${i + 1}. ${q}`)
  })
  
  if (testCase.title !== cleanTitle(testCase.title)) {
    console.log(`  ℹ️  Clean title: "${cleanTitle(testCase.title)}"`)
  }
}

console.log('\n✅ Key improvements:')
console.log('  • Parentheses format: "Title (Year) movie"')
console.log('  • Quoted format: "Title" Year film')
console.log('  • Character normalization for accents')
console.log('  • Colon handling for subtitles')
console.log('  • Smart quote removal')