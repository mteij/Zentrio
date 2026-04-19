import { useEffect, useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppearanceSettings } from '../../hooks/useAppearanceSettings'
import { apiFetch } from '../../lib/apiFetch'
import type { MetaPreview } from '../../services/addons/types'

async function fetchCatalog({ pageParam = 0, queryKey }: any) {
  const [, profileId, manifestUrl, type, id] = queryKey
  const res = await apiFetch(
    `/api/streaming/catalog?profileId=${profileId}&manifestUrl=${encodeURIComponent(manifestUrl)}&type=${type}&id=${id}&skip=${pageParam}`,
  )
  if (!res.ok) {
    let message = 'Failed to load catalog'
    try {
      const data = await res.json()
      if (data.error) message = data.error
    } catch {
      // Keep default message.
    }
    throw new Error(message)
  }

  const data = await res.json()
  return {
    items: data.items || [],
    title: data.title,
    hasMore: data.items && data.items.length >= 20,
  }
}

export interface CatalogScreenModel {
  status: 'loading' | 'ready' | 'error'
  profileId: string
  title: string
  catalogType: string
  catalogId: string
  items: MetaPreview[]
  ambientImage?: string
  errorMessage?: string
  isRetrying: boolean
  showImdbRatings: boolean
  showAgeRatings: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  retry: () => Promise<unknown>
  loadMore: () => Promise<unknown>
  navigation: {
    goBack: () => void
    openItem: (item: MetaPreview) => void
  }
}

export function useCatalogScreenModel(): CatalogScreenModel {
  const { profileId, manifestUrl, type, id } = useParams<{ profileId: string; manifestUrl: string; type: string; id: string }>()
  const navigate = useNavigate()
  const { showImdbRatings, showAgeRatings } = useAppearanceSettings(profileId)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
    isLoading,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['catalog', profileId, manifestUrl, type, id],
    queryFn: fetchCatalog,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined
      return allPages.reduce((sum, page) => sum + page.items.length, 0)
    },
    initialPageParam: 0,
    enabled: !!profileId && !!manifestUrl && !!type && !!id,
  })

  useEffect(() => {
    if (!profileId || !manifestUrl || !type || !id) {
      navigate('/profiles')
    }
  }, [id, manifestUrl, navigate, profileId, type])

  const items = useMemo(() => {
    const merged = data?.pages.reduce((acc: MetaPreview[], page) => {
      const existingKeys = new Set(acc.map((item) => {
        const season = (item as any).season || 0
        const episode = (item as any).episode || (item as any).number || 0
        return `${item.id}-${season}-${episode}`
      }))

      const uniqueNew = page.items.filter((item: MetaPreview) => {
        const season = (item as any).season || 0
        const episode = (item as any).episode || (item as any).number || 0
        const key = `${item.id}-${season}-${episode}`
        return !existingKeys.has(key)
      })

      return [...acc, ...uniqueNew]
    }, []) || []

    if (merged.length > 0 && merged[0].type === 'series') {
      merged.sort((a, b) => {
        const seasonA = (a as any).season || 0
        const seasonB = (b as any).season || 0
        const episodeA = (a as any).episode || (a as any).number || 0
        const episodeB = (b as any).episode || (b as any).number || 0
        if (seasonA !== seasonB) return seasonA - seasonB
        return episodeA - episodeB
      })
    }

    return merged
  }, [data?.pages])

  const title = data?.pages[0]?.title || `${type === 'movie' ? 'Movies' : 'Series'} - ${id || ''}`

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    if (profileId) {
      navigate(`/streaming/${profileId}`)
      return
    }
    navigate('/profiles')
  }

  return {
    status: isLoading ? 'loading' : error ? 'error' : 'ready',
    profileId: profileId || '',
    title,
    catalogType: type || '',
    catalogId: id || '',
    items,
    ambientImage: items.length > 0 ? (items[0].background || items[0].poster) : undefined,
    errorMessage: error instanceof Error ? error.message : error ? 'Failed to load catalog' : undefined,
    isRetrying: isRefetching,
    showImdbRatings,
    showAgeRatings,
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    retry: refetch,
    loadMore: fetchNextPage,
    navigation: {
      goBack,
      openItem: (item) => navigate(`/streaming/${profileId}/${item.type}/${item.id}`),
    },
  }
}
