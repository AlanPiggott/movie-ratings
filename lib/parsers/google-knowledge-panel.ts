/**
 * Utility to parse Google Knowledge Panel HTML and extract sentiment percentages
 */

interface ParseResult {
  percentage: number | null
  matchedPattern?: string
  rawMatch?: string
}

/**
 * Patterns to match various Google Knowledge Panel formats
 * These patterns are ordered by specificity (most specific first)
 */
const PERCENTAGE_PATTERNS = [
  // Direct percentage patterns
  /(\d{1,3})%\s*liked\s*this\s*(film|movie|show|series|tv\s*show)/i,
  /(\d{1,3})%\s*of\s*(people|users|viewers)\s*liked\s*this/i,
  /(\d{1,3})%\s*liked\s*it/i,
  /(\d{1,3})%\s*liked/i,
  
  // Rating patterns that might appear
  /audience\s*score[:\s]*(\d{1,3})%/i,
  /liked\s*by\s*(\d{1,3})%/i,
  /(\d{1,3})%\s*positive/i,
  
  // Variations with different formatting
  /(\d{1,3})\s*%\s*liked/i,
  /(\d{1,3})\s*percent\s*liked/i,
  
  // Google specific patterns
  /google\s*users[:\s]*(\d{1,3})%\s*liked/i,
  /(\d{1,3})%\s*of\s*google\s*users/i,
]

/**
 * Clean HTML by removing script tags, style tags, and other noise
 */
function cleanHTML(html: string): string {
  // Remove script and style content
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
    .replace(/<[^>]+>/g, ' ') // Remove HTML tags
    .replace(/&[a-z]+;/gi, ' ') // Remove HTML entities
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
  
  return cleaned
}

/**
 * Extract percentage from a matched string
 */
function extractPercentage(match: RegExpMatchArray): number | null {
  // Find the first numeric group in the match
  for (let i = 1; i < match.length; i++) {
    const value = match[i]
    if (value && /^\d{1,3}$/.test(value)) {
      const percentage = parseInt(value, 10)
      // Validate percentage is in valid range
      if (percentage >= 0 && percentage <= 100) {
        return percentage
      }
    }
  }
  return null
}

/**
 * Parse Google Knowledge Panel HTML to extract sentiment percentage
 */
export function parseGoogleKnowledgePanel(html: string): ParseResult {
  if (!html || typeof html !== 'string') {
    return { percentage: null }
  }

  // Clean the HTML first
  const cleanedHTML = cleanHTML(html)
  
  // Try each pattern in order
  for (const pattern of PERCENTAGE_PATTERNS) {
    const match = cleanedHTML.match(pattern)
    if (match) {
      const percentage = extractPercentage(match)
      if (percentage !== null) {
        return {
          percentage,
          matchedPattern: pattern.source,
          rawMatch: match[0],
        }
      }
    }
  }

  // Try to find any percentage near "liked" keyword as fallback
  const fallbackPattern = /(\d{1,3})%[^0-9]{0,50}liked|liked[^0-9]{0,50}(\d{1,3})%/i
  const fallbackMatch = cleanedHTML.match(fallbackPattern)
  if (fallbackMatch) {
    const percentage = extractPercentage(fallbackMatch)
    if (percentage !== null) {
      return {
        percentage,
        matchedPattern: 'fallback pattern',
        rawMatch: fallbackMatch[0],
      }
    }
  }

  return { percentage: null }
}

/**
 * Find all potential percentage mentions in HTML (for debugging)
 */
export function findAllPercentages(html: string): string[] {
  const cleaned = cleanHTML(html)
  const percentagePattern = /\d{1,3}%[^0-9]{0,100}/gi
  const matches = cleaned.match(percentagePattern) || []
  return matches
}

/**
 * Check if HTML likely contains a Google Knowledge Panel
 */
export function hasKnowledgePanel(html: string): boolean {
  const indicators = [
    /knowledge[^a-z]*panel/i,
    /kp-wholepage/i,
    /kno-result/i,
    /knowledge-panel/i,
    /g-blk/i,
    // Common knowledge panel class names
    /class="[^"]*kp[^"]*"/i,
    /id="[^"]*knowledge[^"]*"/i,
  ]
  
  return indicators.some(pattern => pattern.test(html))
}