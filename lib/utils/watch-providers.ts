/**
 * Generate direct watch provider links based on provider name and media info
 * 
 * This module handles URL generation for various streaming, rental, and purchase platforms.
 * Special cases:
 * - Cable/Satellite providers (Spectrum): No direct search, links to general on-demand page
 * - Channel add-ons (Amazon/Apple channels): Links to channel-specific pages
 * - Ad-supported tiers: Uses same search as regular tiers
 * - Regional variants: Uses region-specific domains
 */

import { buildAmazonUrl, shouldUseOneLink } from './amazon-regions'

interface WatchProviderLink {
  provider_id: number
  provider_name: string
  logo_path: string
  link?: string
}

interface MediaInfo {
  title: string
  year?: number
  mediaType: 'movie' | 'tv'
  tmdbId: number
}

// Provider ID mapping from TMDB
const PROVIDER_CONFIGS: Record<number, { 
  name: string; 
  baseUrl: string; 
  searchPattern: string;
  noDirectLink?: boolean; // For providers without searchable websites
  fallbackUrl?: string; // Alternative URL for non-searchable providers
}> = {
  // Major Streaming Services
  8: { // Netflix
    name: 'Netflix',
    baseUrl: 'https://www.netflix.com',
    searchPattern: '/search?q='
  },
  1796: { // Netflix basic with Ads
    name: 'Netflix basic with Ads',
    baseUrl: 'https://www.netflix.com',
    searchPattern: '/search?q='
  },
  9: { // Amazon Prime Video
    name: 'Amazon Prime Video',
    baseUrl: 'https://www.amazon.com',
    searchPattern: '/s?k='
  },
  1969: { // Amazon Prime Video with Ads
    name: 'Amazon Prime Video with Ads',
    baseUrl: 'https://www.amazon.com',
    searchPattern: '/s?k='
  },
  337: { // Disney Plus
    name: 'Disney Plus',
    baseUrl: 'https://www.disneyplus.com',
    searchPattern: '/search/'
  },
  384: { // HBO Max / Max (Old ID)
    name: 'Max',
    baseUrl: 'https://www.max.com',
    searchPattern: '/search?q='
  },
  1899: { // Max (New ID)
    name: 'Max',
    baseUrl: 'https://www.max.com',
    searchPattern: '/search?q='
  },
  15: { // Hulu
    name: 'Hulu',
    baseUrl: 'https://www.hulu.com',
    searchPattern: '/search?q='
  },
  386: { // Peacock
    name: 'Peacock',
    baseUrl: 'https://www.peacocktv.com',
    searchPattern: '/search?q='
  },
  531: { // Paramount Plus
    name: 'Paramount Plus',
    baseUrl: 'https://www.paramountplus.com',
    searchPattern: '/search?q='
  },
  2: { // Apple TV Plus (iTunes)
    name: 'Apple TV',
    baseUrl: 'https://tv.apple.com',
    searchPattern: '/search?term='
  },
  350: { // Apple TV+ (Subscription Service)
    name: 'Apple TV+',
    baseUrl: 'https://tv.apple.com',
    searchPattern: '/search?term='
  },
  538: { // Plex
    name: 'Plex',
    baseUrl: 'https://app.plex.tv',
    searchPattern: '/desktop#!/search?query='
  },
  
  // Purchase/Rental Services
  3: { // Google Play Movies
    name: 'Google Play Movies & TV',
    baseUrl: 'https://play.google.com/store/search',
    searchPattern: '?q='
  },
  68: { // Microsoft Store
    name: 'Microsoft Store',
    baseUrl: 'https://www.microsoft.com/en-us/search/shop/movies-and-tv',
    searchPattern: '?q='
  },
  192: { // YouTube
    name: 'YouTube',
    baseUrl: 'https://www.youtube.com',
    searchPattern: '/results?search_query='
  },
  10: { // Amazon Video (Purchase/Rent)
    name: 'Amazon Video',
    baseUrl: 'https://www.amazon.com',
    searchPattern: '/s?k='
  },
  7: { // Vudu
    name: 'Vudu',
    baseUrl: 'https://www.vudu.com',
    searchPattern: '/search?searchString='
  },
  
  // Cable/Satellite On-Demand Services (No direct links)
  486: { // Spectrum On Demand
    name: 'Spectrum On Demand',
    noDirectLink: true,
    baseUrl: 'https://www.spectrum.com',
    searchPattern: '',
    fallbackUrl: 'https://www.spectrum.com/cable-tv/on-demand'
  },
  
  // Network Apps
  211: { // NBC
    name: 'NBC',
    baseUrl: 'https://www.nbc.com',
    searchPattern: '/search?q='
  },
  387: { // AMC on Demand / AMC+
    name: 'AMC+',
    baseUrl: 'https://www.amcplus.com',
    searchPattern: '/search?q='
  },
  1764: { // Fox
    name: 'Fox',
    baseUrl: 'https://www.fox.com',
    searchPattern: '/search?q='
  },
  
  // Premium Channel Add-ons (via Amazon/Apple)
  1853: { // Paramount+ Amazon Channel
    name: 'Paramount+ Amazon Channel',
    baseUrl: 'https://www.amazon.com/channels/paramountplus',
    searchPattern: '?search='
  },
  1832: { // Paramount+ Apple TV Channel
    name: 'Paramount+ Apple TV Channel',
    baseUrl: 'https://tv.apple.com',
    searchPattern: '/channel/paramount-plus?term='
  },
  1854: { // Max Amazon Channel
    name: 'Max Amazon Channel',
    baseUrl: 'https://www.amazon.com/channels/max',
    searchPattern: '?search='
  },
  2243: { // Apple TV Plus Amazon Channel
    name: 'Apple TV Plus Amazon Channel',
    baseUrl: 'https://www.amazon.com',
    searchPattern: '/s?k='
  },
  331: { // FlixFling
    name: 'FlixFling',
    baseUrl: 'https://www.flixfling.com',
    searchPattern: '/search?q='
  },
  2100: { // Amazon Prime Video with Ads (Different ID)
    name: 'Amazon Prime Video with Ads',
    baseUrl: 'https://www.amazon.com',
    searchPattern: '/s?k='
  },
  
  // Additional Streaming Services
  97: { // Crunchyroll
    name: 'Crunchyroll',
    baseUrl: 'https://www.crunchyroll.com',
    searchPattern: '/search?q='
  },
  175: { // Netflix Kids
    name: 'Netflix Kids',
    baseUrl: 'https://www.netflix.com/kids',
    searchPattern: '/search?q='
  },
  
  // Free Streaming Services
  613: { // Freevee (Amazon Freevee)
    name: 'Freevee',
    baseUrl: 'https://www.amazon.com/freevee',
    searchPattern: '/search?q='
  },
  300: { // Pluto TV
    name: 'Pluto TV',
    baseUrl: 'https://pluto.tv',
    searchPattern: '/search/details?q='
  },
  
  // International/Regional Services
  119: { // Amazon Prime Video (UK)
    name: 'Amazon Prime Video UK',
    baseUrl: 'https://www.amazon.co.uk',
    searchPattern: '/s?k='
  },
  39: { // Now TV (UK)
    name: 'Now TV',
    baseUrl: 'https://www.nowtv.com',
    searchPattern: '/search?q='
  },
  
  // Additional Network/Cable Services
  279: { // fuboTV
    name: 'fuboTV',
    baseUrl: 'https://www.fubo.tv',
    searchPattern: '/welcome/search?q='
  },
  289: { // Redbox
    name: 'Redbox',
    baseUrl: 'https://www.redbox.com',
    searchPattern: '/browse/search?q='
  },
  358: { // DIRECTV
    name: 'DIRECTV',
    noDirectLink: true,
    baseUrl: 'https://www.directv.com',
    searchPattern: '',
    fallbackUrl: 'https://www.directv.com/movies'
  },
  
  // Specialty Streaming Services
  444: { // Dekkoo
    name: 'Dekkoo',
    baseUrl: 'https://www.dekkoo.com',
    searchPattern: '/search?q='
  },
  445: { // ClassixTV
    name: 'ClassixTV', 
    baseUrl: 'https://www.classix.tv',
    searchPattern: '/search?q='
  },
  
  // Sports/Documentary Services
  426: { // ESPN Plus
    name: 'ESPN Plus',
    baseUrl: 'https://plus.espn.com',
    searchPattern: '/search?q='
  }
}

/**
 * Check if a provider has a searchable direct link
 */
export function hasSearchableLink(providerId: number): boolean {
  const config = PROVIDER_CONFIGS[providerId]
  return config ? !config.noDirectLink : false
}

/**
 * Get provider configuration
 */
export function getProviderConfig(providerId: number) {
  return PROVIDER_CONFIGS[providerId] || null
}

export function generateWatchProviderLink(provider: WatchProviderLink, media: MediaInfo): WatchProviderLink {
  const config = PROVIDER_CONFIGS[provider.provider_id]
  
  if (!config) {
    // No specific config, return without link
    return provider
  }

  // Handle providers without direct links (e.g., cable on-demand)
  if (config.noDirectLink) {
    return {
      ...provider,
      link: config.fallbackUrl || config.baseUrl
    }
  }

  // Build search query
  const searchQuery = `${media.title} ${media.year || ''}`.trim()
  const encodedQuery = encodeURIComponent(searchQuery)
  
  // Get Amazon affiliate tag from environment variable
  const amazonAffiliateTag = process.env.AMAZON_AFFILIATE_TAG || 'truereview08c-20'
  
  // For debugging: log when generating Amazon links
  const isAmazonProvider = [9, 10, 119, 1969, 2100, 1853, 1854, 2243, 613].includes(provider.provider_id)
  
  // Special handling for certain providers
  let link = ''
  
  switch (provider.provider_id) {
    case 8: // Netflix
    case 1796: // Netflix basic with Ads
      link = `${config.baseUrl}${config.searchPattern}${encodedQuery}`
      break
      
    case 337: // Disney Plus
      link = `${config.baseUrl}${config.searchPattern}${encodedQuery}`
      break
      
    case 2: // Apple TV
    case 350: // Apple TV+
    case 1832: // Paramount+ Apple TV Channel
      // Apple uses a different format
      link = `${config.baseUrl}${config.searchPattern}${encodedQuery}&type=${media.mediaType}`
      break
      
    case 3: // Google Play
      // Google Play needs category specification
      const category = media.mediaType === 'movie' ? '&c=movies' : '&c=tv'
      link = `${config.baseUrl}${config.searchPattern}${encodedQuery}${category}`
      break
      
    case 68: // Microsoft Store
      // Microsoft Store needs category specification
      const msCategory = media.mediaType === 'movie' ? '&category=movies' : '&category=tv'
      link = `${config.baseUrl}${config.searchPattern}${encodedQuery}${msCategory}`
      break
      
    case 9: // Amazon Prime Video
    case 1969: // Amazon Prime Video with Ads
    case 2100: // Amazon Prime Video with Ads (Alt ID)
    case 10: // Amazon Video (Purchase/Rent)
    case 119: // Amazon Prime Video UK
    case 1853: // Paramount+ Amazon Channel
    case 1854: // Max Amazon Channel
    case 2243: // Apple TV Plus Amazon Channel
      // Amazon needs department specification and affiliate tag
      const dept = 'instant-video'
      
      // For OneLink compatibility, always use .com domain unless explicitly disabled
      // OneLink will automatically redirect to local stores
      const amazonDomain = shouldUseOneLink() ? 'amazon.com' : 
        (provider.provider_id === 119 ? 'amazon.co.uk' : 'amazon.com')
      
      // Special handling for Amazon Channels
      if ([1853, 1854, 2243].includes(provider.provider_id)) {
        // These are channel-specific pages
        const channelPath = provider.provider_id === 1853 ? 'paramountplus' : 
                           provider.provider_id === 1854 ? 'max' : 
                           'appletv'
        link = `https://www.${amazonDomain}/channels/${channelPath}?search=${encodedQuery}&tag=${amazonAffiliateTag}`
      } else {
        link = buildAmazonUrl({
          query: searchQuery,
          domain: amazonDomain,
          affiliateTag: amazonAffiliateTag,
          department: dept
        })
      }
      break
      
    case 538: // Plex
      // Plex uses a different URL structure
      link = `${config.baseUrl}${config.searchPattern}${encodedQuery}`
      break
      
    case 192: // YouTube
      // YouTube - add movie/show filter
      const ytFilter = media.mediaType === 'movie' ? '&sp=EgIQAQ%253D%253D' : '&sp=EgIQAw%253D%253D'
      link = `${config.baseUrl}${config.searchPattern}${encodedQuery}${ytFilter}`
      break
      
    case 97: // Crunchyroll
      // Crunchyroll - anime-specific search
      link = `${config.baseUrl}${config.searchPattern}${encodedQuery}`
      break
      
    case 613: // Freevee
      // Freevee uses Amazon's search with a filter and affiliate tag
      link = buildAmazonUrl({
        query: searchQuery,
        domain: 'amazon.com', // Freevee is US-only
        affiliateTag: amazonAffiliateTag,
        department: 'instant-video',
        additionalParams: { bbn: '138909171' }
      })
      break
      
    case 300: // Pluto TV
      // Pluto TV has a unique search structure
      link = `${config.baseUrl}${config.searchPattern}${encodedQuery}`
      break
      
    default:
      // Default search pattern
      link = `${config.baseUrl}${config.searchPattern}${encodedQuery}`
  }

  return {
    ...provider,
    link
  }
}

export function processWatchProviders(providers: any, media: MediaInfo) {
  const processed: any = {}
  
  // Process each provider type (flatrate, rent, buy)
  if (providers?.flatrate) {
    processed.flatrate = providers.flatrate.map((p: WatchProviderLink) => 
      generateWatchProviderLink(p, media)
    )
  }
  
  if (providers?.rent) {
    processed.rent = providers.rent.map((p: WatchProviderLink) => 
      generateWatchProviderLink(p, media)
    )
  }
  
  if (providers?.buy) {
    processed.buy = providers.buy.map((p: WatchProviderLink) => 
      generateWatchProviderLink(p, media)
    )
  }
  
  return processed
}

// Export types for use in other modules
export type { WatchProviderLink, MediaInfo }

/**
 * Summary of provider configurations:
 * 
 * Total providers configured: 40+
 * 
 * Categories:
 * - Major Streaming: Netflix, Prime Video, Disney+, Max, Hulu, Peacock, Paramount+, Apple TV+
 * - Purchase/Rental: Microsoft Store, Google Play, YouTube, Amazon Video, Vudu
 * - Free Streaming: Plex, Freevee, Pluto TV
 * - Cable/Satellite: Spectrum, DIRECTV (no direct search links)
 * - Network Apps: NBC, AMC+, Fox
 * - Channel Add-ons: Various Amazon/Apple channels
 * - International: UK services (Now TV, Amazon UK)
 * - Specialty: Crunchyroll, ESPN+, Dekkoo, ClassixTV
 * 
 * Special handling:
 * - Amazon services: Add instant-video department filter
 * - Apple services: Add media type parameter
 * - Google Play: Add category filter (movies/tv)
 * - YouTube: Add content type filter
 * - Cable providers: Link to general on-demand pages
 * - Channel add-ons: Link to channel-specific pages
 */