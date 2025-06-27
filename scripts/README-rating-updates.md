# Automated Rating Update System

This system automatically updates movie and TV show ratings from Google based on intelligent scheduling that considers content age and popularity.

## Overview

The system uses a tiered approach to minimize API costs while keeping ratings fresh:

- **Tier 1** (New releases, <6 months): Updated every 2 weeks
- **Tier 2** (Recent, 6 months-2 years): Updated monthly  
- **Tier 3** (Established, 2-5 years): Updated quarterly
- **Tier 4** (Classic, 5+ years): Updated every 6 months
- **Tier 5** (Never update): Old content with 10k+ votes

## Cost Estimation

For 10,000 items:
- **Monthly cost**: ~$5.70
- **Annual cost**: ~$68.40
- **Per item per year**: ~$0.007

## Setup Instructions

### 1. Apply Database Migration

```bash
# Apply the migration to add tracking columns
npx supabase db push
```

### 2. Configure Environment Variables

Add to your `.env.local`:

```env
# Rating update configuration
RATING_UPDATE_ENABLED=true
RATING_UPDATE_DAILY_LIMIT=1000
RATING_UPDATE_MONTHLY_LIMIT=20000
RATING_UPDATE_BATCH_SIZE=100
```

### 3. Assign Tiers to Existing Content

```bash
# Dry run to see tier distribution
./scripts/assign-rating-tiers.ts --dry-run

# Actually assign tiers
./scripts/assign-rating-tiers.ts
```

### 4. Test the System

```bash
# Run comprehensive tests
./scripts/test-rating-system.ts

# Test a single movie update
./scripts/update-single-rating.ts "The Dark Knight"

# Test scheduled worker with 10 items
TEST_MODE=true ./scripts/update-ratings-scheduled.ts
```

### 5. Deploy Scheduled Updates

#### Option A: GitHub Actions (Recommended)

1. Add secrets to your GitHub repository:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `DATAFORSEO_LOGIN`
   - `DATAFORSEO_PASSWORD`

2. The workflow will run automatically at 3 AM UTC daily

3. Manually trigger a test run:
   ```
   Go to Actions → Update Movie Ratings → Run workflow
   ```

#### Option B: Vercel Cron Functions

Create `/app/api/cron/update-ratings/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    await execAsync('./scripts/update-ratings-scheduled.ts')
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error }, { status: 500 })
  }
}
```

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/update-ratings",
    "schedule": "0 3 * * *"
  }]
}
```

## Monitoring

### Check Update Statistics

```bash
# View recent updates via API
curl http://localhost:3000/api/admin/rating-stats
```

### Database Queries

```sql
-- View today's update log
SELECT * FROM rating_update_logs 
WHERE run_date = CURRENT_DATE;

-- View items due for update
SELECT * FROM get_items_due_for_rating_update(100, false);

-- Check tier distribution
SELECT rating_update_tier, COUNT(*) 
FROM media_items 
WHERE rating_update_tier IS NOT NULL 
GROUP BY rating_update_tier;
```

## Manual Operations

### Update Specific Movies

```bash
# Update a single movie
./scripts/update-single-rating.ts "Inception"
```

### Force Tier Reassignment

```bash
# Reassign all tiers (e.g., after policy change)
./scripts/assign-rating-tiers.ts
```

### Emergency Stop

Set in environment or database:
```env
RATING_UPDATE_ENABLED=false
```

## Troubleshooting

### Common Issues

1. **No items being updated**
   - Check if tiers are assigned: `SELECT COUNT(*) FROM media_items WHERE rating_update_tier IS NOT NULL`
   - Verify migration was applied
   - Check if items are due: `SELECT * FROM get_items_due_for_rating_update(10, false)`

2. **High failure rate**
   - Check DataForSEO API credentials
   - Verify rate limits aren't being hit
   - Check for title formatting issues

3. **Costs higher than expected**
   - Review tier distribution
   - Check for duplicate updates
   - Verify daily limits are working

### Logs

- GitHub Actions: Check workflow run logs
- Database logs: `SELECT * FROM rating_update_logs ORDER BY created_at DESC`
- API errors: Check Supabase logs

## Maintenance

### Monthly Tasks
- Review cost reports
- Check failure rates
- Adjust tier thresholds if needed

### Quarterly Tasks  
- Reassign tiers for aging content
- Review and optimize search queries
- Update never-update criteria

## Cost Control

The system has multiple safeguards:
- Daily update limits
- Monthly update limits  
- Automatic tier assignment
- Never-update tier for stable content

To adjust costs:
1. Change tier thresholds in `assign-rating-tiers.ts`
2. Adjust `RATING_UPDATE_DAILY_LIMIT`
3. Modify update frequencies in the migration