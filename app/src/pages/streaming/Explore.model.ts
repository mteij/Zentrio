import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { apiFetchJson } from '../../lib/apiFetch'
import { useAppearanceSettings } from '../../hooks/useAppearanceSettings'
import type { MetaPreview } from '../../services/addons/types'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('ExplorePage')

interface ExploreDashboardData {
  trending: MetaPreview[]
  trendingMovies?: MetaPreview[]
  trendingSeries?: MetaPreview[]
  profile: any
}

interface FiltersData {
  filters: { types: string[]; genres: string[] }
}

const POPULAR_GENRES = ['Action', 'Adventure', 'Comedy', 'Science Fiction', 'Drama', 'Thriller', 'Animation', 'Fantasy', 'Crime', 'Mystery', 'Romance', 'Horror', 'Family', 'War', 'History']

export interface ExploreScreenModel {
  profileId: string
  viewMode: 'all' | 'movie' | 'series'
  activeGenre: string | null
  activeType: string | null
  isFilteredView: boolean
  loading: boolean
  filteredItems: MetaPreview[]
  hasMore: boolean
  showHero: boolean
  genres: string[]
  rowGenres: string[]
  trending: MetaPreview[]
  trendingMovies: MetaPreview[]
  trendingSeries: MetaPreview[]
  showImdbRatings: boolean
  showAgeRatings: boolean
  actions: {
    setViewMode: (mode: 'all' | 'movie' | 'series') => void
    updateFilter: (key: string, value: string) => void
    clearFilters: () => void
    loadMore: () => Promise<void>
    openItem: (item: MetaPreview) => void
  }
}

export function useExploreScreenModel(): ExploreScreenModel {
  const { profileId } = useParams<{ profileId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showImdbRatings, showAgeRatings } = useAppearanceSettings()
  const [viewMode, setViewMode] = useState<'all' | 'movie' | 'series'>('all')
  const activeGenre = searchParams.get('genre')
  const activeType = searchParams.get('type')
  const isFilteredView = !!activeGenre || !!activeType
  const shuffledGenres = useMemo(() => [...POPULAR_GENRES].sort(() => 0.5 - Math.random()), [])
  const [filteredItems, setFilteredItems] = useState<MetaPreview[]>([])
  const [loadingFiltered, setLoadingFiltered] = useState(false)
  const [skip, setSkip] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const loadingMoreRef = useRef(false)

  const { data: dashboardData, isLoading: loadingDash } = useQuery({
    queryKey: ['dashboard', profileId],
    queryFn: async () => apiFetchJson<ExploreDashboardData>(`/api/streaming/dashboard?profileId=${profileId}`),
    enabled: !isFilteredView,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })

  const { data: filtersData, isLoading: loadingFilters } = useQuery({
    queryKey: ['filters', profileId],
    queryFn: async () => apiFetchJson<FiltersData>(`/api/streaming/filters?profileId=${profileId}`),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    if (isFilteredView && profileId) {
      setLoadingFiltered(true)
      setFilteredItems([])
      setSkip(0)
      setHasMore(true)

      const fetchFiltered = async () => {
        try {
          const typeParam = activeType || ''
          const genreParam = activeGenre || ''
          const data = await apiFetchJson<{ items: MetaPreview[] }>(
            `/api/streaming/catalog?profileId=${profileId}&type=${typeParam}&genre=${encodeURIComponent(genreParam)}&skip=0`,
          )
          setFilteredItems(data.items || [])
          setSkip(data.items?.length || 0)
          if ((data.items?.length || 0) < 20) setHasMore(false)
        } catch (error) {
          log.error(error)
        } finally {
          setLoadingFiltered(false)
        }
      }

      void fetchFiltered()
    }
  }, [activeGenre, activeType, isFilteredView, profileId])

  const loadMore = async () => {
    if (loadingFiltered || !hasMore || !isFilteredView || loadingMoreRef.current) return
    loadingMoreRef.current = true
    const typeParam = activeType || ''
    const genreParam = activeGenre || ''
    try {
      const data = await apiFetchJson<{ items: MetaPreview[] }>(
        `/api/streaming/catalog?profileId=${profileId}&type=${typeParam}&genre=${encodeURIComponent(genreParam)}&skip=${skip}`,
      )
      if (data.items && data.items.length > 0) {
        setFilteredItems((current) => [...current, ...data.items])
        setSkip((current) => current + data.items.length)
        if (data.items.length < 20) setHasMore(false)
      } else {
        setHasMore(false)
      }
    } catch (error) {
      log.error(error)
    } finally {
      loadingMoreRef.current = false
    }
  }

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    setSearchParams(next)
  }

  const genres = filtersData?.filters?.genres || []
  const displayGenres = genres.length > 0
    ? shuffledGenres.filter((genre) => genres.includes(genre)).concat(genres.filter((genre) => !shuffledGenres.includes(genre)))
    : shuffledGenres
  const rowGenres = displayGenres.slice(0, 8)
  const trending = dashboardData?.trending || []
  const trendingMovies = dashboardData?.trendingMovies || []
  const trendingSeries = dashboardData?.trendingSeries || []

  return {
    profileId: profileId || '',
    viewMode,
    activeGenre,
    activeType,
    isFilteredView,
    loading: (loadingDash && !isFilteredView) || loadingFilters || loadingFiltered,
    filteredItems,
    hasMore,
    showHero: !isFilteredView && trending.length > 0,
    genres,
    rowGenres,
    trending,
    trendingMovies,
    trendingSeries,
    showImdbRatings,
    showAgeRatings,
    actions: {
      setViewMode,
      updateFilter,
      clearFilters: () => {
        setSearchParams({})
        setViewMode('all')
      },
      loadMore,
      openItem: (item) => navigate(`/streaming/${profileId}/${item.type}/${item.id}`),
    },
  }
}
