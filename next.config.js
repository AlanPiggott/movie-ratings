/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/vi/**',
      },
    ],
  },
  // Uncomment the following line to disable React StrictMode in development
  // This can help with double-rendering issues but is not recommended for production
  // reactStrictMode: false,
  webpack: (config, { isServer }) => {
    // Suppress the critical dependency warning from @supabase/realtime-js
    config.module = {
      ...config.module,
      exprContextCritical: false,
    }
    return config
  },
}

module.exports = nextConfig