import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { apiFetchJson } from '../../lib/apiFetch'
import type { SearchCatalogRowStatus } from '../../components/features/SearchCatalogRow'

export interface SearchCatalogMetadata {
  addon: { id: string; name: string; logo?: string }
  manifestUrl: string
  catalog: { type: string; id: string; name?: string }
  title: string
}

export interface SearchScreenModel {
  profileId: string
  query: string
  inputValue: string
  typeParam: 'all' | 'movie' | 'series'
  mobileFilterOpen: boolean
  searchCatalogs: SearchCatalogMetadata[]
  isCatalogMetadataLoading: boolean
  isCatalogMetadataError: boolean
  rowStatuses: Record<string, SearchCatalogRowStatus>
  firstPreviewImage?: string
  searchStatusText: string
  showNoResults: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  actions: {
    setInputValue: (value: string) => void
    handleSearch: (event?: React.FormEvent) => void
    handleFilterChange: (key: string, value: string) => void
    handleTypeSelect: (value: 'all' | 'movie' | 'series') => void
    setMobileFilterOpen: (value: boolean) => void
    focusInput: () => void
    handleRowStatusChange: (rowKey: string, status: SearchCatalogRowStatus) => void
  }
}

export function useSearchScreenModel(): SearchScreenModel {
  const { profileId } = useParams<{ profileId: string }>()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [rowStatuses, setRowStatuses] = useState<Record<string, SearchCatalogRowStatus>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const hasAutoFocused = useRef(false)
  const query = searchParams.get('q') || ''
  const typeParam = (searchParams.get('type') || 'all') as 'all' | 'movie' | 'series'
  const shouldAutoFocusRef = useRef(Boolean(location.state?.focusSearch))
  const [inputValue, setInputValue] = useState(query)

  const { data: searchCatalogs = [], isLoading: isCatalogMetadataLoading, isError: isCatalogMetadataError } = useQuery({
    queryKey: ['search-catalog-metadata', profileId, typeParam],
    queryFn: async () => {
      const params = new URLSearchParams({ profileId: profileId! })
      if (typeParam && typeParam !== 'all') {
        params.set('type', typeParam)
      }

      const data = await apiFetchJson<{ catalogs: SearchCatalogMetadata[] }>(
        `/api/streaming/search-catalog-metadata?${params.toString()}`,
      )

      return data.catalogs || []
    },
    enabled: !!profileId,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  useLayoutEffect(() => {
    if (!shouldAutoFocusRef.current || !inputRef.current || hasAutoFocused.current) return

    hasAutoFocused.current = true
    inputRef.current.focus()
    const length = inputRef.current.value.length
    inputRef.current.setSelectionRange(length, length)
  }, [])

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      const length = input.value.length
      input.setSelectionRange(length, length)
    })
  }, [])

  useEffect(() => {
    window.addEventListener('search:focus-input', focusInput)
    return () => window.removeEventListener('search:focus-input', focusInput)
  }, [focusInput])

  useEffect(() => {
    setInputValue(query)
  }, [query])

  useEffect(() => {
    setRowStatuses({})
  }, [profileId, query, typeParam])

  useEffect(() => {
    if (!profileId) {
      navigate('/profiles')
    }
  }, [navigate, profileId])

  useEffect(() => {
    if (inputValue === query) return

    const timer = setTimeout(() => {
      const newParams = new URLSearchParams(searchParams)
      if (inputValue.trim()) {
        newParams.set('q', inputValue)
      } else {
        newParams.delete('q')
      }
      setSearchParams(newParams, { replace: true })
    }, 300)

    return () => clearTimeout(timer)
  }, [inputValue, query, searchParams, setSearchParams])

  const handleRowStatusChange = useCallback((rowKey: string, status: SearchCatalogRowStatus) => {
    setRowStatuses((prev) => {
      const current = prev[rowKey]
      if (
        current?.state === status.state &&
        current?.itemCount === status.itemCount &&
        current?.previewImage === status.previewImage
      ) {
        return prev
      }

      return {
        ...prev,
        [rowKey]: status,
      }
    })
  }, [])

  const handleSearch = () => {
    const newParams = new URLSearchParams(searchParams)
    if (inputValue.trim()) {
      newParams.set('q', inputValue)
    } else {
      newParams.delete('q')
    }
    setSearchParams(newParams, { replace: true })
  }

  const handleFilterChange = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (value && value !== 'all') {
      newParams.set(key, value)
    } else {
      newParams.delete(key)
    }
    setSearchParams(newParams, { replace: true })
  }

  const handleTypeSelect = (value: 'all' | 'movie' | 'series') => {
    handleFilterChange('type', value)
    setMobileFilterOpen(false)
  }

  const resolvedRows = useMemo(
    () => Object.values(rowStatuses).filter((status) => status.state === 'success' || status.state === 'error').length,
    [rowStatuses],
  )
  const matchedRows = useMemo(
    () => Object.values(rowStatuses).filter((status) => status.itemCount > 0).length,
    [rowStatuses],
  )

  const firstPreviewImage = useMemo(
    () => Object.values(rowStatuses).find((status) => status.previewImage)?.previewImage,
    [rowStatuses],
  )

  const allRowsResolved = query.trim().length > 0 && searchCatalogs.length > 0 && resolvedRows >= searchCatalogs.length
  const hasMatches = matchedRows > 0

  const showNoResults =
    query.trim().length > 0 &&
    !isCatalogMetadataLoading &&
    !isCatalogMetadataError &&
    (
      searchCatalogs.length === 0 ||
      (searchCatalogs.length > 0 && allRowsResolved && !hasMatches)
    )

  const searchStatusText = useMemo(() => {
    if (!query.trim()) return ''
    if (isCatalogMetadataError) return 'Search sources could not be loaded right now.'
    if (isCatalogMetadataLoading) return 'Preparing search sources...'
    if (searchCatalogs.length === 0) return 'No searchable catalogs are available for this filter.'
    if (!allRowsResolved && hasMatches) {
      return `Showing matches as they arrive from ${searchCatalogs.length} catalogs.`
    }
    if (!allRowsResolved) {
      return `Searching ${searchCatalogs.length} catalogs...`
    }
    if (hasMatches) {
      return matchedRows === 1
        ? 'Found matches in 1 catalog.'
        : `Found matches in ${matchedRows} catalogs.`
    }
    return ''
  }, [allRowsResolved, hasMatches, isCatalogMetadataError, isCatalogMetadataLoading, matchedRows, query, searchCatalogs.length])

  return {
    profileId: profileId || '',
    query,
    inputValue,
    typeParam,
    mobileFilterOpen,
    searchCatalogs,
    isCatalogMetadataLoading,
    isCatalogMetadataError,
    rowStatuses,
    firstPreviewImage,
    searchStatusText,
    showNoResults,
    inputRef,
    actions: {
      setInputValue,
      handleSearch,
      handleFilterChange,
      handleTypeSelect,
      setMobileFilterOpen,
      focusInput,
      handleRowStatusChange,
    },
  }
}
