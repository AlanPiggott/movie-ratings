import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function cleanupMediaWithoutImages() {
  console.log('Starting cleanup of media items without images...')
  
  try {
    // First, count how many items we'll be deleting
    const { count: totalCount } = await supabase
      .from('media_items')
      .select('*', { count: 'exact', head: true })
      .or('poster_path.is.null,poster_path.eq.')
    
    console.log(`Found ${totalCount} media items without poster images`)
    
    if (totalCount === 0) {
      console.log('No items to clean up!')
      return
    }
    
    // Get all items without images for logging
    const { data: itemsToDelete, error: fetchError } = await supabase
      .from('media_items')
      .select('id, title, media_type, tmdb_id')
      .or('poster_path.is.null,poster_path.eq.')
      .limit(1000)
    
    if (fetchError) {
      console.error('Error fetching items:', fetchError)
      return
    }
    
    console.log('\nItems to be deleted:')
    itemsToDelete?.forEach(item => {
      console.log(`- ${item.title} (${item.media_type}, TMDB: ${item.tmdb_id})`)
    })
    
    // Delete associated genre relationships first
    const mediaIds = itemsToDelete?.map(item => item.id) || []
    
    if (mediaIds.length > 0) {
      console.log('\nDeleting genre associations...')
      const { error: genreError } = await supabase
        .from('media_genres')
        .delete()
        .in('media_item_id', mediaIds)
      
      if (genreError) {
        console.error('Error deleting genre associations:', genreError)
        return
      }
    }
    
    // Now delete the media items
    console.log('Deleting media items...')
    const { error: deleteError } = await supabase
      .from('media_items')
      .delete()
      .or('poster_path.is.null,poster_path.eq.')
    
    if (deleteError) {
      console.error('Error deleting items:', deleteError)
      return
    }
    
    console.log(`\n✅ Successfully deleted ${totalCount} media items without images`)
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

// Run the cleanup
cleanupMediaWithoutImages()
  .then(() => {
    console.log('\nCleanup complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Failed to run cleanup:', error)
    process.exit(1)
  })