import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { join } from 'path'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  try {
    console.log('Running TV genres migration...')
    
    const migrationPath = join(__dirname, '../supabase/migrations/004_add_tv_genres.sql')
    const migrationSql = readFileSync(migrationPath, 'utf-8')
    
    const { error } = await supabase.rpc('exec_sql', { query: migrationSql })
    
    if (error) {
      console.error('Migration error:', error)
      
      // If exec_sql doesn't exist, try running the SQL directly
      console.log('Trying alternative approach...')
      
      // Run the insert manually
      const tvGenres = [
        { tmdb_id: 10759, name: 'Action & Adventure' },
        { tmdb_id: 10762, name: 'Kids' },
        { tmdb_id: 10763, name: 'News' },
        { tmdb_id: 10764, name: 'Reality' },
        { tmdb_id: 10765, name: 'Sci-Fi & Fantasy' },
        { tmdb_id: 10766, name: 'Soap' },
        { tmdb_id: 10767, name: 'Talk' },
        { tmdb_id: 10768, name: 'War & Politics' }
      ]
      
      for (const genre of tvGenres) {
        const { error: insertError } = await supabase
          .from('genres')
          .upsert(genre, { onConflict: 'tmdb_id' })
        
        if (insertError) {
          console.error(`Error inserting genre ${genre.name}:`, insertError)
        } else {
          console.log(`Added/Updated genre: ${genre.name}`)
        }
      }
    } else {
      console.log('Migration completed successfully!')
    }
    
    // Verify the genres were added
    const { data: genres, error: fetchError } = await supabase
      .from('genres')
      .select('name')
      .order('name')
    
    if (fetchError) {
      console.error('Error fetching genres:', fetchError)
    } else {
      console.log('\nCurrent genres in database:')
      genres?.forEach(g => console.log(`- ${g.name}`))
    }
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

runMigration()