/**
 * TMDB API Response Cache
 * 
 * TTL-based in-memory cache with LRU eviction to minimize TMDB API calls
 * and prevent rate limiting.
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

// Cache durations in milliseconds
const CACHE_TTL = {
  METADATA: 24 * 60 * 60 * 1000,      // 24 hours - movie/TV info rarely changes
  SEARCH: 60 * 60 * 1000,              // 1 hour - balance freshness
  TRENDING: 15 * 60 * 1000,            // 15 minutes - updates frequently
  EPISODES: 6 * 60 * 60 * 1000,        // 6 hours - episode data rarely changes
  AGE_RATING: 24 * 60 * 60 * 1000,     // 24 hours - ratings don't change
  FIND: 24 * 60 * 60 * 1000,           // 24 hours - ID mappings are permanent
  GENRES: 7 * 24 * 60 * 60 * 1000,     // 7 days - genre lists rarely change
  LANGUAGES: 7 * 24 * 60 * 60 * 1000,  // 7 days - language lists rarely change
} as const

type CacheType = keyof typeof CACHE_TTL

const MAX_CACHE_SIZE = 2000

class TMDBCache {
  private cache = new Map<string, CacheEntry<any>>()
  private accessOrder: string[] = [] // For LRU tracking

  /**
   * Generate a cache key from endpoint and parameters
   */
  private generateKey(endpoint: string, params: Record<string, any> = {}): string {
    const sortedParams = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&')
    return `${endpoint}?${sortedParams}`
  }

  /**
   * Get cached data if valid
   */
  get<T>(endpoint: string, params: Record<string, any> = {}): T | null {
    const key = this.generateKey(endpoint, params)
    const entry = this.cache.get(key)

    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.accessOrder = this.accessOrder.filter(k => k !== key)
      return null
    }

    // Update access order for LRU
    this.accessOrder = this.accessOrder.filter(k => k !== key)
    this.accessOrder.push(key)

    return entry.data as T
  }

  /**
   * Store data in cache with TTL
   */
  set<T>(endpoint: string, params: Record<string, any>, data: T, type: CacheType): void {
    const key = this.generateKey(endpoint, params)

    // LRU eviction if cache is full
    while (this.cache.size >= MAX_CACHE_SIZE && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift()!
      this.cache.delete(oldestKey)
    }

    const ttl = CACHE_TTL[type]
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl
    })
    this.accessOrder.push(key)
  }

  /**
   * Check if key exists and is valid
   */
  has(endpoint: string, params: Record<string, any> = {}): boolean {
    return this.get(endpoint, params) !== null
  }

  /**
   * Clear all cache or specific entries
   */
  clear(pattern?: string): void {
    if (!pattern) {
      this.cache.clear()
      this.accessOrder = []
      return
    }

    const keysToDelete: string[] = []
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key)
      this.accessOrder = this.accessOrder.filter(k => k !== key)
    }
  }

  /**
   * Get cache stats for debugging
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: MAX_CACHE_SIZE
    }
  }
}

// Singleton cache instance
export const tmdbCache = new TMDBCache()

// Export cache types for use in client
export { CACHE_TTL, type CacheType }
