'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'

export function DataSourceShowcase() {
  const sectionRef = useRef<HTMLDivElement>(null)

  // Optional: Add fade-in animation on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('opacity-100', 'translate-y-0')
            entry.target.classList.remove('opacity-0', 'translate-y-4')
          }
        })
      },
      { threshold: 0.1 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section 
      ref={sectionRef}
      className="relative py-12 md:py-16 opacity-0 translate-y-4 transition-all duration-700 ease-out"
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Image Section */}
          <div className="relative group">
            {/* Glow effect container */}
            <div className="absolute -inset-4 bg-gradient-to-r from-white/[0.12] to-white/[0.06] rounded-3xl blur-3xl opacity-75 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Additional glow layer */}
            <div className="absolute -inset-2 bg-white/[0.05] rounded-3xl blur-xl opacity-50 group-hover:opacity-75 transition-opacity duration-500" />
            
            {/* Image container */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/10 transform group-hover:scale-[1.02] transition-transform duration-500">
              <Image
                src="/images/interstellar-google-score.png"
                alt="Google showing 92% liked this film for Interstellar"
                width={600}
                height={400}
                className="w-full h-auto"
                priority
              />
              
              {/* Overlay gradient for better text contrast */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
            </div>
            
            {/* Decorative elements */}
            <div className="absolute -top-4 -right-4 w-32 h-32 bg-white/[0.08] rounded-full blur-3xl" />
            <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-white/[0.06] rounded-full blur-2xl" />
            <div className="absolute top-1/2 -translate-y-1/2 -right-8 w-40 h-40 bg-white/[0.04] rounded-full blur-3xl" />
          </div>

          {/* Text Section */}
          <div className="space-y-6 text-center lg:text-left">
            <div className="space-y-4 text-gray-300 leading-relaxed">
              <p className="text-lg md:text-xl">
                Google&apos;s &apos;% liked&apos; ratings are the most trusted online — but impossible to find. We&apos;ve changed that. Real ratings from millions of users, finally searchable.
              </p>
            </div>
            
            {/* Trust indicators */}
            <div className="flex flex-wrap gap-6 justify-center lg:justify-start text-sm mt-8">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <div className="absolute inset-0 w-2 h-2 bg-green-500 rounded-full animate-ping opacity-75" />
                </div>
                <span className="text-gray-400">Unmanipulated scores</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <div className="absolute inset-0 w-2 h-2 bg-blue-500 rounded-full blur-sm" />
                </div>
                <span className="text-gray-400">Real Google user data</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  <div className="absolute inset-0 w-2 h-2 bg-purple-500 rounded-full blur-sm" />
                </div>
                <span className="text-gray-400">No review bombing</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}