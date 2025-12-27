import { useQuery } from '@tanstack/react-query'
import { MetaDetail } from '../services/addons/types'
import { apiFetch } from '../lib/apiFetch'

export interface WatchProgress {
  position: number
  duration: number
  progressPercent: number
  isWatched: boolean
}

export interface SeriesProgress {
  [episodeKey: string]: WatchProgress
}

export interface UseMetaOptions {
  /** Content type (movie, series) */
  type: string
  /** Content ID (IMDB, TMDB, or addon-specific) */
  id: string
  /** Profile ID for the request */
  profileId: string
  /** Fallback metadata for addons without meta resource */
  fallbackMeta?: Partial<MetaDetail>
  /** Whether to enable the query */
  enabled?: boolean
}

export interface UseMetaResult {
  /** Full metadata */
  meta: MetaDetail | null
  /** Whether content is in user's library */
  inLibrary: boolean
  /** Watch progress for movies */
  watchProgress: WatchProgress | null
  /** Watch progress for series episodes */
  seriesProgress: SeriesProgress | null
  /** Last watched episode for series */
  lastWatchedEpisode: { season: number; episode: number } | null
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: Error | null
  /** Refetch function */
  refetch: () => void
}

interface MetaResponse {
  meta: MetaDetail
  inLibrary: boolean
  watchProgress?: WatchProgress
  seriesProgress?: SeriesProgress
  lastWatchedEpisode?: { season: number; episode: number }
}

/**
 * Hook for fetching content metadata with watch progress.
 * Handles fallback metadata for addons that don't provide meta resource.
 */
export function useMeta(options: UseMetaOptions): UseMetaResult {
  const {
    type,
    id,
    profileId,
    fallbackMeta,
    enabled = true
  } = options

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['meta', type, id, profileId],
    queryFn: async () => {
      let url = `/api/streaming/details/${type}/${id}?profileId=${profileId}`
      
      // Include fallback metadata if provided
      if (fallbackMeta) {
        const fallbackParam = encodeURIComponent(JSON.stringify(fallbackMeta))
        url += `&metaFallback=${fallbackParam}`
      }
      
      const res = await apiFetch(url)
      if (!res.ok) {
        throw new Error('Failed to load content metadata')
      }
      return res.json() as Promise<MetaResponse>
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    enabled: enabled && !!type && !!id && !!profileId
  })

  return {
    meta: data?.meta || null,
    inLibrary: data?.inLibrary || false,
    watchProgress: data?.watchProgress || null,
    seriesProgress: data?.seriesProgress || null,
    lastWatchedEpisode: data?.lastWatchedEpisode || null,
    isLoading,
    error: error as Error | null,
    refetch
  }
}

/**
 * Parse fallback metadata from URL search params.
 * Used when navigating from catalog rows that include fallback data.
 */
export function parseFallbackMeta(): Partial<MetaDetail> | undefined {
  if (typeof window === 'undefined') return undefined
  
  const searchParams = new URLSearchParams(window.location.search)
  const fallbackParam = searchParams.get('metaFallback')
  
  if (!fallbackParam) return undefined
  
  try {
    return JSON.parse(decodeURIComponent(fallbackParam))
  } catch {
    return undefined
  }
}
