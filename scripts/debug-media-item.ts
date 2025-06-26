import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugMediaItem() {
  const mediaId = '8db70b65-c655-4a7c-a47e-c580e9dabb8b'
  
  console.log('Debugging media item:', mediaId)
  console.log('Supabase URL:', supabaseUrl)
  console.log('---')
  
  // Try to fetch with service role (bypasses RLS)
  const { data, error } = await supabase
    .from('media_items')
    .select('*')
    .eq('id', mediaId)
    .single()
  
  if (error) {
    console.error('Error fetching media item:', error)
  } else {
    console.log('Found media item:')
    console.log('Title:', data.title)
    console.log('Type:', data.media_type)
    console.log('Rating:', data.also_liked_percentage, '%')
    console.log('Created:', data.created_at)
    console.log('Updated:', data.updated_at)
  }
  
  // Check total count in the table
  const { count } = await supabase
    .from('media_items')
    .select('*', { count: 'exact', head: true })
  
  console.log('\nTotal items in media_items table:', count)
  
  // Search by title
  const { data: searchResults } = await supabase
    .from('media_items')
    .select('id, title, also_liked_percentage')
    .ilike('title', '%Devon%')
  
  console.log('\nSearch results for "Devon":', searchResults?.length || 0)
  if (searchResults && searchResults.length > 0) {
    searchResults.forEach(item => {
      console.log(`- ${item.title} (${item.id}) - ${item.also_liked_percentage}%`)
    })
  }
}

debugMediaItem().catch(console.error)