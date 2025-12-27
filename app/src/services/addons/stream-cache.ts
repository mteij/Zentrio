/**
 * Stream Cache - In-memory caching for stream results
 * Short TTL since debrid service links can expire quickly
 */

import { Stream } from './types'

export interface CachedStream {
  stream: Stream
  addon: { id: string; name: string; logo?: string }
}

export interface CachedStreamResult {
  key: string
  streams: CachedStream[]
  timestamp: number
  isComplete: boolean
  addonsFetched: string[]
}

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

export class StreamCache {
  private cache = new Map<string, CachedStreamResult>()
  private ttlMs: number

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs
  }

  /**
   * Build cache key from stream request params
   */
  static buildKey(
    type: string,
    id: string,
    profileId: number,
    season?: number,
    episode?: number
  ): string {
    const base = `${type}:${id}:${profileId}`
    if (season !== undefined && episode !== undefined) {
      return `${base}:${season}:${episode}`
    }
    return base
  }

  /**
   * Get cached streams if valid
   */
  get(key: string): CachedStreamResult | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    const age = Date.now() - cached.timestamp
    if (age > this.ttlMs) {
      this.cache.delete(key)
      return null
    }

    return cached
  }

  /**
   * Get cache age in milliseconds
   */
  getAge(key: string): number | null {
    const cached = this.cache.get(key)
    if (!cached) return null
    return Date.now() - cached.timestamp
  }

  /**
   * Store streams in cache
   */
  set(key: string, streams: CachedStream[], isComplete: boolean, addonsFetched: string[]): void {
    this.cache.set(key, {
      key,
      streams,
      timestamp: Date.now(),
      isComplete,
      addonsFetched
    })
  }

  /**
   * Update partial result (for progressive loading)
   */
  update(key: string, streams: CachedStream[], addonId: string): void {
    const existing = this.cache.get(key)
    if (existing) {
      existing.streams = streams
      existing.addonsFetched = [...new Set([...existing.addonsFetched, addonId])]
    } else {
      this.set(key, streams, false, [addonId])
    }
  }

  /**
   * Mark cache entry as complete
   */
  markComplete(key: string): void {
    const existing = this.cache.get(key)
    if (existing) {
      existing.isComplete = true
    }
  }

  /**
   * Invalidate specific cache entry (for manual refresh)
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Invalidate all entries for a specific meta (type + id)
   */
  invalidateByMeta(type: string, id: string): void {
    const prefix = `${type}:${id}:`
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix) || key === `${type}:${id}`) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.ttlMs) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Update TTL (for settings change)
   */
  setTtl(ttlMs: number): void {
    this.ttlMs = ttlMs
  }

  /**
   * Get cache statistics
   */
  get stats(): { size: number; ttlMs: number } {
    return {
      size: this.cache.size,
      ttlMs: this.ttlMs
    }
  }
}

// Singleton instance
export const streamCache = new StreamCache()
