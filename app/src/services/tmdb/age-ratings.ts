/**
 * Dutch-Style Age Rating System
 * Converts international ratings to a standardized age-based format
 * 
 * Rating system (similar to Dutch Kijkwijzer but in English):
 * - AL (All Ages) - No age restriction
 * - 6 - 6 years and older
 * - 9 - 9 years and older
 * - 12 - 12 years and older
 * - 16 - 16 years and older
 * - 18 - 18 years and older
 */

// Standard age ratings in order of restrictiveness
export const AGE_RATINGS = ['AL', '6', '9', '12', '16', '18'] as const

export type AgeRating = typeof AGE_RATINGS[number]

// Mapping from international ratings to standard age ratings
// Consolidated mapping - each rating appears only once
const RATING_TO_AGE: Record<string, AgeRating> = {
  // MPAA (USA) and equivalent ratings
  'G': 'AL',
  'PG': '6',
  'PG-13': '12',
  'R': '16',
  'NC-17': '18',
  'APPROVED': 'AL',
  
  // TV Ratings (USA)
  'TV-Y': 'AL',
  'TV-Y7': '6',
  'TV-G': 'AL',
  'TV-PG': '6',
  'TV-14': '12',
  'TV-MA': '18',
  
  // BBFC (UK) - mapped to most restrictive equivalent
  'U': 'AL',
  '12A': '12',
  '15': '16',
  'R18': '18',
  'E': 'AL',
  'CAUTION': '18',
  
  // FSK (Germany) - numeric ages map directly
  '0': 'AL',
  
  // Netherlands (already standard format)
  '9': '9',
  
  // Generic/Other
  'ALL': 'AL',
  '0+': 'AL',
  '6+': '6',
  '7+': '6',
  '9+': '9',
  '12+': '12',
  '13+': '12',
  '14+': '12',
  '16+': '16',
  '18+': '18',
  'TEEN': '12',
  'MATURE': '16',
  'ADULT': '18',
  
  // TV ratings without prefix
  'Y': 'AL',
  'Y7': '6',
  'MA': '18',
  '14': '12',
}

/**
 * Convert an international rating to standard age rating format
 */
export function toStandardAgeRating(rating: string | null | undefined): AgeRating | null {
  if (!rating) return null
  
  const upper = String(rating).toUpperCase().trim()
  
  // Remove TV- prefix if present
  const withoutPrefix = upper.startsWith('TV-') ? upper.replace('TV-', '') : upper
  
  // Check direct mapping
  if (RATING_TO_AGE[upper]) return RATING_TO_AGE[upper]
  if (RATING_TO_AGE[withoutPrefix]) return RATING_TO_AGE[withoutPrefix]
  
  // Check if it's already a valid age rating
  if (AGE_RATINGS.includes(upper as any)) return upper as AgeRating
  
  // Try to extract numeric age (e.g., "12 years", "12 Jahre", etc.)
  const ageMatch = upper.match(/^(\d+)/)
  if (ageMatch) {
    const age = parseInt(ageMatch[1], 10)
    if (age === 0) return 'AL'
    if (age <= 6) return '6'
    if (age <= 9) return '9'
    if (age <= 12) return '12'
    if (age <= 16) return '16'
    return '18'
  }
  
  return null
}

/**
 * Get the minimum age for a rating
 */
export function getMinAge(rating: AgeRating): number {
  const ageMap: Record<AgeRating, number> = {
    'AL': 0,
    '6': 6,
    '9': 9,
    '12': 12,
    '16': 16,
    '18': 18
  }
  return ageMap[rating] || 0
}

/**
 * Compare two age ratings
 * Returns: -1 if a is less restrictive, 0 if equal, 1 if a is more restrictive
 */
export function compareAgeRatings(a: AgeRating, b: AgeRating): number {
  const indexA = AGE_RATINGS.indexOf(a)
  const indexB = AGE_RATINGS.indexOf(b)
  return indexA - indexB
}

/**
 * Check if a rating passes a limit
 */
export function passesAgeRatingLimit(rating: AgeRating, limit: AgeRating): boolean {
  return compareAgeRatings(rating, limit) <= 0
}

/**
 * Get display text for an age rating (full English text)
 */
export function getAgeRatingDisplayText(rating: AgeRating): string {
  const displayMap: Record<AgeRating, string> = {
    'AL': 'All Ages',
    '6': '6 years',
    '9': '9 years',
    '12': '12 years',
    '16': '16 years',
    '18': '18 years'
  }
  return displayMap[rating] || rating
}

/**
 * Get short display text for an age rating (for badges)
 */
export function getAgeRatingShortText(rating: AgeRating): string {
  return rating
}