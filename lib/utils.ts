import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export function formatRuntime(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function getScoreColor(score: number) {
  if (score >= 80) return 'text-green-500'
  if (score >= 60) return 'text-yellow-500'
  if (score >= 40) return 'text-orange-500'
  return 'text-red-500'
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores with hyphens
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

export function createMediaUrl(mediaType: 'movie' | 'tv', title: string, id: string): string {
  const slug = slugify(title)
  // For now, use full ID until we set up partial ID search
  return `/${mediaType}/${slug}-${id}`
}

export function extractIdFromSlug(slug: string): string {
  // Check for TMDB ID pattern first (tmdb-123)
  const tmdbPattern = /tmdb-\d+$/i
  const tmdbMatch = slug.match(tmdbPattern)
  
  if (tmdbMatch) {
    return tmdbMatch[0]
  }
  
  // Extract full UUID pattern
  // UUID pattern: 8-4-4-4-12 hexadecimal characters
  const uuidPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i
  const match = slug.match(uuidPattern)
  
  if (match) {
    return match[0]
  }
  
  // Fallback: get everything after the last hyphen
  const lastHyphenIndex = slug.lastIndexOf('-')
  if (lastHyphenIndex === -1 || lastHyphenIndex === slug.length - 1) {
    return slug
  }
  return slug.substring(lastHyphenIndex + 1)
}

// Valid genre slugs based on TMDB genres
const VALID_GENRE_SLUGS = [
  // Movie genres
  'action',
  'adventure',
  'animation',
  'comedy',
  'crime',
  'documentary',
  'drama',
  'family',
  'fantasy',
  'history',
  'horror',
  'music',
  'mystery',
  'romance',
  'science-fiction',
  'sci-fi', // Common alias for science-fiction
  'tv-movie',
  'thriller',
  'war',
  'western',
  // TV genres
  'action-adventure',
  'kids',
  'news',
  'reality',
  'sci-fi-fantasy',
  'soap',
  'talk',
  'war-politics'
]

export function isValidGenreSlug(slug: string): boolean {
  return VALID_GENRE_SLUGS.includes(slug.toLowerCase())
}

export function isUUID(str: string): boolean {
  const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
  return uuidPattern.test(str)
}