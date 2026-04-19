import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ContentItem } from '../../components/features/ContentCard'
import { useAutoPlay } from '../../hooks/useAutoPlay'
import { useAppearanceSettings } from '../../hooks/useAppearanceSettings'
import { type CatalogMetadata, useStreamingDashboard } from '../../hooks/useStreamingDashboard'
import type { MetaPreview } from '../../services/addons/types'
import { useAuthStore } from '../../stores/authStore'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('HomeScreenModel')

export type HomeScreenStatus = 'loading' | 'ready' | 'error'

export interface HomeTvItem {
  key: string
  id: string
  type: string
  name: string
  title: string
  metaId: string
  metaType: string
  poster?: string | null
  description?: string | null
  releaseInfo?: string | null
  season?: number
  episode?: number
  lastStream?: unknown
  progressPercent?: number
}

export interface HomeScreenModel {
  status: HomeScreenStatus
  errorMessage?: string
  retry: () => Promise<unknown>
  isRetrying: boolean
  profileId: string
  profileName: string
  greeting: string
  showFallbackToast: boolean
  showImdbRatings: boolean
  showAgeRatings: boolean
  shouldShowHero: boolean
  heroItem?: MetaPreview
  heroItems: MetaPreview[]
  showTrendingHero: boolean
  historyRowItems: ContentItem[]
  catalogMetadata: CatalogMetadata[]
  trendingItems: MetaPreview[]
  continueWatchingItems: HomeTvItem[]
  navigation: {
    goBack: () => void
    goToPath: (path: string) => void
    openMeta: (type: string, id: string) => void
    startContinueWatching: (item: HomeTvItem) => void
  }
}

function hasHeroArtwork(
  item: (Pick<MetaPreview, 'poster'> & { background?: string | null }) | null | undefined
): boolean {
  return Boolean(item && (item.background || item.poster))
}

function normalizeHistoryHeroItem(item: any): MetaPreview {
  return {
    id: item.meta_id,
    type: item.meta_type,
    name: item.title || 'Untitled',
    poster: item.poster,
    background: item.background || item.poster,
    logo: item.logo,
    description: item.description,
    releaseInfo: item.releaseInfo,
    imdbRating: item.imdbRating,
  } as MetaPreview
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatEpisodeLabel(season: unknown, episode: unknown): string | null {
  if (
    typeof season !== 'number' ||
    typeof episode !== 'number' ||
    !Number.isFinite(season) ||
    !Number.isFinite(episode) ||
    season < 0 ||
    episode < 0
  ) {
    return null
  }

  return `Season ${season}, Episode ${episode}`
}

export function useHomeScreenModel(): HomeScreenModel {
  const { profileId } = useParams<{ profileId: string }>()
  const navigate = useNavigate()
  const { startAutoPlay } = useAutoPlay()
  const { showAgeRatings } = useAppearanceSettings(profileId)
  const { data, isLoading, isFetching, error, refetch } = useStreamingDashboard(profileId)

  useEffect(() => {
    const handleHistoryUpdate = () => {
      void refetch()
    }

    window.addEventListener('history-updated', handleHistoryUpdate)
    return () => window.removeEventListener('history-updated', handleHistoryUpdate)
  }, [refetch])

  useEffect(() => {
    if (error?.message === 'Unauthorized') {
      log.debug('401 Unauthorized received, logging out locally...')
      useAuthStore.getState().logout()
      navigate('/')
    }
  }, [error, navigate])

  const heroConfig = useMemo(() => {
    if (!data) return { items: [] as MetaPreview[], showTrending: false }

    const { continueWatchingHero, history, trending } = data

    if (hasHeroArtwork(continueWatchingHero)) {
      return {
        items: [continueWatchingHero].filter(Boolean) as MetaPreview[],
        showTrending: false,
      }
    }

    const firstHistoryWithArtwork = history.find((item) =>
      hasHeroArtwork({
        poster: item.poster,
        background: (item as any).background,
      })
    )

    if (firstHistoryWithArtwork) {
      return {
        items: [normalizeHistoryHeroItem(firstHistoryWithArtwork)],
        showTrending: false,
      }
    }

    const trendingWithArtwork = trending.filter((item) => hasHeroArtwork(item))

    if (trendingWithArtwork.length > 0) {
      return {
        items: trendingWithArtwork,
        showTrending: true,
      }
    }

    return {
      items: [] as MetaPreview[],
      showTrending: false,
    }
  }, [data])

  const historyRowItems = useMemo<ContentItem[]>(() => {
    if (!data) return []

    return data.history.map((item) => ({
      id: item.meta_id,
      type: item.meta_type,
      name: item.title || '',
      poster: item.poster,
      background: (item as any).background,
      logo: (item as any).logo,
      description: (item as any).description,
      releaseInfo: (item as any).releaseInfo,
      imdbRating: (item as any).imdbRating,
      progressPercent: (item as any).progressPercent,
      episodeDisplay: (item as any).episodeDisplay,
      lastStream: (item as any).lastStream,
      season: item.season,
      episode: item.episode,
    }))
  }, [data])

  const continueWatchingItems = useMemo<HomeTvItem[]>(() => {
    if (!data) return []

    return data.history.slice(0, 10).map((item) => {
      const episodeLabel = formatEpisodeLabel(item.season, item.episode)

      return {
        key: `${item.meta_id}-${item.season ?? -1}-${item.episode ?? -1}`,
        id: item.meta_id,
        type: item.meta_type,
        name: item.title || 'Untitled',
        title: item.title || 'Untitled',
        metaId: item.meta_id,
        metaType: item.meta_type,
        poster: item.poster,
        description: episodeLabel,
        meta: episodeLabel,
        releaseInfo: episodeLabel,
        season: item.season,
        episode: item.episode,
        lastStream: (item as any).lastStream || item.last_stream,
        progressPercent: (item as any).progressPercent,
      }
    })
  }, [data])

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/profiles')
  }

  const goToPath = (path: string) => navigate(path)
  const openMeta = (type: string, id: string) => navigate(`/streaming/${profileId}/${type}/${id}`)
  const startContinueWatching = (item: HomeTvItem) => {
    startAutoPlay({
      profileId: profileId || '',
      meta: {
        id: item.id,
        type: item.type,
        name: item.title,
        poster: item.poster || undefined,
      },
      season: item.season,
      episode: item.episode,
      lastStream: item.lastStream as any,
    })
  }

  if (!profileId) {
    return {
      status: 'error',
      errorMessage: 'Missing profile',
      retry: () => Promise.resolve(),
      isRetrying: false,
      profileId: '',
      profileName: 'Profile',
      greeting: getGreeting(),
      showFallbackToast: false,
      showImdbRatings: true,
      showAgeRatings,
      shouldShowHero: false,
      heroItem: undefined,
      heroItems: [],
      showTrendingHero: false,
      historyRowItems: [],
      catalogMetadata: [],
      trendingItems: [],
      continueWatchingItems: [],
      navigation: {
        goBack,
        goToPath,
        openMeta,
        startContinueWatching,
      },
    }
  }

  if (isLoading) {
    return {
      status: 'loading',
      retry: refetch,
      isRetrying: isFetching,
      profileId,
      profileName: 'Profile',
      greeting: getGreeting(),
      showFallbackToast: false,
      showImdbRatings: true,
      showAgeRatings,
      shouldShowHero: false,
      heroItem: undefined,
      heroItems: [],
      showTrendingHero: false,
      historyRowItems: [],
      catalogMetadata: [],
      trendingItems: [],
      continueWatchingItems: [],
      navigation: {
        goBack,
        goToPath,
        openMeta,
        startContinueWatching,
      },
    }
  }

  if (error || !data) {
    return {
      status: 'error',
      errorMessage:
        error?.message && error.message !== 'Failed to load dashboard'
          ? error.message
          : 'Failed to load, try again.',
      retry: refetch,
      isRetrying: isFetching,
      profileId,
      profileName: 'Profile',
      greeting: getGreeting(),
      showFallbackToast: false,
      showImdbRatings: true,
      showAgeRatings,
      shouldShowHero: false,
      heroItem: undefined,
      heroItems: [],
      showTrendingHero: false,
      historyRowItems: [],
      catalogMetadata: [],
      trendingItems: [],
      continueWatchingItems: [],
      navigation: {
        goBack,
        goToPath,
        openMeta,
        startContinueWatching,
      },
    }
  }

  return {
    status: 'ready',
    retry: refetch,
    isRetrying: isFetching,
    errorMessage: undefined,
    profileId,
    profileName: data.profile?.name || 'Profile',
    greeting: getGreeting(),
    showFallbackToast: data.showFallbackToast,
    showImdbRatings: data.profile?.settings?.show_imdb_ratings !== false,
    showAgeRatings,
    shouldShowHero: heroConfig.items.length > 0 && hasHeroArtwork(heroConfig.items[0]),
    heroItem: heroConfig.items[0],
    heroItems: heroConfig.items,
    showTrendingHero: heroConfig.showTrending,
    historyRowItems,
    catalogMetadata: data.catalogMetadata,
    trendingItems: data.trending.slice(0, 10),
    continueWatchingItems,
    navigation: {
      goBack,
      goToPath,
      openMeta,
      startContinueWatching,
    },
  }
}
