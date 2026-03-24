import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/apiFetch'
import { MetaPreview } from '../services/addons/types'
import type { WatchHistoryItem } from '../services/database'
import { createLogger } from '../utils/client-logger'

const log = createLogger('StreamingDashboard')

export interface CatalogMetadata {
  addon: { id: string; name: string; logo?: string }
  manifestUrl: string
  catalog: { type: string; id: string; name?: string }
  title: string
  seeAllUrl: string
}

export interface DashboardData {
  catalogMetadata: CatalogMetadata[]
  history: WatchHistoryItem[]
  continueWatchingHero?: MetaPreview | null
  trending: MetaPreview[]
  showFallbackToast: boolean
  profile: any
}

export const fetchDashboard = async (profileId: string) => {
  log.debug('fetchDashboard called for:', profileId)
  const res = await apiFetch(`/api/streaming/dashboard?profileId=${profileId}`)
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Unauthorized')
    }
    throw new Error('Failed to load dashboard')
  }
  return res.json() as Promise<DashboardData>
}

export function useStreamingDashboard(profileId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard', profileId],
    queryFn: () => fetchDashboard(profileId!),
    enabled: !!profileId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: (failureCount, error) => {
      if (error.message === 'Unauthorized') return false
      return failureCount < 2
    },
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
}
