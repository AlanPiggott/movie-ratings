export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="h-[85vh] relative">
        <div className="absolute inset-0 bg-gray-900 animate-pulse" />
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="h-12 bg-gray-800 rounded w-1/3 mb-4 animate-pulse" />
          <div className="h-6 bg-gray-800 rounded w-1/2 animate-pulse" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 md:px-12 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-gray-900/30 rounded-2xl p-6 h-48 animate-pulse" />
          <div className="bg-gray-900/30 rounded-2xl p-6 h-48 animate-pulse" />
          <div className="bg-gray-900/30 rounded-2xl p-6 h-48 animate-pulse" />
        </div>
      </div>
    </div>
  )
}