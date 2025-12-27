/**
 * Content Service - Handles content filtering, enrichment, and parental controls.
 * Extracted from addon-manager.ts to reduce complexity and improve testability.
 */

import { MetaPreview } from './types'
import { profileProxySettingsDb, watchHistoryDb } from '../database'
import { tmdbService } from '../tmdb/index'

// Standard MPAA ratings in order of restrictiveness
const RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17'] as const

// Age to rating mapping
const AGE_TO_RATING: Record<number, string> = {
  6: 'G',
  9: 'PG',
  12: 'PG-13',
  16: 'R',
  18: 'NC-17'
}

// Rating normalization mappings (various regional/TV ratings to MPAA equivalents)
const RATING_MAPPINGS: Record<string, string> = {
  // TV ratings (remove prefix)
  'TV-Y': 'G', 'TV-Y7': 'G', 'TV-G': 'G', 'TV-PG': 'PG',
  'TV-14': 'PG-13', 'TV-MA': 'NC-17',
  'Y': 'G', 'Y7': 'G', 'MA': 'NC-17', '14': 'PG-13',
  // UK (BBFC)
  'U': 'G', '12': 'PG-13', '12A': 'PG-13', '15': 'R',
  '18': 'NC-17', 'R18': 'NC-17', 'E': 'G', 'CAUTION': 'NC-17',
  // Generic
  'ALL': 'G', '0+': 'G', '6+': 'PG', '7+': 'PG', '9+': 'PG',
  '12+': 'PG-13', '13+': 'PG-13', 'TEEN': 'PG-13', '14+': 'PG-13',
  '16': 'R', 'MATURE': 'NC-17', 'ADULT': 'NC-17',
  // Netherlands
  'AL': 'G', '6': 'PG', '9': 'PG',
  // USA (MPA)
  'APPROVED': 'G'
}

export interface ParentalSettings {
  enabled: boolean
  ratingLimit: string
}

export interface ContentEnrichment {
  isWatched?: boolean
  progressPercent?: number
  lastStream?: any
  episodeDisplay?: string
}

/**
 * Get parental control settings for a profile
 */
export function getParentalSettings(profileId: number): ParentalSettings {
  const proxySettings = profileProxySettingsDb.findByProfileId(profileId)
  const ratingLimit = proxySettings?.nsfw_age_rating 
    ? (AGE_TO_RATING[proxySettings.nsfw_age_rating] || 'R') 
    : 'R'
  
  return {
    enabled: proxySettings?.nsfw_filter_enabled ?? false,
    ratingLimit
  }
}

/**
 * Normalize a rating string to MPAA equivalent
 */
export function normalizeRating(rating: string | undefined | null): string | null {
  if (!rating) return null
  
  const upper = String(rating).toUpperCase().trim()
  
  // Remove TV- prefix if present
  const withoutPrefix = upper.startsWith('TV-') ? upper.replace('TV-', '') : upper
  
  // Check direct mapping
  if (RATING_MAPPINGS[upper]) return RATING_MAPPINGS[upper]
  if (RATING_MAPPINGS[withoutPrefix]) return RATING_MAPPINGS[withoutPrefix]
  
  // Check if it's already a valid MPAA rating
  if (RATINGS.includes(upper as any)) return upper
  if (RATINGS.includes(withoutPrefix as any)) return withoutPrefix
  
  return null
}

/**
 * Extract certification from an item's various possible fields
 */
export function extractCertification(item: Record<string, any>): string | null {
  // Try direct fields
  let cert = item.ageRating || item.certification || item.rating || 
             item.contentRating || item.info?.certification || item.info?.rating
  
  // Handle object-style certification (e.g., from TMDB)
  if (typeof cert === 'object' && cert !== null) {
    cert = cert['US'] || cert['GB'] || cert['NL'] || Object.values(cert)[0]
  }
  
  // Try to extract from releaseInfo
  if (!cert && item.releaseInfo && typeof item.releaseInfo === 'string') {
    const parts = item.releaseInfo.split('|').map((s: string) => s.trim())
    const potentialRating = parts.find((p: string) => 
      RATINGS.includes(p as any) || p.startsWith('TV-')
    )
    if (potentialRating) cert = potentialRating
  }
  
  return cert ? String(cert) : null
}

/**
 * Check if content passes parental filter
 */
export function passesParentalFilter(
  normalizedRating: string | null, 
  settings: ParentalSettings
): boolean {
  if (!settings.enabled) return true
  if (!normalizedRating) return false // Strict mode: hide if no rating
  
  const limitIndex = RATINGS.indexOf(settings.ratingLimit as any)
  const ratingIndex = RATINGS.indexOf(normalizedRating as any)
  
  if (limitIndex === -1 || ratingIndex === -1) return true
  return ratingIndex <= limitIndex
}

/**
 * Enrich item with age rating from TMDB if missing
 */
export async function enrichWithAgeRating(
  item: MetaPreview,
  userId: string | undefined
): Promise<string | null> {
  if (!userId) return null
  
  const tmdbClient = await tmdbService.getClient(userId)
  if (!tmdbClient) return null
  
  try {
    let tmdbId: string | null = null
    let type: 'movie' | 'series' = item.type === 'movie' ? 'movie' : 'series'
    
    if (item.id.startsWith('tmdb:')) {
      tmdbId = item.id.split(':')[1]
    } else if (item.id.startsWith('tt')) {
      // Resolve IMDB ID to TMDB ID
      const findResults = await tmdbClient.find({
        id: item.id,
        external_source: 'imdb_id'
      })
      
      if (type === 'movie' && findResults.movie_results?.length > 0) {
        tmdbId = findResults.movie_results[0].id.toString()
      } else if (type === 'series' && findResults.tv_results?.length > 0) {
        tmdbId = findResults.tv_results[0].id.toString()
      } else if (findResults.movie_results?.length > 0) {
        tmdbId = findResults.movie_results[0].id.toString()
        type = 'movie'
      } else if (findResults.tv_results?.length > 0) {
        tmdbId = findResults.tv_results[0].id.toString()
        type = 'series'
      }
    }
    
    if (tmdbId) {
      return await tmdbService.getAgeRating(tmdbClient, tmdbId, type, 'en-US')
    }
  } catch (e) {
    console.warn('[ContentService] Failed to enrich age rating:', e)
  }
  
  return null
}

/**
 * Filter content based on parental settings
 */
export async function filterContent(
  items: MetaPreview[],
  settings: ParentalSettings,
  userId?: string
): Promise<MetaPreview[]> {
  const results = await Promise.all(items.map(async (item) => {
    const itemAny = item as Record<string, any>
    
    // Try to get existing certification
    let cert = extractCertification(itemAny)
    
    // If no cert and we have userId, try TMDB lookup
    if (!cert && userId) {
      cert = await enrichWithAgeRating(item, userId)
    }
    
    // Normalize the rating
    const normalizedCert = normalizeRating(cert)
    
    // Update item with normalized certification
    if (normalizedCert) {
      itemAny.certification = normalizedCert
    }
    
    // Check if passes filter
    return passesParentalFilter(normalizedCert, settings)
  }))
  
  return items.filter((_, index) => results[index])
}

/**
 * Enrich content with watch status from history
 */
export function enrichWithWatchStatus(
  items: MetaPreview[], 
  profileId: number
): MetaPreview[] {
  if (items.length === 0) return items
  
  // Build list of IDs to check (with and without prefix)
  const ids = new Set<string>()
  items.forEach(i => {
    ids.add(i.id)
    if (i.id.startsWith('tmdb:')) {
      ids.add(i.id.replace('tmdb:', ''))
    }
  })
  
  try {
    const statusMap = watchHistoryDb.getBatchStatus(profileId, Array.from(ids))
    
    return items.map(item => {
      // Try exact match, then stripped match
      let status = statusMap[item.id]
      if (!status && item.id.startsWith('tmdb:')) {
        status = statusMap[item.id.replace('tmdb:', '')]
      }
      
      if (status) {
        const enriched = { ...item } as any
        if (status.isWatched) enriched.isWatched = true
        if (status.progress > 0) enriched.progressPercent = status.progress
        if (status.lastStream) enriched.lastStream = status.lastStream
        if ((status as any).episodeDisplay) {
          enriched.episodeDisplay = (status as any).episodeDisplay
        }
        return enriched
      }
      
      return item
    })
  } catch (e) {
    console.warn('[ContentService] Failed to enrich watch status:', e)
    return items
  }
}
