# Troubleshooting Guide

## Common Issues and Solutions

### Nothing is clickable / Pages load endlessly

This usually means JavaScript isn't executing properly. Here's how to fix it:

1. **Run the diagnostic script:**
   ```bash
   ./fix-and-start.sh
   ```

2. **Check browser console for errors:**
   - Open Developer Tools (F12)
   - Go to Console tab
   - Look for red error messages
   - Common errors:
     - "Failed to fetch" - API connection issues
     - "Hydration failed" - Server/client mismatch
     - "Cannot read property of undefined" - Data structure issues

3. **Verify environment variables:**
   - Make sure `.env.local` exists
   - Check all required variables are set:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
     SUPABASE_SERVICE_KEY=your-service-key
     NEXT_PUBLIC_APP_URL=http://localhost:3000
     ```

4. **Test APIs directly:**
   ```bash
   node test-apis.js
   ```

### Genre pages not loading

1. Check if the genre exists in your database
2. Verify the URL format: `/movie/comedy` or `/tv/drama`
3. Check browser Network tab for failed API calls

### Build Errors

1. **TypeScript errors:**
   ```bash
   npm run build
   ```
   Fix any TypeScript errors shown

2. **Missing dependencies:**
   ```bash
   npm install
   ```

3. **Clear cache:**
   ```bash
   rm -rf .next
   rm -rf node_modules
   npm install
   ```

### Supabase Connection Issues

1. **Test Supabase connection:**
   - Go to your Supabase dashboard
   - Check if the project is active
   - Verify API keys match

2. **Check CORS settings:**
   - In Supabase dashboard, go to Settings > API
   - Ensure localhost:3000 is allowed

### Development Server Issues

1. **Port already in use:**
   ```bash
   # Kill process on port 3000
   lsof -ti:3000 | xargs kill -9
   ```

2. **Clear all caches:**
   ```bash
   npm run clean
   npm install
   npm run dev
   ```

## Quick Fixes

### Reset everything:
```bash
# Stop server
# Then run:
rm -rf .next node_modules
npm install
npm run dev
```

### Test basic functionality:
1. Go to http://localhost:3000/test-minimal
2. Try clicking the links
3. If these work, the issue is with data fetching

### Check if APIs work:
```bash
# With server running, in another terminal:
curl http://localhost:3000/api/homepage
```

## Still Having Issues?

1. Check the GitHub issues: https://github.com/anthropics/claude-code/issues
2. Make sure you're using Node.js 18+ 
3. Try a different browser
4. Disable browser extensions (especially ad blockers)
5. Check if you're behind a proxy or VPN