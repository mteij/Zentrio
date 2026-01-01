/**
 * Content Service - Handles content filtering, enrichment, and parental controls.
 * Extracted from addon-manager.ts to reduce complexity and improve testability.
 */

import { MetaPreview } from './types'
import { profileProxySettingsDb, watchHistoryDb } from '../database'
import { tmdbService } from '../tmdb/index'
import { toStandardAgeRating, AGE_RATINGS, type AgeRating } from '../tmdb/age-ratings'

// Standard age ratings in order of restrictiveness
const RATINGS = AGE_RATINGS

// Age to age rating mapping
const AGE_TO_RATING: Record<number, AgeRating> = {
  0: 'AL',
  6: '6',
  9: '9',
  12: '12',
  16: '16',
  18: '18'
}

// Rating normalization mappings (various regional/TV ratings to standard equivalents)
// This is now handled by the toStandardAgeRating function, but we keep some direct mappings for backward compatibility
const RATING_MAPPINGS: Record<string, string> = {
  // These will be converted to Kijkwijzer format by normalizeRating
  'G': 'G',
  'PG': 'PG',
  'PG-13': 'PG-13',
  'R': 'R',
  'NC-17': 'NC-17',
  'TV-Y': 'TV-Y',
  'TV-Y7': 'TV-Y7',
  'TV-G': 'TV-G',
  'TV-PG': 'TV-PG',
  'TV-14': 'TV-14',
  'TV-MA': 'TV-MA',
  'U': 'U',
  '12': '12',
  '12A': '12A',
  '15': '15',
  '18': '18',
  'R18': 'R18',
  'E': 'E',
  'CAUTION': 'CAUTION',
  'ALL': 'ALL',
  '0+': '0+',
  '6+': '6+',
  '7+': '7+',
  '9+': '9+',
  '12+': '12+',
  '13+': '13+',
  '14+': '14+',
  '16+': '16+',
  '18+': '18+',
  'TEEN': 'TEEN',
  'MATURE': 'MATURE',
  'ADULT': 'ADULT',
  'AL': 'AL',
  'APPROVED': 'APPROVED'
}

export interface ParentalSettings {
  enabled: boolean
  ratingLimit: AgeRating
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
    ? (AGE_TO_RATING[proxySettings.nsfw_age_rating] || '18' as AgeRating)
    : '18' as AgeRating
  
  return {
    enabled: proxySettings?.nsfw_filter_enabled ?? false,
    ratingLimit
  }
}

/**
 * Normalize a rating string to standard age rating format
 */
export function normalizeRating(rating: string | undefined | null): AgeRating | null {
  if (!rating) return null
  
  // Convert to standard age rating format
  const standardRating = toStandardAgeRating(rating)
  
  if (standardRating) {
    return standardRating
  }
  
  // Fallback: try to extract numeric age
  const upper = String(rating).toUpperCase().trim()
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
