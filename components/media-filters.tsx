'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { SlidersHorizontal, ChevronDown, X } from 'lucide-react'
import { Drawer } from '@/components/ui/drawer'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { RangeSlider } from '@/components/ui/range-slider'
import { cn } from '@/lib/utils'
import { mapGenreNamesToDb } from '@/lib/genre-mappings'

interface MediaFiltersProps {
  mediaType?: 'movie' | 'tv' | 'all'
  currentGenre?: string
  showGenreFilter?: boolean
}

const sortOptions = [
  { value: 'popularity', label: 'Most Popular' },
  { value: 'alsoLiked', label: 'Highest Rated' },
  { value: 'releaseDate', label: 'Newest' }
]

const allGenres = {
  movie: [
    { name: 'Action' },
    { name: 'Adventure' },
    { name: 'Animation' },
    { name: 'Comedy' },
    { name: 'Crime' },
    { name: 'Documentary' },
    { name: 'Drama' },
    { name: 'Family' },
    { name: 'Fantasy' },
    { name: 'History' },
    { name: 'Horror' },
    { name: 'Music' },
    { name: 'Mystery' },
    { name: 'Romance' },
    { name: 'Science Fiction' },
    { name: 'Thriller' },
    { name: 'War' },
    { name: 'Western' }
  ],
  tv: [
    { name: 'Action & Adventure' },
    { name: 'Animation' },
    { name: 'Comedy' },
    { name: 'Crime' },
    { name: 'Documentary' },
    { name: 'Drama' },
    { name: 'Family' },
    { name: 'Kids' },
    { name: 'Mystery' },
    { name: 'News' },
    { name: 'Reality' },
    { name: 'Sci-Fi & Fantasy' },
    { name: 'Soap' },
    { name: 'Talk' },
    { name: 'War & Politics' },
    { name: 'Western' }
  ]
}

export default function MediaFilters({ 
  mediaType = 'movie', 
  currentGenre, 
  showGenreFilter = true 
}: MediaFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100])
  const [yearRange, setYearRange] = useState<[number, number]>([1970, new Date().getFullYear()])
  
  // Parse current URL params
  const currentSort = searchParams.get('sort') || 'popularity'
  const currentGenres = searchParams.get('genres')?.split(',').filter(Boolean) || []
  const scoreMin = parseInt(searchParams.get('scoreMin') || '0')
  const scoreMax = parseInt(searchParams.get('scoreMax') || '100')
  const yearMin = parseInt(searchParams.get('yearMin') || '1970')
  const yearMax = parseInt(searchParams.get('yearMax') || new Date().getFullYear().toString())
  
  // Initialize state from URL
  useEffect(() => {
    setSelectedGenres(currentGenres)
    setScoreRange([scoreMin, scoreMax])
    setYearRange([yearMin, yearMax])
  }, [currentGenres.join(','), scoreMin, scoreMax, yearMin, yearMax])
  
  // Calculate active filter count
  const activeFilterCount = [
    currentGenres.length > 0,
    scoreMin > 0 || scoreMax < 100,
    yearMin > 1970 || yearMax < new Date().getFullYear()
  ].filter(Boolean).length
  
  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', value)
    params.set('page', '1')
    router.push(`${pathname}?${params.toString()}`)
  }
  
  const handleGenreToggle = (genreName: string) => {
    setSelectedGenres(prev => {
      if (prev.includes(genreName)) {
        // Remove if already selected
        return prev.filter(name => name !== genreName)
      } else if (prev.length < 6) {
        // Add if under limit
        return [...prev, genreName]
      }
      // Don't add if at limit
      return prev
    })
  }
  
  const applyFilters = () => {
    console.log('MediaFilters: Applying filters with:', {
      selectedGenres,
      scoreRange,
      yearRange
    })
    
    const params = new URLSearchParams(searchParams.toString())
    
    // Genres - map UI names to database names
    if (selectedGenres.length > 0) {
      const dbGenres = mapGenreNamesToDb(selectedGenres)
      console.log('MediaFilters: Mapped genres:', selectedGenres, '->', dbGenres)
      params.set('genres', dbGenres.join(','))
    } else {
      params.delete('genres')
    }
    
    // Score range
    if (scoreRange[0] > 0 || scoreRange[1] < 100) {
      params.set('scoreMin', scoreRange[0].toString())
      params.set('scoreMax', scoreRange[1].toString())
    } else {
      params.delete('scoreMin')
      params.delete('scoreMax')
    }
    
    // Year range
    const currentYear = new Date().getFullYear()
    if (yearRange[0] > 1970 || yearRange[1] < currentYear) {
      params.set('yearMin', yearRange[0].toString())
      params.set('yearMax', yearRange[1].toString())
    } else {
      params.delete('yearMin')
      params.delete('yearMax')
    }
    
    params.set('page', '1')
    
    console.log('MediaFilters: Final URL params:', params.toString())
    router.push(`${pathname}?${params.toString()}`)
    setIsFilterOpen(false)
  }
  
  const clearFilters = () => {
    setSelectedGenres([])
    setScoreRange([0, 100])
    setYearRange([1970, new Date().getFullYear()])
    
    const params = new URLSearchParams()
    params.set('sort', currentSort)
    router.push(`${pathname}?${params.toString()}`)
    setIsFilterOpen(false)
  }
  
  const clearAllFilters = () => {
    const params = new URLSearchParams()
    params.set('sort', currentSort)
    router.push(`${pathname}?${params.toString()}`)
  }
  
  const genres = mediaType === 'all' 
    ? [...allGenres.movie, ...allGenres.tv]
    : allGenres[mediaType]
  
  const FilterContent = () => (
    <div className="p-6 space-y-8">
      {/* Genre Selection */}
      {showGenreFilter && !currentGenre && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white">Genres</h3>
        {selectedGenres.length > 0 && (
          <span className="text-xs text-gray-400">
            {selectedGenres.length}/6 selected
          </span>
        )}
      </div>
          <div className="flex flex-wrap gap-2">
            {genres.map((genre) => {
              const isSelected = selectedGenres.includes(genre.name)
              const isDisabled = !isSelected && selectedGenres.length >= 6
              
              return (
                <button
                  key={genre.name}
                  onClick={() => handleGenreToggle(genre.name)}
                  disabled={isDisabled}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-full border transition-all',
                    isSelected
                      ? 'bg-accent text-black border-accent'
                      : isDisabled
                      ? 'bg-transparent text-gray-600 border-gray-700 cursor-not-allowed opacity-50'
                      : 'bg-transparent text-gray-300 border-gray-600 hover:border-gray-400'
                  )}
                  title={isDisabled ? 'Maximum 6 genres can be selected' : undefined}
                >
                  {genre.name}
                </button>
              )
            })}
          </div>
        </div>
      )}
      
      {/* Google Score Range */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-white">Google Score</h3>
        <RangeSlider
          min={0}
          max={100}
          step={1}
          value={scoreRange}
          onChange={setScoreRange}
          formatValue={(v) => `${v}%`}
        />
      </div>
      
      {/* Release Year Range */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-white">Release Year</h3>
        <RangeSlider
          min={1970}
          max={new Date().getFullYear()}
          step={1}
          value={yearRange}
          onChange={setYearRange}
        />
      </div>
      
      {/* Action Buttons */}
      <div className="flex gap-3 pt-6 border-t border-white/10">
        <button
          onClick={clearFilters}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 bg-white/10 rounded-lg hover:bg-white/20 transition-all hover:text-white"
        >
          Clear All
        </button>
        <button
          onClick={applyFilters}
          className="flex-1 px-4 py-2.5 text-sm text-black bg-accent rounded-lg hover:bg-accent/90 transition-all font-semibold shadow-lg shadow-accent/25"
        >
          Apply Filters
        </button>
      </div>
    </div>
  )
  
  return (
    <>
      {/* Desktop Filter Bar */}
      <div className="hidden lg:flex items-center justify-between mb-6">
        <SegmentedControl
          options={sortOptions}
          value={currentSort}
          onChange={handleSortChange}
        />
        
        <button
          onClick={() => setIsFilterOpen(true)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all',
            activeFilterCount > 0
              ? 'bg-accent/20 text-accent border border-accent/50'
              : 'bg-transparent text-gray-400 border border-gray-600 hover:border-gray-400'
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="flex items-center justify-center w-5 h-5 bg-accent text-black text-xs rounded-full font-medium">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
      
      {/* Mobile Filter Bar */}
      <div className="flex lg:hidden items-center justify-between mb-6 gap-3">
        {/* Sort Dropdown */}
        <div className="relative flex-1">
          <select
            value={currentSort}
            onChange={(e) => handleSortChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white/10 border border-gray-600 rounded-lg text-white appearance-none pr-8"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        
        {/* Filter Button */}
        <button
          onClick={() => setIsFilterOpen(true)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all',
            activeFilterCount > 0
              ? 'bg-accent/20 text-accent border border-accent/50'
              : 'bg-transparent text-gray-400 border border-gray-600'
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeFilterCount > 0 && (
            <span className="flex items-center justify-center w-5 h-5 bg-accent text-black text-xs rounded-full font-medium">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
      
      {/* Filter Summary Bar */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span className="text-gray-400">Filters:</span>
          <div className="flex flex-wrap gap-2">
            {currentGenres.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 text-gray-300 rounded-full">
                {currentGenres.join(', ')}
              </span>
            )}
            {(scoreMin > 0 || scoreMax < 100) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 text-gray-300 rounded-full">
                Score: {scoreMin}%-{scoreMax}%
              </span>
            )}
            {(yearMin > 1970 || yearMax < new Date().getFullYear()) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/10 text-gray-300 rounded-full">
                {yearMin}-{yearMax}
              </span>
            )}
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 px-2 py-1 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
              Clear all
            </button>
          </div>
        </div>
      )}
      
      {/* Desktop Drawer */}
      <div className="hidden lg:block">
        <Drawer
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          title="Filters"
        >
          <FilterContent />
        </Drawer>
      </div>
      
      {/* Mobile Bottom Sheet */}
      <BottomSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filters"
      >
        <FilterContent />
      </BottomSheet>
    </>
  )
}