// Map UI-friendly genre names to database genre names
export const genreNameMappings: Record<string, string> = {
  // TV-specific mappings
  'Action & Adventure': 'Action',
  'Sci-Fi & Fantasy': 'Science Fiction',
  'War & Politics': 'War',
  
  // Additional mappings if needed
  'Sci-Fi': 'Science Fiction',
  
  // Default mappings (same name)
  'Action': 'Action',
  'Adventure': 'Adventure',
  'Animation': 'Animation',
  'Comedy': 'Comedy',
  'Crime': 'Crime',
  'Documentary': 'Documentary',
  'Drama': 'Drama',
  'Family': 'Family',
  'Fantasy': 'Fantasy',
  'History': 'History',
  'Horror': 'Horror',
  'Music': 'Music',
  'Mystery': 'Mystery',
  'Romance': 'Romance',
  'Science Fiction': 'Science Fiction',
  'Thriller': 'Thriller',
  'War': 'War',
  'Western': 'Western',
  'Kids': 'Family',
  'News': 'Documentary',
  'Reality': 'Documentary',
  'Soap': 'Drama',
  'Talk': 'Documentary'
}

export function mapGenreNameToDb(uiName: string): string {
  return genreNameMappings[uiName] || uiName
}

export function mapGenreNamesToDb(uiNames: string[]): string[] {
  return Array.from(new Set(uiNames.map(mapGenreNameToDb)))
}