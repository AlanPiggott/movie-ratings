'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Check } from 'lucide-react'

export function TrustComparison() {
  return (
    <section className="py-8 md:py-12">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        {/* Headline */}
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white text-center mb-12 md:mb-16 font-heading">
          Which Would You Trust?
        </h2>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center max-w-5xl mx-auto">
          {/* Left: Interactive Movie Card */}
          <div className="flex justify-center lg:justify-end">
            <Link 
              href="/movie/c241c90e-6056-4fa7-aa74-62a4b6e7b854"
              className="group relative block w-full max-w-[280px] transform transition-all duration-300 hover:scale-105"
            >
              <div className="relative bg-[#1A1B1F] rounded-xl overflow-hidden shadow-xl border border-white/10 hover:border-white/20 transition-colors">
                {/* Poster Image */}
                <div className="relative aspect-[2/3] overflow-hidden">
                  <Image
                    src="https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg"
                    alt="Interstellar"
                    width={280}
                    height={420}
                    className="w-full h-full object-cover"
                    priority
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                </div>

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-white font-semibold text-lg mb-1">Interstellar</h3>
                  <p className="text-gray-400 text-sm">2014</p>
                </div>

                {/* Rating Badge */}
                <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-green-500/50">
                  <span className="text-green-500 font-bold text-lg">92%</span>
                </div>
              </div>
            </Link>
          </div>

          {/* Right: Score Cards */}
          <div className="flex flex-col gap-4 lg:gap-6">
            {/* Real Users Card */}
            <div className="relative">
              <div className="bg-[#1A1B1F] border-2 border-green-500/40 rounded-2xl p-4 md:p-8 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 md:gap-6">
                    <span className="text-4xl md:text-5xl lg:text-6xl font-bold text-green-500" style={{
                      textShadow: '0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3), 0 0 60px rgba(34, 197, 94, 0.1)'
                    }}>92%</span>
                    <span className="text-lg md:text-xl lg:text-2xl text-gray-300 font-medium">Real Users</span>
                  </div>
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* VS Separator */}
            <div className="flex items-center justify-center py-2">
              <span className="text-2xl md:text-3xl font-bold text-white">VS.</span>
            </div>

            {/* Critics Card */}
            <div className="relative">
              <div className="bg-[#1A1B1F] border-2 border-red-500/40 rounded-2xl p-4 md:p-8 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 md:gap-6">
                    <span className="text-4xl md:text-5xl lg:text-6xl font-bold text-red-500" style={{
                      textShadow: '0 0 20px rgba(239, 68, 68, 0.5), 0 0 40px rgba(239, 68, 68, 0.3), 0 0 60px rgba(239, 68, 68, 0.1)'
                    }}>73%</span>
                    <span className="text-lg md:text-xl lg:text-2xl text-gray-300 font-medium">Critics</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}