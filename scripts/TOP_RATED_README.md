# Top-Rated Content Updater

This script fetches the top 1000 movies and TV shows from TMDB and updates your database with Google's "% liked" ratings.

## Usage

### Test Mode (Recommended First)
To test with only 5 movies and 5 TV shows:
```bash
npm run tsx scripts/test-top-rated.ts
```

### Full Mode
To process all top 1000 movies and TV shows:
```bash
npm run tsx scripts/update-top-rated-content.ts
```

## Features

- **Automatic Resume**: If the script is interrupted, it will resume from where it left off
- **Skip Existing**: Items already in the database are skipped (only rating is updated if missing)
- **Clear Progress**: Shows status for each item processed
- **Error Handling**: Failed items are saved to `data/top-rated-failed.json`
- **Cost Tracking**: Displays estimated DataForSEO costs at the end

## Output Format

```
[12:34:56] 🎬 Processing 1/10: "The Shawshank Redemption" (1994)
[12:34:56] ✅ Already in database, skipping
[12:34:57] 🎬 Processing 2/10: "The Godfather" (1972)
[12:34:57] 🔍 Checking rating for "The Godfather 1972 movie"
[12:34:59] ✅ Success: 97% liked this movie
```

## Files Created

- `data/top-rated-queue.json` - Current processing queue
- `data/top-rated-failed.json` - Items that failed to process
- `data/top-rated-progress.json` - Statistics tracking

## Rate Limiting

- TMDB API: 250ms between requests
- DataForSEO: 2 seconds between requests

## Estimated Time

- Test mode: ~2 minutes (10 items)
- Full mode: ~66 minutes (2000 items at 2s each)

## Cost

- DataForSEO charges $0.003 per search
- Full run (2000 items): ~$6.00
- Test run (10 items): ~$0.03