import GenrePage from '@/components/genre-page'

interface PageProps {
  params: {
    genre: string
  }
  searchParams?: {
    page?: string
    sort?: string
    scoreMin?: string
    scoreMax?: string
    yearMin?: string
    yearMax?: string
  }
}

export default function TVGenrePage({ params, searchParams }: PageProps) {
  return (
    <GenrePage 
      genreSlug={params.genre} 
      mediaType="tv"
    />
  )
}