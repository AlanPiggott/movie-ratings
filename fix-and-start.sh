#!/bin/bash

echo "🔧 Movie Score - Diagnostic and Fix Script"
echo "=========================================="

# Check Node version
echo "✓ Checking Node.js version..."
node_version=$(node -v)
echo "  Node.js version: $node_version"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules not found. Installing dependencies..."
    npm install
else
    echo "✓ node_modules found"
fi

# Check environment variables
echo "✓ Checking environment variables..."
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local not found!"
    echo "  Please copy .env.local.example to .env.local and fill in your values"
    exit 1
fi

# Check required env vars
required_vars=("NEXT_PUBLIC_SUPABASE_URL" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "SUPABASE_SERVICE_KEY")
missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^$var=" .env.local; then
        missing_vars+=($var)
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo "⚠️  Missing required environment variables:"
    printf '  - %s\n' "${missing_vars[@]}"
    echo "  Please add these to your .env.local file"
    exit 1
else
    echo "✓ All required environment variables found"
fi

# Clear Next.js cache
echo "✓ Clearing Next.js cache..."
rm -rf .next

# Kill any existing Next.js processes
echo "✓ Checking for existing Next.js processes..."
pkill -f "next dev" || true

# Build the app first to check for errors
echo "✓ Building application to check for errors..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Please fix the errors above."
    exit 1
fi

echo "✅ Build successful!"

# Start the development server
echo "🚀 Starting development server..."
echo "   Open http://localhost:3000 in your browser"
echo ""
echo "If you still have issues:"
echo "1. Open browser DevTools (F12)"
echo "2. Check the Console tab for errors"
echo "3. Check the Network tab to see if API calls are failing"
echo ""

npm run dev