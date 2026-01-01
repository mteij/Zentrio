/**
 * Portions of this code are derived from the TMDB Addon project.
 * Original source: https://github.com/mrcanelas/tmdb-addon
 * Licensed under Apache License 2.0
 */
import { userDb } from '../database'
import { decrypt } from '../encryption'
import { tmdbCache, type CacheType } from './cache'

const TMDB_API_BASE = 'https://api.themoviedb.org/3'

// Global client singleton (uses TMDB_API_KEY from env)
let globalClient: TMDBClient | null = null

export class TMDBClient {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  /**
   * Determine cache type based on endpoint
   */
  private getCacheType(endpoint: string): CacheType {
    if (endpoint.includes('/search/')) return 'SEARCH'
    if (endpoint.includes('/trending/')) return 'TRENDING'
    if (endpoint.includes('/season/') || endpoint.includes('/episode')) return 'EPISODES'
    if (endpoint.includes('/release_dates') || endpoint.includes('/content_ratings')) return 'AGE_RATING'
    if (endpoint.includes('/find/')) return 'FIND'
    if (endpoint.includes('/genre/')) return 'GENRES'
    if (endpoint.includes('/languages') || endpoint.includes('/translations')) return 'LANGUAGES'
    return 'METADATA'
  }

  private async fetch<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    // Check cache first
    const cached = tmdbCache.get<T>(endpoint, params)
    if (cached !== null) {
      return cached
    }

    const url = new URL(`${TMDB_API_BASE}${endpoint}`)
    url.searchParams.append('api_key', this.apiKey)
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value))
      }
    })

    const response = await fetch(url.toString())
    if (!response.ok) {
      throw new Error(`TMDB API Error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as T

    // Store in cache
    const cacheType = this.getCacheType(endpoint)
    tmdbCache.set(endpoint, params, data, cacheType)

    return data
  }

  async getMovieReleaseDates(id: string) {
    return this.fetch<any>(`/movie/${id}/release_dates`)
  }

  async getTvContentRatings(id: string) {
    return this.fetch<any>(`/tv/${id}/content_ratings`)
  }

  async getMovieInfo(id: string, language: string) {
    return this.fetch<any>(`/movie/${id}`, {
      language,
      append_to_response: 'videos,credits,external_ids'
    })
  }

  async getTvInfo(id: string, language: string) {
    return this.fetch<any>(`/tv/${id}`, {
      language,
      append_to_response: 'videos,credits,external_ids'
    })
  }

  async movieInfo(params: { id: string; language?: string; append_to_response?: string }) {
    return this.fetch<any>(`/movie/${params.id}`, {
      language: params.language,
      append_to_response: params.append_to_response
    })
  }

  async tvInfo(params: { id: string; language?: string; append_to_response?: string }) {
    return this.fetch<any>(`/tv/${params.id}`, {
      language: params.language,
      append_to_response: params.append_to_response
    })
  }

  async collectionInfo(params: { id: string; language?: string }) {
    return this.fetch<any>(`/collection/${params.id}`, {
      language: params.language
    })
  }

  async movieReleaseDates(params: { id: string }) {
    return this.fetch<any>(`/movie/${params.id}/release_dates`)
  }

  async tvContentRatings(params: { id: string }) {
    return this.fetch<any>(`/tv/${params.id}/content_ratings`)
  }

  async trending(params: { media_type: string; time_window: string; language?: string; page?: number }) {
    return this.fetch<any>(`/trending/${params.media_type}/${params.time_window}`, {
      language: params.language,
      page: params.page
    })
  }

  async searchMovie(params: { query: string; language?: string; include_adult?: boolean; page?: number; year?: number; primary_release_year?: number }) {
    return this.fetch<any>(`/search/movie`, params)
  }

  async searchTv(params: { query: string; language?: string; include_adult?: boolean; page?: number; first_air_date_year?: number }) {
    return this.fetch<any>(`/search/tv`, params)
  }

  async searchPerson(params: { query: string; language?: string; page?: number; include_adult?: boolean }) {
    return this.fetch<any>(`/search/person`, params)
  }

  async personMovieCredits(params: { id: string; language?: string }) {
    return this.fetch<any>(`/person/${params.id}/movie_credits`, {
      language: params.language
    })
  }

  async personTvCredits(params: { id: string; language?: string }) {
    return this.fetch<any>(`/person/${params.id}/tv_credits`, {
      language: params.language
    })
  }

  async movieImages(params: { id: string; language?: string; include_image_language?: string }) {
    return this.fetch<any>(`/movie/${params.id}/images`, {
      language: params.language,
      include_image_language: params.include_image_language
    })
  }

  async tvImages(params: { id: string; language?: string; include_image_language?: string }) {
    return this.fetch<any>(`/tv/${params.id}/images`, {
      language: params.language,
      include_image_language: params.include_image_language
    })
  }

  async episodeGroup(params: { id: string; language?: string }) {
    return this.fetch<any>(`/episode_group/${params.id}`, {
      language: params.language
    })
  }

  async discoverMovie(params: Record<string, any>) {
    return this.fetch<any>(`/discover/movie`, params)
  }

  async discoverTv(params: Record<string, any>) {
    return this.fetch<any>(`/discover/tv`, params)
  }

  async find(params: { id: string; external_source: string; language?: string }) {
    return this.fetch<any>(`/find/${params.id}`, {
      external_source: params.external_source,
      language: params.language
    })
  }

  async genreMovieList(params: { language?: string }) {
    return this.fetch<any>(`/genre/movie/list`, {
      language: params.language
    })
  }

  async genreTvList(params: { language?: string }) {
    return this.fetch<any>(`/genre/tv/list`, {
      language: params.language
    })
  }

  async primaryTranslations() {
    return this.fetch<any>(`/configuration/primary_translations`)
  }

  async languages() {
    return this.fetch<any>(`/configuration/languages`)
  }
}

/**
 * Get the global TMDB client using the server's TMDB_API_KEY.
 * This is the primary way to get a client - always available.
 */
export function getGlobalClient(): TMDBClient {
  if (!globalClient) {
    const apiKey = process.env.TMDB_API_KEY
    if (!apiKey) {
      throw new Error('TMDB_API_KEY environment variable is required')
    }
    globalClient = new TMDBClient(apiKey)
  }
  return globalClient
}

/**
 * Check if the global TMDB API key is configured
 */
export function hasGlobalTmdbKey(): boolean {
  return !!process.env.TMDB_API_KEY
}

/**
 * Get a TMDB client for a specific user.
 * - If user has their own API key configured, use it (for rate limit avoidance)
 * - Otherwise, fall back to global client (always available)
 * 
 * This function now NEVER returns null when a global key is configured.
 */
export const getClient = async (userId?: string): Promise<TMDBClient> => {
  // Try user's personal key first (if they want to avoid rate limits)
  if (userId) {
    const user = userDb.findById(userId)
    if (user?.tmdbApiKey) {
      try {
        const apiKey = decrypt(user.tmdbApiKey)
        if (apiKey && apiKey.length >= 32) {
          return new TMDBClient(apiKey)
        }
      } catch (error) {
        console.warn('Failed to decrypt user TMDB API key, falling back to global:', error)
      }
    }
  }

  // Fall back to global client
  return getGlobalClient()
}

/**
 * Known blocked/test API keys that should not be allowed
 */
const BLOCKED_API_KEYS = new Set([
  'test',
  'demo',
  'example',
  'your_api_key',
  'your-api-key',
  'api_key',
  'apikey',
  '00000000000000000000000000000000',
  'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
])

/**
 * Check if an API key is a known test/demo key that should be blocked
 */
export function isBlockedTmdbKey(apiKey: string): boolean {
  const normalizedKey = apiKey.trim().toLowerCase()
  
  // Check against known blocked keys
  if (BLOCKED_API_KEYS.has(normalizedKey)) {
    return true
  }
  
  // Block keys that are too short (TMDB keys are 32 chars)
  if (normalizedKey.length < 32) {
    return true
  }
  
  // Block keys that are all the same character
  if (/^(.)\1+$/.test(normalizedKey)) {
    return true
  }
  
  return false
}

/**
 * Validate a TMDB API key by making a test request to the TMDB API
 */
export async function validateTmdbApiKey(apiKey: string): Promise<boolean> {
  try {
    // Use the authentication endpoint - lightweight and reliable
    const url = `${TMDB_API_BASE}/authentication?api_key=${encodeURIComponent(apiKey)}`
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })
    
    // TMDB returns 401 for invalid keys
    return response.ok
  } catch (error) {
    console.error('Failed to validate TMDB API key:', error)
    return false
  }
}
