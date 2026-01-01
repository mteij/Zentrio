import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { MetaPreview } from '../services/addons/types'
import { apiFetchJson } from '../lib/apiFetch'

export interface UseCatalogOptions {
  /** Profile ID for the request */
  profileId: string
  /** Addon manifest URL (for specific addon catalogs) */
  manifestUrl?: string
  /** Content type (movie, series, or comma-separated) */
  type?: string
  /** Catalog ID */
  catalogId?: string
  /** Genre filter */
  genre?: string
  /** Number of items to skip (for pagination) */
  skip?: number
  /** Whether to enable the query */
  enabled?: boolean
  /** Cache time in ms (default: 5 minutes) */
  staleTime?: number
}

export interface UseCatalogResult {
  /** Catalog items */
  items: MetaPreview[]
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: Error | null
  /** Refetch function */
  refetch: () => void
  /** Whether more items are available */
  hasMore: boolean
}

/**
 * Hook for fetching catalog items from the streaming API.
 * Supports both specific addon catalogs and filtered catalog queries.
 */
export function useCatalog(options: UseCatalogOptions): UseCatalogResult {
  const {
    profileId,
    manifestUrl,
    type,
    catalogId,
    genre,
    skip = 0,
    enabled = true,
    staleTime = 5 * 60 * 1000
  } = options

  // Build query key based on parameters
  const queryKey = manifestUrl
    ? ['catalog-items', profileId, manifestUrl, type, catalogId]
    : ['catalog', profileId, type, genre, skip]

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (manifestUrl && type && catalogId) {
        // Specific addon catalog
        const params = new URLSearchParams({
          profileId,
          manifestUrl,
          type,
          id: catalogId
        })
        const data = await apiFetchJson<{ items: MetaPreview[] }>(`/api/streaming/catalog-items?${params}`)
        return { items: data.items || [], hasMore: false }
      } else {
        // Generic catalog query with filters
        const params = new URLSearchParams({ profileId })
        if (type) params.set('type', type)
        if (genre) params.set('genre', genre)
        if (skip > 0) params.set('skip', skip.toString())
        
        const data = await apiFetchJson<{ items: MetaPreview[] }>(`/api/streaming/catalog?${params}`)
        const items = data.items || []
        return { 
          items, 
          hasMore: items.length >= 20 
        }
      }
    },
    staleTime,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: enabled && !!profileId
  })

  return {
    items: data?.items || [],
    isLoading,
    error: error as Error | null,
    refetch,
    hasMore: data?.hasMore ?? true
  }
}
