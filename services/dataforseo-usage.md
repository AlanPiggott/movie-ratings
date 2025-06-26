# DataForSEO Service Usage Guide

## Overview

The DataForSEO service fetches Google's "% liked" sentiment scores for movies and TV shows by searching Google Knowledge Panels.

## Basic Usage

```typescript
import { dataForSeoService } from '@/services/dataforseo'

// Search for a movie's sentiment
const result = await dataForSeoService.searchGoogleKnowledge('The Dark Knight movie')

if (result.percentage !== null) {
  console.log(`${result.percentage}% of people liked this movie`)
  console.log(`API call cost: $${result.cost}`)
} else {
  console.log('No sentiment data found')
}
```

## API Endpoint Usage

```bash
# Search for sentiment
curl -X POST http://localhost:3000/api/movies/sentiment \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Inception",
    "mediaType": "MOVIE",
    "tmdbId": 27205
  }'

# Get usage statistics
curl http://localhost:3000/api/movies/sentiment?days=30
```

## Response Format

```json
{
  "success": true,
  "data": {
    "title": "Inception",
    "percentage": 88,
    "found": true,
    "cost": 0.0006,
    "responseTime": 1234
  }
}
```

## Features

### 1. **HTML Parsing**
- Extracts percentages from various Google Knowledge Panel formats
- Handles variations: "94% liked this film", "Liked by 88%", etc.
- Cleans HTML and removes noise

### 2. **Retry Logic**
- Automatically retries failed requests (up to 3 times)
- Exponential backoff between retries
- Tracks costs even for failed attempts

### 3. **Cost Tracking**
- Logs every API call with cost information
- Provides usage statistics and total costs
- Default cost: $0.0006 per search

### 4. **Database Integration**
- Updates media items with sentiment scores
- Tracks search history
- Logs all API calls for monitoring

## Supported Patterns

The parser recognizes these patterns:
- `94% liked this film`
- `88% liked this movie`
- `96% liked this TV show`
- `92% of people liked this`
- `Liked by 87%`
- `Google users: 91% liked`
- `Audience score: 89%`
- And many variations...

## Error Handling

The service handles various error scenarios:
- Network failures (with retry)
- API rate limits
- Missing credentials
- No knowledge panel found
- Invalid HTML responses

## Monitoring

Check API usage and costs:

```typescript
// Get total costs for the last 30 days
const thirtyDaysAgo = new Date()
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
const totalCost = await dataForSeoService.getTotalCosts(thirtyDaysAgo)

// Get detailed usage statistics
const stats = await dataForSeoService.getUsageStats(thirtyDaysAgo)
console.log({
  totalCalls: stats.totalCalls,
  successRate: stats.successRate,
  totalCost: stats.totalCost,
  avgResponseTime: stats.avgResponseTime
})
```

## Testing

Run the parser tests:
```bash
npm test services/__tests__/dataforseo.test.ts
```

Test HTML parsing without API calls:
```typescript
import { parseGoogleKnowledgePanel } from '@/lib/parsers/google-knowledge-panel'

const html = '<div>94% liked this movie</div>'
const result = parseGoogleKnowledgePanel(html)
console.log(result.percentage) // 94
```