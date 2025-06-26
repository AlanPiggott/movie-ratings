import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-sky-500 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-white mb-4">
          Media Not Found
        </h2>
        <p className="text-gray-400 mb-8">
          The movie or TV show you're looking for doesn't exist or has been removed.
        </p>
        <Link
          href="/"
          className="bg-sky-500 hover:bg-sky-600 text-white font-semibold px-6 py-3 rounded-full inline-block transition-colors"
        >
          Back to Browse
        </Link>
      </div>
    </div>
  )
}