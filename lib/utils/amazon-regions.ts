/**
 * Amazon regional domain configuration for affiliate links
 * 
 * This module provides utilities for handling Amazon's regional domains
 * and affiliate tags across different countries.
 */

export interface AmazonRegion {
  domain: string
  countryCode: string
  countryName: string
  affiliateTag?: string // Optional region-specific affiliate tag
}

// Map of country codes to Amazon domains
export const AMAZON_REGIONS: Record<string, AmazonRegion> = {
  US: {
    domain: 'amazon.com',
    countryCode: 'US',
    countryName: 'United States'
  },
  UK: {
    domain: 'amazon.co.uk',
    countryCode: 'UK',
    countryName: 'United Kingdom'
  },
  CA: {
    domain: 'amazon.ca',
    countryCode: 'CA',
    countryName: 'Canada'
  },
  DE: {
    domain: 'amazon.de',
    countryCode: 'DE',
    countryName: 'Germany'
  },
  FR: {
    domain: 'amazon.fr',
    countryCode: 'FR',
    countryName: 'France'
  },
  IT: {
    domain: 'amazon.it',
    countryCode: 'IT',
    countryName: 'Italy'
  },
  ES: {
    domain: 'amazon.es',
    countryCode: 'ES',
    countryName: 'Spain'
  },
  NL: {
    domain: 'amazon.nl',
    countryCode: 'NL',
    countryName: 'Netherlands'
  },
  PL: {
    domain: 'amazon.pl',
    countryCode: 'PL',
    countryName: 'Poland'
  },
  SE: {
    domain: 'amazon.se',
    countryCode: 'SE',
    countryName: 'Sweden'
  }
}

/**
 * Get Amazon domain for a specific country code
 * Falls back to .com if country not supported
 */
export function getAmazonDomain(countryCode?: string): string {
  if (!countryCode) return 'amazon.com'
  
  const region = AMAZON_REGIONS[countryCode.toUpperCase()]
  return region ? region.domain : 'amazon.com'
}

/**
 * Build Amazon search URL with affiliate tag
 * Supports both OneLink (.com) and regional domains
 */
export function buildAmazonUrl(params: {
  query: string
  domain?: string
  affiliateTag: string
  department?: string
  additionalParams?: Record<string, string>
}): string {
  const { query, domain = 'amazon.com', affiliateTag, department, additionalParams = {} } = params
  
  // Build base URL
  let url = `https://www.${domain}/s?k=${encodeURIComponent(query)}`
  
  // Add department if specified
  if (department) {
    url += `&i=${department}`
  }
  
  // Add additional parameters
  Object.entries(additionalParams).forEach(([key, value]) => {
    url += `&${key}=${encodeURIComponent(value)}`
  })
  
  // Add affiliate tag
  url += `&tag=${affiliateTag}`
  
  return url
}

/**
 * For OneLink compatibility, we should use .com domains
 * This function checks if OneLink is enabled
 */
export function shouldUseOneLink(): boolean {
  // You can control this via environment variable if needed
  return process.env.AMAZON_USE_ONELINK !== 'false'
}