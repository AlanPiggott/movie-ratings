import type { Metadata } from 'next'
import { Inter, Inter_Tight, DM_Mono, Playfair_Display } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'
import { Navbar } from '@/components/navbar'
import GoogleAnalytics from '@/components/google-analytics'
import { Analytics } from '@vercel/analytics/next'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter'
})

const interTight = Inter_Tight({ 
  subsets: ['latin'],
  variable: '--font-inter-tight'
})

const dmMono = DM_Mono({ 
  weight: ['300', '400', '500'],
  subsets: ['latin'],
  variable: '--font-dm-mono'
})

const playfairDisplay = Playfair_Display({ 
  weight: ['400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-playfair'
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'TrueReviews.tv - Real Audience Scores for Movies & TV Shows',
  description: 'Discover what viewers really think. Find movies and TV shows based on authentic Google audience sentiment scores. No login required.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={cn(
        inter.variable,
        interTight.variable,
        dmMono.variable,
        playfairDisplay.variable,
        "min-h-screen bg-[#0E0F13] font-sans antialiased"
      )}>
        <GoogleAnalytics />
        <Navbar />
        {children}
        <Analytics />
      </body>
    </html>
  )
}