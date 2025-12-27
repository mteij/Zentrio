/**
 * Meta Service - Utilities for metadata resolution and processing.
 * Provides helpers for ID handling, addon selection, and metadata enrichment.
 */

import { MetaDetail, MetaPreview, Manifest } from './types'

/**
 * Check if an ID is a "standard" ID (IMDB or TMDB format)
 */
export function isStandardId(id: string): boolean {
  const primaryId = id.includes(',') ? id.split(',')[0] : id
  return primaryId.startsWith('tt') || primaryId.startsWith('tmdb:')
}

/**
 * Get the primary ID from a potentially compound ID (comma-separated)
 */
export function getPrimaryId(id: string): string {
  return id.includes(',') ? id.split(',')[0] : id
}

/**
 * Extract TMDB ID from various ID formats
 */
export function extractTmdbId(id: string): string | null {
  if (id.startsWith('tmdb:')) {
    return id.split(':')[1]
  }
  return null
}

/**
 * Check if addon is a Zentrio/TMDB addon
 */
export function isZentrioAddon(manifest: Manifest | undefined, manifestUrl: string): boolean {
  if (!manifest) return false
  return manifestUrl.includes('tmdb-addon') || 
         manifest.id === 'org.zentrio.tmdb' ||
         manifest.id?.includes('tmdb') ||
         manifest.name?.toLowerCase().includes('tmdb')
}

/**
 * Sort addons for meta resolution - prioritizes Zentrio for standard IDs
 */
export function sortAddonsForMeta<T extends { manifest?: Manifest, manifestUrl: string }>(
  clients: T[], 
  id: string
): T[] {
  const isStandard = isStandardId(id)
  
  return [...clients].sort((a, b) => {
    const isZentrioA = isZentrioAddon(a.manifest, a.manifestUrl)
    const isZentrioB = isZentrioAddon(b.manifest, b.manifestUrl)
    
    if (isStandard) {
      // For standard IDs, prioritize Zentrio/TMDB
      if (isZentrioA && !isZentrioB) return -1
      if (!isZentrioA && isZentrioB) return 1
    } else {
      // For custom IDs, de-prioritize Zentrio/TMDB
      if (isZentrioA && !isZentrioB) return 1
      if (!isZentrioA && isZentrioB) return -1
    }
    return 0
  })
}

/**
 * Get ID prefixes for a specific resource from manifest
 */
export function getResourceIdPrefixes(manifest: Manifest, resource: string): string[] | null {
  // Check resource-specific idPrefixes first
  const resourceDef = manifest.resources.find(r => 
    typeof r !== 'string' && r.name === resource
  )
  
  if (resourceDef && typeof resourceDef !== 'string' && resourceDef.idPrefixes) {
    return resourceDef.idPrefixes
  }
  
  // Fall back to manifest-level idPrefixes
  return manifest.idPrefixes || null
}

/**
 * Check if an addon can handle a specific ID based on prefixes
 */
export function canHandleId(manifest: Manifest, resource: string, id: string): boolean {
  const prefixes = getResourceIdPrefixes(manifest, resource)
  
  // If no prefixes defined, addon handles all IDs
  if (!prefixes || prefixes.length === 0) return true
  
  const primaryId = getPrimaryId(id)
  return prefixes.some(p => primaryId.startsWith(p))
}

/**
 * Check if addon supports a specific resource and type
 */
export function supportsResource(manifest: Manifest, resource: string, type: string): boolean {
  const resDef = manifest.resources.find(r => {
    if (typeof r === 'string') return r === resource
    return r.name === resource
  })
  
  if (!resDef) return false
  
  // String resource = supports all manifest types
  if (typeof resDef === 'string') {
    return manifest.types.includes(type)
  }
  
  // Object resource with type restriction
  if (resDef.types) {
    return resDef.types.includes(type)
  }
  
  // Object resource without type restriction = supports all manifest types
  return manifest.types.includes(type)
}

/**
 * Build fallback metadata from minimal info
 */
export function buildFallbackMeta(fallback: Partial<MetaDetail>): MetaDetail | null {
  if (!fallback.id || !fallback.type || !fallback.name) {
    return null
  }
  
  return {
    id: fallback.id,
    type: fallback.type,
    name: fallback.name,
    poster: fallback.poster,
    background: fallback.background,
    description: fallback.description,
    releaseInfo: fallback.releaseInfo,
    imdbRating: fallback.imdbRating,
    // Mark as fallback
    _isFallback: true
  } as MetaDetail & { _isFallback: boolean }
}

/**
 * Merge metadata from multiple sources, preferring non-null values
 */
export function mergeMeta(base: MetaDetail, enrichment: Partial<MetaDetail>): MetaDetail {
  const result = { ...base }
  
  for (const [key, value] of Object.entries(enrichment)) {
    if (value !== undefined && value !== null && value !== '') {
      (result as any)[key] = value
    }
  }
  
  return result
}
