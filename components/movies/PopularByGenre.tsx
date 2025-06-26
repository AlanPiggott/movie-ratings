export function PopularByGenre() {
  const genres = ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance']

  return (
    <div className="space-y-8">
      {genres.map((genre) => (
        <div key={genre}>
          <h3 className="mb-4 text-lg font-semibold">{genre}</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {/* Placeholder for movies */}
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] animate-pulse rounded-lg bg-secondary"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}