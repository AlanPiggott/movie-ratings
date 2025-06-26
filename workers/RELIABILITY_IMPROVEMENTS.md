# Also-Liked Worker Reliability Improvements

## Summary
Created `fetch-also-liked-reliable.ts` to fix the intermittent data extraction issues where movies that DO have Google % liked data were failing to extract ~15% of the time.

## Key Improvements Implemented

### 1. Task Status Polling ✅
- **Before**: Fixed 8-second wait (sometimes insufficient)
- **After**: Polls task status every 2-8 seconds until complete
- **Benefit**: Ensures task is actually ready before fetching HTML

```typescript
async function waitForTask(taskId: string): Promise<boolean> {
  // Polls up to 30 times with progressive backoff
  // 2s, 4s, 6s, then 8s intervals
}
```

### 2. HTML Retry Logic ✅
- **Before**: Single attempt to fetch HTML
- **After**: Up to 3 attempts with exponential backoff
- **Benefit**: Handles temporary API glitches

```typescript
async function getTaskHtmlWithRetry(taskId: string): Promise<any | null> {
  // Retries with 5s, 10s, 15s delays
}
```

### 3. Sequential Processing ✅
- **Before**: Could process in parallel
- **After**: Strict sequential with 3-5s delays between movies
- **Benefit**: Avoids rate limiting and race conditions

### 4. Enhanced Query Strategies ✅
- **Before**: Single query attempt
- **After**: Multiple query formats tried in sequence
- **Benefit**: Handles title variations and ambiguity

```typescript
// Tries these patterns:
1. "The Matrix 1999 movie"
2. "\"The Matrix\" 1999 film" 
3. "The Matrix (1999) movie"
4. Original title if different
```

### 5. Comprehensive Error Logging ✅
- **Before**: Basic console logs
- **After**: Detailed failure tracking in `/data/failed-movies.json`
- **Benefit**: Can diagnose specific failure patterns

```json
{
  "123_MOVIE": {
    "movie": {...},
    "attempts": [{
      "query": "The Matrix 1999 movie",
      "taskId": "abc123",
      "htmlSize": 0,
      "error": "empty_html",
      "timestamp": "2025-01-17T..."
    }],
    "totalAttempts": 3
  }
}
```

### 6. Graceful Degradation ✅
- **Before**: Failed movies left in limbo
- **After**: Marks as `also_liked_percentage: -1` (attempted but failed)
- **Benefit**: Can differentiate between "no data exists" vs "extraction failed"

### 7. Configuration Options ✅
```typescript
const config = {
  maxTaskWaitTime: 60000,      // 60s max wait
  htmlRetryAttempts: 3,        // 3 HTML fetch attempts
  delayBetweenMovies: 3000,    // Min 3s between movies
  maxQueryAttempts: 4,         // 4 different query formats
  sequential: true,            // Force sequential
  taskStatusCheckInterval: 2000,
  maxTaskStatusChecks: 30
}
```

## Expected Results
- **Success rate**: Should increase from ~85% to 95-98%
- **Processing time**: Slower but more reliable (3-5s per movie minimum)
- **Cost**: Slightly higher due to retries (~$0.0024 max per movie)
- **Failed movies**: Will be properly logged and marked in database

## Usage
```bash
# Run the reliable worker
npm run worker:also-liked

# Test specific movies
tsx workers/test-reliable-worker.ts

# Check failed movies
cat data/failed-movies.json | jq
```

## Migration Notes
- The new worker is backward compatible
- Reads from same `also-liked-queue.json`
- Updates same database fields
- Package.json already updated to use new version

## Monitoring
Watch for these in the logs:
- "Task xyz completed" - Good, task ready
- "HTML retrieved: 12345 bytes" - Good, got content
- "HTML empty for task" - Being retried
- "All query strategies failed" - Movie genuinely has no data