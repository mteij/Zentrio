import { useQuery } from '@tanstack/react-query'
import { MetaPreview } from '../services/addons/types'
import { apiFetchJson } from '../lib/apiFetch'
import { getAddonClient, ZENTRIO_TMDB_ADDON } from '../lib/addon-client'

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
 * Applies server-side parental filtering and watch history enrichment to client-fetched items.
 */
async function filterAndEnrich(items: MetaPreview[], profileId: string): Promise<MetaPreview[]> {
  if (items.length === 0) return items
  try {
    const result = await apiFetchJson<{ items: MetaPreview[] }>('/api/streaming/filter-enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, profileId: parseInt(profileId) }),
    })
    return result.items ?? items
  } catch {
    // On failure return unfiltered — parental filtering is enforced server-side on other paths too
    return items
  }
}

/**
 * Hook for fetching catalog items from addons.
 *
 * Routing logic:
 * - manifestUrl = 'zentrio://tmdb-addon' → /api/tmdb/catalog/:type/:id (server injects API key)
 * - manifestUrl = real HTTPS URL → ClientAddonClient fetches directly from the addon URL
 *   (Tauri: direct HTTP, Web: direct fetch first with temporary /api/addon-proxy fallback), then server applies
 *   parental filter + watch history enrichment via /api/streaming/filter-enrich
 * - no manifestUrl (genre/type filter) → /api/streaming/catalog (server-side, profile-aware)
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

  const queryKey = manifestUrl
    ? ['catalog-items', profileId, manifestUrl, type, catalogId]
    : ['catalog', profileId, type, genre, skip]

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (manifestUrl && type && catalogId) {
        const isTmdbAddon = manifestUrl === ZENTRIO_TMDB_ADDON || manifestUrl.startsWith('zentrio://')

        if (isTmdbAddon) {
          // TMDB addon: go through server proxy so the API key stays secret
          const data = await apiFetchJson<{ metas: MetaPreview[] }>(
            `/api/tmdb/catalog/${type}/${catalogId}?profileId=${profileId}`
          )
          const items = data.metas || []
          const enriched = await filterAndEnrich(items, profileId)
          return { items: enriched, hasMore: false }
        } else {
          // Third-party Stremio addon: fetch directly from client
          const extra: Record<string, string> = {}
          if (genre) extra.genre = genre
          if (skip > 0) extra.skip = skip.toString()

          const client = getAddonClient(manifestUrl)
          const items = await client.getCatalog(type, catalogId, extra)
          const enriched = await filterAndEnrich(items, profileId)
          return { items: enriched, hasMore: items.length >= 20 }
        }
      } else {
        // Generic catalog query (genre/type filter, no specific addon).
        // Server-side because it needs to know which addons the profile has enabled.
        const params = new URLSearchParams({ profileId })
        if (type) params.set('type', type)
        if (genre) params.set('genre', genre)
        if (skip > 0) params.set('skip', skip.toString())

        const data = await apiFetchJson<{ items: MetaPreview[] }>(`/api/streaming/catalog?${params}`)
        const items = data.items || []
        return { items, hasMore: items.length >= 20 }
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
