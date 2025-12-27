/**
 * Stream Service - Utilities for stream aggregation and processing.
 * Provides helpers for video ID construction, stream sorting, and addon filtering.
 */

import { Stream, Manifest } from './types'

/**
 * Construct a video ID for stream requests
 * For series: id:season:episode
 * For movies: id
 */
export function buildVideoId(
  type: string, 
  id: string, 
  season?: number, 
  episode?: number
): string {
  if (type === 'series' && season !== undefined && episode !== undefined) {
    return `${id}:${season}:${episode}`
  }
  return id
}

/**
 * Parse a video ID back into components
 */
export function parseVideoId(videoId: string): { id: string, season?: number, episode?: number } {
  const parts = videoId.split(':')
  
  if (parts.length >= 3) {
    const season = parseInt(parts[parts.length - 2])
    const episode = parseInt(parts[parts.length - 1])
    const id = parts.slice(0, -2).join(':')
    
    if (!isNaN(season) && !isNaN(episode)) {
      return { id, season, episode }
    }
  }
  
  return { id: videoId }
}

/**
 * Check if a stream is cached/instant
 */
export function isStreamCached(stream: Stream): boolean {
  const combined = `${stream.name || ''} ${stream.title || ''} ${stream.description || ''}`.toLowerCase()
  
  const cachedIndicators = ['cached', '⚡', '+', '✓', 'instant', 'your media', '[tb+]']
  const uncachedIndicators = ['⬇️', '⬇', '⏳', 'uncached', 'download']
  
  const isExplicitlyUncached = uncachedIndicators.some(indicator => 
    combined.includes(indicator.toLowerCase()) || 
    (stream.name?.includes(indicator)) || 
    (stream.title?.includes(indicator))
  )
  
  if (isExplicitlyUncached) return false
  
  return cachedIndicators.some(indicator => 
    combined.includes(indicator.toLowerCase()) || 
    (stream.name?.includes(indicator)) || 
    (stream.title?.includes(indicator))
  )
}

/**
 * Parse resolution from stream metadata
 */
export function parseResolution(stream: Stream): string | null {
  const combined = `${stream.name || ''} ${stream.title || ''} ${stream.description || ''}`.toLowerCase()
  
  if (combined.includes('4k') || combined.includes('2160p')) return '4K'
  if (combined.includes('1080p')) return '1080p'
  if (combined.includes('720p')) return '720p'
  if (combined.includes('480p')) return '480p'
  
  return null
}

/**
 * Parse file size from stream metadata
 */
export function parseFileSize(stream: Stream): string | null {
  const combined = `${stream.name || ''} ${stream.title || ''} ${stream.description || ''}`
  const sizeMatch = combined.match(/(\d+(?:\.\d+)?)\s*(gb|mb)/i)
  
  if (sizeMatch) {
    const val = parseFloat(sizeMatch[1])
    const unit = sizeMatch[2].toUpperCase()
    return `${val} ${unit}`
  }
  
  return null
}

/**
 * Check if stream has HDR
 */
export function hasHDR(stream: Stream): boolean {
  const combined = `${stream.name || ''} ${stream.title || ''} ${stream.description || ''}`.toLowerCase()
  return combined.includes('hdr')
}

/**
 * Check if stream has Dolby Vision
 */
export function hasDolbyVision(stream: Stream): boolean {
  const combined = `${stream.name || ''} ${stream.title || ''} ${stream.description || ''}`.toLowerCase()
  return combined.includes('dv') || combined.includes('dolby vision')
}

/**
 * Parsed stream info for UI display
 */
export interface ParsedStreamInfo {
  resolution: string | null
  size: string | null
  isCached: boolean
  hasHDR: boolean
  hasDV: boolean
}

/**
 * Parse all display info from a stream
 */
export function parseStreamInfo(stream: Stream): ParsedStreamInfo {
  return {
    resolution: parseResolution(stream),
    size: parseFileSize(stream),
    isCached: isStreamCached(stream),
    hasHDR: hasHDR(stream),
    hasDV: hasDolbyVision(stream)
  }
}

/**
 * Flatten stream results from multiple addons into a single list
 */
export function flattenStreamResults(
  results: { addon: Manifest, streams: Stream[] }[]
): { stream: Stream, addon: Manifest }[] {
  return results.flatMap(r => 
    r.streams.map(s => ({ stream: s, addon: r.addon }))
  )
}

/**
 * Group flat streams back by addon
 */
export function groupStreamsByAddon(
  flatStreams: { stream: Stream, addon: Manifest }[]
): { addon: Manifest, streams: Stream[] }[] {
  const addonMap = new Map<string, { addon: Manifest, streams: Stream[] }>()
  
  for (const { stream, addon } of flatStreams) {
    const key = addon.id
    if (!addonMap.has(key)) {
      addonMap.set(key, { addon, streams: [] })
    }
    addonMap.get(key)!.streams.push(stream)
  }
  
  return Array.from(addonMap.values())
}

/**
 * Auto-play configuration
 */
export interface AutoPlayConfig {
  enabled: boolean
  maxWaitMs: number           // 5000-30000, default 10000
  preferCached: boolean       // Prefer cached/debrid streams
  minResolution: string       // Minimum: '480p', '720p', '1080p', '4k'
}

export const DEFAULT_AUTO_PLAY_CONFIG: AutoPlayConfig = {
  enabled: true,
  maxWaitMs: 10000,
  preferCached: true,
  minResolution: '720p'
}

// Resolution priority (higher = better)
const RESOLUTION_PRIORITY: Record<string, number> = {
  '4K': 4,
  '2160p': 4,
  '1080p': 3,
  '720p': 2,
  '480p': 1,
  'unknown': 0
}

/**
 * Check if a stream meets minimum quality requirements
 */
export function isStreamAcceptable(
  stream: Stream,
  config: AutoPlayConfig
): boolean {
  const info = parseStreamInfo(stream)
  
  // If preferCached is true and stream is not cached, it's less acceptable
  // but not rejected outright (we might use it if no cached streams available)
  
  // Check minimum resolution
  const minPriority = RESOLUTION_PRIORITY[config.minResolution] || 0
  const streamPriority = RESOLUTION_PRIORITY[info.resolution || 'unknown'] || 0
  
  // Unknown resolution is acceptable if no other info available
  if (info.resolution === null) return true
  
  return streamPriority >= minPriority
}

/**
 * Select the best stream for auto-play
 * Prioritizes: cached > uncached, then by resolution
 */
export function selectBestStream(
  streams: { stream: Stream, addon: { id: string, name: string, logo?: string } }[],
  config: AutoPlayConfig
): { stream: Stream, addon: { id: string, name: string, logo?: string } } | null {
  if (streams.length === 0) return null
  
  // Filter to acceptable streams first
  const acceptable = streams.filter(s => isStreamAcceptable(s.stream, config))
  
  // If no acceptable streams, fall back to all streams
  const candidates = acceptable.length > 0 ? acceptable : streams
  
  // Sort by quality score
  const scored = candidates.map(item => {
    const info = parseStreamInfo(item.stream)
    let score = 0
    
    // Cached streams get high priority if preferCached
    if (config.preferCached && info.isCached) {
      score += 1000
    }
    
    // Resolution score
    score += (RESOLUTION_PRIORITY[info.resolution || 'unknown'] || 0) * 100
    
    // HDR/DV bonus
    if (info.hasHDR) score += 10
    if (info.hasDV) score += 10
    
    return { ...item, score }
  })
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)
  
  return scored[0] || null
}

/**
 * Check if we have a "good enough" stream for early auto-play
 * Returns true if we have a cached stream that meets quality requirements
 */
export function hasGoodStream(
  streams: { stream: Stream, addon: { id: string, name: string, logo?: string } }[],
  config: AutoPlayConfig
): boolean {
  return streams.some(s => {
    const info = parseStreamInfo(s.stream)
    const meetsResolution = isStreamAcceptable(s.stream, config)
    return info.isCached && meetsResolution
  })
}

/**
 * Extract pack identifier from a stream (infoHash or bingeGroup)
 * Used for matching streams from the same torrent pack
 */
export function getPackId(stream: Stream): string | null {
  // Prefer bingeGroup as it's specifically designed for binge-watching continuity
  if (stream.behaviorHints?.bingeGroup) {
    return stream.behaviorHints.bingeGroup
  }
  // Fall back to infoHash for torrent-based streams
  if (stream.infoHash) {
    return stream.infoHash
  }
  return null
}

/**
 * Select the best stream for auto-play with pack priority
 * For series, prioritizes streams from the same pack (infoHash/bingeGroup) as the previously watched stream
 */
export function selectBestStreamWithPackPriority(
  streams: { stream: Stream, addon: { id: string, name: string, logo?: string } }[],
  config: AutoPlayConfig,
  preferredPackId?: string | null
): { stream: Stream, addon: { id: string, name: string, logo?: string } } | null {
  if (streams.length === 0) return null
  
  // If we have a preferred pack, try to find streams from the same pack
  if (preferredPackId) {
    const packMatches = streams.filter(s => {
      const packId = getPackId(s.stream)
      return packId && packId === preferredPackId
    })
    
    if (packMatches.length > 0) {
      // Found streams from the same pack! Select the best among them
      const bestFromPack = selectBestStream(packMatches, config)
      if (bestFromPack) {
        return bestFromPack
      }
    }
  }
  
  // Fall back to best stream overall
  return selectBestStream(streams, config)
}
