import { supabaseAdmin } from '../lib/supabase'

async function checkAndSeedData() {
  console.log('🔍 Checking database for media items...')
  
  // Check if we have any media items
  const { count, error: countError } = await supabaseAdmin
    .from('media_items')
    .select('*', { count: 'exact', head: true })
  
  if (countError) {
    console.error('❌ Error checking database:', countError)
    return
  }
  
  console.log(`📊 Found ${count || 0} media items in database`)
  
  if (!count || count === 0) {
    console.log('🌱 No data found. Adding sample movies...')
    
    // Add Fight Club as a sample
    const { data, error } = await supabaseAdmin
      .from('media_items')
      .insert([
        {
          tmdb_id: 550,
          media_type: 'MOVIE',
          title: 'Fight Club',
          release_date: '1999-10-15',
          poster_path: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
          backdrop_path: '/hZkgoQYus5vegHoetLkCJzb17zJ.jpg',
          overview: 'A ticking-time-bomb insomniac and a slippery soap salesman channel primal male aggression into a shocking new form of therapy.',
          also_liked_percentage: 88,
          popularity: 61.416,
          vote_average: 8.433,
          vote_count: 26280,
          runtime: 139,
          status: 'Released',
          original_title: 'Fight Club'
        },
        {
          tmdb_id: 155,
          media_type: 'MOVIE',
          title: 'The Dark Knight',
          release_date: '2008-07-14',
          poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
          backdrop_path: '/nMKfUG5A1ByquxiqpqfkQ21NYlp.jpg',
          overview: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.',
          also_liked_percentage: 94,
          popularity: 123.167,
          vote_average: 8.516,
          vote_count: 29750,
          runtime: 152,
          status: 'Released',
          original_title: 'The Dark Knight'
        },
        {
          tmdb_id: 27205,
          media_type: 'MOVIE',
          title: 'Inception',
          release_date: '2010-07-15',
          poster_path: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg',
          backdrop_path: '/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
          overview: 'Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets is offered a chance to regain his old life.',
          also_liked_percentage: 91,
          popularity: 99.754,
          vote_average: 8.367,
          vote_count: 33850,
          runtime: 148,
          status: 'Released',
          original_title: 'Inception'
        },
        {
          tmdb_id: 1396,
          media_type: 'TV_SHOW',
          title: 'Breaking Bad',
          release_date: '2008-01-20',
          poster_path: '/3xnWaLQjelJDDF7LT1WBo6f4BRe.jpg',
          backdrop_path: '/84C7j8NnsoMO0HNaVy3d6QlhXFP.jpg',
          overview: 'When Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given a prognosis of only two years left to live, he becomes filled with a sense of fearlessness.',
          also_liked_percentage: 96,
          popularity: 245.931,
          vote_average: 8.87,
          vote_count: 11693,
          status: 'Ended',
          original_title: 'Breaking Bad'
        }
      ])
      .select()
    
    if (error) {
      console.error('❌ Error adding sample data:', error)
    } else {
      console.log('✅ Added sample data successfully!')
      console.log('📊 Added movies:', data?.map(m => m.title).join(', '))
    }
  } else {
    // List first 5 items
    const { data: items } = await supabaseAdmin
      .from('media_items')
      .select('id, title, media_type, also_liked_percentage')
      .limit(5)
    
    console.log('\n📽️  First 5 items in database:')
    items?.forEach(item => {
      console.log(`   - ${item.title} (${item.media_type}) - ${item.also_liked_percentage || 'No score'}% liked`)
    })
  }
}

checkAndSeedData().catch(console.error)