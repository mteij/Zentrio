import { useQuery } from '@tanstack/react-query'
import { Filter, Search } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AnimatedBackground, Layout, SkeletonRow } from '../../components'
import { SearchCatalogRow, SearchCatalogRowStatus } from '../../components/features/SearchCatalogRow'
import { useRootScrollPinned } from '../../hooks/useRootScrollPinned'
import { apiFetchJson } from '../../lib/apiFetch'
import styles from '../../styles/Streaming.module.css'

interface SearchCatalogMetadata {
  addon: { id: string; name: string; logo?: string }
  manifestUrl: string
  catalog: { type: string; id: string; name?: string }
  title: string
}

export const StreamingSearch = () => {
  const { profileId } = useParams<{ profileId: string }>()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [rowStatuses, setRowStatuses] = useState<Record<string, SearchCatalogRowStatus>>({})
  const stickyHeader = useRootScrollPinned({ extraTopPx: 10 })
  const inputRef = useRef<HTMLInputElement>(null)
  const hasAutoFocused = useRef(false)

  const query = searchParams.get('q') || ''
  const typeParam = searchParams.get('type') || 'all'
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
        `/api/streaming/search-catalog-metadata?${params.toString()}`
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
    const len = inputRef.current.value.length
    inputRef.current.setSelectionRange(len, len)
  }, [])

  useEffect(() => {
    const focusInput = () => {
      requestAnimationFrame(() => {
        const input = inputRef.current
        if (!input) return
        input.focus()
        const len = input.value.length
        input.setSelectionRange(len, len)
      })
    }

    window.addEventListener('search:focus-input', focusInput)
    return () => window.removeEventListener('search:focus-input', focusInput)
  }, [])

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()

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

  const resolvedRows = useMemo(() => {
    return Object.values(rowStatuses).filter((status) => status.state === 'success' || status.state === 'error').length
  }, [rowStatuses])

  const matchedRows = useMemo(() => {
    return Object.values(rowStatuses).filter((status) => status.itemCount > 0).length
  }, [rowStatuses])

  const firstPreviewImage = useMemo(() => {
    return Object.values(rowStatuses).find((status) => status.previewImage)?.previewImage
  }, [rowStatuses])

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

  return (
    <Layout title="Search" showHeader={false} showFooter={false}>
      <AnimatedBackground
        image={firstPreviewImage}
        fallbackColor="#000"
        opacity={0.4}
      />
      <div className={`${styles.streamingLayout} ${styles.searchLayout}`}>
        <div ref={stickyHeader.sentinelRef} className={styles.stickySentinel} aria-hidden="true" />
        <div className={styles.stickyHeaderShell} style={stickyHeader.spacerStyle}>
          <div
            ref={stickyHeader.headerRef}
            className={`${styles.exploreHeader} ${styles.searchTopBar} ${stickyHeader.isPinned ? styles.exploreHeaderPinned : ''}`}
          >
            <div className={styles.searchInputShell} id="streamingSearchInputShell">
              <Search
                size={18}
                className={styles.searchInputIcon}
              />
              <form onSubmit={handleSearch} id="searchForm" className={styles.searchInputForm}>
                <input
                  ref={inputRef}
                  type="text"
                  name="q"
                  id="searchInput"
                  placeholder="Search movies & series..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  autoComplete="off"
                  className={styles.searchInputField}
                />
              </form>
            </div>

            <div className={styles.searchFilterWrap}>
              <div className={styles.exploreToggleGroup}>
                {(['all', 'movie', 'series'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleFilterChange('type', type)}
                    className={`${styles.exploreToggleBtn} ${typeParam === type ? styles.exploreToggleBtnActive : ''}`}
                  >
                    {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'Series'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className={styles.searchMobileFilterBtn}
                aria-label="Open type filter"
                onClick={() => setMobileFilterOpen(v => !v)}
              >
                <Filter size={16} />
              </button>
            </div>
          </div>
        </div>

        {mobileFilterOpen && (
          <>
            <div
              className={styles.searchMobileFilterBackdrop}
              onClick={() => setMobileFilterOpen(false)}
            />
            <div className={styles.searchMobileFilterMenu}>
              {(['all', 'movie', 'series'] as const).map(type => (
                <button
                  key={`mobile-${type}`}
                  type="button"
                  onClick={() => handleTypeSelect(type)}
                  className={`${styles.searchMobileFilterOption} ${typeParam === type ? styles.searchMobileFilterOptionActive : ''}`}
                >
                  {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'Series'}
                </button>
              ))}
            </div>
          </>
        )}

        <div className={styles.contentContainer}>
          {query && (
            <>
              <h1 className={styles.searchResultsHeading}>
                Results for &quot;{query}&quot;
              </h1>
              {searchStatusText && (
                <p className={styles.searchStatusText}>{searchStatusText}</p>
              )}
            </>
          )}

          {!query ? (
            <div className={styles.searchEmptyState}>
              Start typing to search for movies and series...
            </div>
          ) : isCatalogMetadataLoading ? (
            <div className={styles.catalogRows}>
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonRow key={`search-skeleton-${index}`} />
              ))}
            </div>
          ) : isCatalogMetadataError ? (
            <div className={styles.searchEmptyState}>
              Search sources could not be loaded right now.
            </div>
          ) : (
            <>
              <div className={styles.catalogRows}>
                {searchCatalogs.map((result) => (
                  <SearchCatalogRow
                    key={`${result.manifestUrl}-${result.catalog.type}-${result.catalog.id}`}
                    addon={result.addon}
                    manifestUrl={result.manifestUrl}
                    catalog={result.catalog}
                    title={result.title}
                    query={query}
                    profileId={profileId!}
                    onStatusChange={handleRowStatusChange}
                  />
                ))}
              </div>

              {showNoResults && (
                <div className={styles.searchEmptyState}>
                  No results found for &quot;{query}&quot;.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
