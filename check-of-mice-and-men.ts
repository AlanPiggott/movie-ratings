import { createClient } from '@supabase/supabase-js'
import { config as dotenvConfig } from 'dotenv'
import { join as pathJoin } from 'path'
dotenvConfig({ path: pathJoin(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string
)

async function check() {
  const { data, error } = await supabase
    .from('media_items')
    .select('id, title, tmdb_id, release_date, also_liked_percentage')
    .ilike('title', '%Of Mice and Men%')
    .order('release_date', { ascending: true })
  
  console.log('Of Mice and Men entries:')
  data?.forEach(item => {
    const year = item.release_date ? new Date(item.release_date).getFullYear() : 'N/A'
    console.log(`- ${item.title} (${year}) - TMDB: ${item.tmdb_id} - Rating: ${item.also_liked_percentage}%`)
  })
}

check().catch(console.error)