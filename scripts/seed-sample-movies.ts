import { createClient } from '@supabase/supabase-js'

// Direct connection - replace with your actual values
const SUPABASE_URL = 'https://odydmpdogagroxlrhipb.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_KEY_HERE'

async function seedSampleMovies() {
  if (SUPABASE_SERVICE_KEY === 'YOUR_SERVICE_KEY_HERE') {
    console.error('❌ Please set SUPABASE_SERVICE_KEY environment variable')
    console.error('Run: export SUPABASE_SERVICE_KEY="your-service-key"')
    console.error('Get it from: Supabase Dashboard > Settings > API > service_role')
    return
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  console.log('🌱 Seeding sample movies...')

  const movies = [
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
      backdrop_path: '/nMKdUG5A1ByquxiqpqfkQ21NYlp.jpg',
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
      tmdb_id: 680,
      media_type: 'MOVIE',
      title: 'Pulp Fiction',
      release_date: '1994-10-14',
      poster_path: '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg',
      backdrop_path: '/suaEOtk1N1sgg2MTM7oZd2cfVp3.jpg',
      overview: 'A burger-loving hit man, his philosophical partner, a drug-addled gangster\'s moll and a washed-up boxer converge in this sprawling, comedic crime caper.',
      also_liked_percentage: 92,
      popularity: 72.342,
      vote_average: 8.488,
      vote_count: 25230,
      runtime: 154,
      status: 'Released',
      original_title: 'Pulp Fiction'
    },
    {
      tmdb_id: 13,
      media_type: 'MOVIE',
      title: 'Forrest Gump',
      release_date: '1994-07-06',
      poster_path: '/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg',
      backdrop_path: '/7c9UVPPiTPltouxRVY6N9uugaVA.jpg',
      overview: 'The history of the United States from the 1950s to the \'70s unfolds from the perspective of an Alabama man with an IQ of 75.',
      also_liked_percentage: 95,
      popularity: 55.245,
      vote_average: 8.475,
      vote_count: 24780,
      runtime: 142,
      status: 'Released',
      original_title: 'Forrest Gump'
    },
    {
      tmdb_id: 1396,
      media_type: 'TV_SHOW',
      title: 'Breaking Bad',
      release_date: '2008-01-20',
      poster_path: '/3xnWaLQjelJDDF7LT1WBo6f4BRe.jpg',
      backdrop_path: '/84C7j8NnsoMO0HNaVy3d6QlhXFP.jpg',
      overview: 'When Walter White, a New Mexico chemistry teacher, is diagnosed with Stage III cancer and given a prognosis of only two years left to live.',
      also_liked_percentage: 96,
      popularity: 245.931,
      vote_average: 8.87,
      vote_count: 11693,
      status: 'Ended',
      original_title: 'Breaking Bad'
    },
    {
      tmdb_id: 238,
      media_type: 'MOVIE',
      title: 'The Godfather',
      release_date: '1972-03-24',
      poster_path: '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
      backdrop_path: '/tmU7GeKVybMWFButWEGl2M4GeiP.jpg',
      overview: 'The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.',
      also_liked_percentage: 97,
      popularity: 105.234,
      vote_average: 8.7,
      vote_count: 18200,
      runtime: 175,
      status: 'Released',
      original_title: 'The Godfather'
    }
  ]

  // Insert movies
  const { data, error } = await supabase
    .from('media_items')
    .upsert(movies, { onConflict: 'tmdb_id' })
    .select()

  if (error) {
    console.error('❌ Error seeding movies:', error)
    return
  }

  console.log('✅ Successfully seeded movies:')
  data?.forEach(movie => {
    console.log(`   - ${movie.title} (${movie.also_liked_percentage}% liked)`)
  })

  // Also add genres
  const genres = [
    { name: 'Action' },
    { name: 'Drama' },
    { name: 'Crime' },
    { name: 'Thriller' },
    { name: 'Sci-Fi' }
  ]

  const { error: genreError } = await supabase
    .from('genres')
    .upsert(genres, { onConflict: 'name' })

  if (genreError) {
    console.error('❌ Error adding genres:', genreError)
  } else {
    console.log('✅ Added genres')
  }
}

seedSampleMovies().catch(console.error)