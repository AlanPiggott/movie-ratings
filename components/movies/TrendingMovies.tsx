export function TrendingMovies() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {/* Placeholder for trending movies */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="aspect-[2/3] animate-pulse rounded-lg bg-secondary"
        />
      ))}
    </div>
  )
}