# Speed Optimization for Also-Liked Worker

## Summary
Created `fetch-also-liked-optimized-speed.ts` to dramatically reduce processing time from ~50s to target 15s per movie.

## Key Optimizations Implemented

### 1. Polling Instead of Fixed Wait ✅
- **Before**: Fixed 8-second wait
- **After**: Polls every 1 second to check if task is ready
- **Benefit**: Tasks that complete in 3-4 seconds don't wait unnecessary time

```typescript
// Check every second up to 20 times
for (let i = 0; i < 20; i++) {
  if (await isTaskReady(taskId)) {
    return true; // Ready in i+1 seconds
  }
  await sleep(1000);
}
```

### 2. Faster Retry Delays ✅
- **Before**: [5s, 10s] retry delays
- **After**: [2s, 4s, 8s] retry delays
- **Benefit**: Faster recovery when HTML isn't immediately available

### 3. Reduced Rate Limiting ✅
- **Before**: 3-5 seconds between movies
- **After**: 1-2 seconds between batches
- **Benefit**: Less idle time

### 4. Parallel Processing ✅
- **Before**: Sequential (1 movie at a time)
- **After**: Parallel (3 movies at once)
- **Benefit**: 3x throughput improvement

## Expected Performance

### Before (Reliable Worker)
- Average time per movie: 30-50 seconds
- For 1000 movies: 8-14 hours
- Sequential processing only

### After (Speed-Optimized Worker)
- Average time per movie: 10-20 seconds
- For 1000 movies: 3-6 hours
- 3x parallel processing
- ~60-70% faster overall

## Usage

```bash
# Use the fast worker
npm run worker:also-liked-fast

# Or still use the reliable worker if needed
npm run worker:also-liked

# Test the speed improvements
npx tsx workers/test-speed-optimization.ts
```

## Architecture

```
Queue (1000 movies)
    ↓
┌─────────────────┐
│  Batch of 3     │ ← Process 3 movies simultaneously
├─────────────────┤
│ Movie 1 │ M2 │ M3│
└─────────────────┘
    ↓ (all complete)
Wait 1-2s
    ↓
┌─────────────────┐
│  Next Batch     │
└─────────────────┘
```

## Trade-offs

### Speed-Optimized Worker
- ✅ Much faster (3-6 hours for 1000 movies)
- ✅ Better resource utilization
- ⚠️ Higher API load (3 concurrent requests)
- ⚠️ Slightly more complex error handling

### Reliable Worker
- ✅ Very stable and predictable
- ✅ Lower API load
- ❌ Slower (8-14 hours for 1000 movies)
- ❌ Wastes time on fixed waits

## Recommendations

1. **For initial population**: Use speed-optimized worker
2. **For daily updates**: Either worker is fine (fewer movies)
3. **If hitting rate limits**: Reduce concurrency to 2
4. **For maximum speed**: Increase concurrency to 5 (test first)

## Configuration

Edit these values in the worker to fine-tune:

```typescript
const config = {
  concurrency: 3,              // Movies to process in parallel
  taskStatusCheckInterval: 1000, // How often to check (ms)
  htmlRetryDelays: [2000, 4000, 8000], // Retry delays
  delayBetweenMovies: 1000,    // Min delay between batches
}
```