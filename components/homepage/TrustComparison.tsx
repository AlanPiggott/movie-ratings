'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Check } from 'lucide-react'

export function TrustComparison() {
  return (
    <section className="py-8 md:py-12">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        {/* Headline */}
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white text-center mb-4 font-heading">
          Which Would You Trust?
        </h2>
        
        {/* Description */}
        <p className="text-lg md:text-xl text-gray-400 text-center max-w-3xl mx-auto mb-12 md:mb-16 px-4">
          Critics don't buy tickets. Real users do. Search what viewers really scored it.
        </p>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center max-w-5xl mx-auto">
          {/* Left: Image Display */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[420px] transform transition-all duration-300 hover:scale-105">
              <div className="relative rounded-2xl overflow-hidden" style={{
                boxShadow: '0 30px 60px -15px rgba(0, 0, 0, 0.8), 0 0 120px rgba(245, 197, 24, 0.1), 0 15px 40px rgba(0, 0, 0, 0.6)'
              }}>
                {/* Image container */}
                <div className="relative">
                  <Image
                    src="/interstellar.png"
                    alt="Comparison visual"
                    width={420}
                    height={630}
                    className="w-full h-auto"
                    priority
                  />
                  
                  {/* Subtle vignette effect */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/10 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Right: Score Cards */}
          <div className="flex flex-col gap-4 lg:gap-6 w-full max-w-sm mx-auto lg:max-w-none lg:mx-0">
            {/* Real Users Card */}
            <div className="relative transform transition-all duration-300 hover:scale-105">
              <div className="bg-[#1A1B1F] border-2 border-green-500/40 rounded-2xl p-3 md:p-6 shadow-xl transition-all duration-300 hover:border-green-500/60 hover:shadow-2xl" style={{
                boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.6)'
              }}>
                <div className="relative flex items-center justify-center">
                  <div className="flex items-center gap-3 md:gap-6">
                    <span className="text-3xl md:text-4xl lg:text-5xl font-bold text-green-500" style={{
                      textShadow: '0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3), 0 0 60px rgba(34, 197, 94, 0.1)'
                    }}>92%</span>
                    <span className="text-base md:text-lg lg:text-xl text-gray-300 font-medium">Real Users</span>
                  </div>
                  <div className="absolute right-0 w-8 h-8 md:w-10 md:h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
                  </div>
                </div>
              </div>
            </div>

            {/* VS Separator */}
            <div className="flex items-center justify-center py-2">
              <span className="text-xl md:text-2xl font-bold text-white">VS.</span>
            </div>

            {/* Critics Card */}
            <div className="relative transform transition-all duration-300 hover:scale-105">
              <div className="bg-[#1A1B1F] border-2 border-red-500/40 rounded-2xl p-3 md:p-6 shadow-xl transition-all duration-300 hover:border-red-500/60 hover:shadow-2xl" style={{
                boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.6)'
              }}>
                <div className="flex items-center justify-center">
                  <div className="flex items-center gap-3 md:gap-6">
                    <span className="text-3xl md:text-4xl lg:text-5xl font-bold text-red-500" style={{
                      textShadow: '0 0 20px rgba(239, 68, 68, 0.5), 0 0 40px rgba(239, 68, 68, 0.3), 0 0 60px rgba(239, 68, 68, 0.1)'
                    }}>73%</span>
                    <span className="text-base md:text-lg lg:text-xl text-gray-300 font-medium">Critics</span>
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