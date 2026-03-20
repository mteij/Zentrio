import { useQueries } from '@tanstack/react-query'
import { Film, Info, Search, Sparkles, Tv } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SearchCatalogRowStatus } from '../../components/features/SearchCatalogRow'
import { TvActionStrip, TvFocusItem, TvSection, TvShelf } from '../../components/tv'
import { apiFetchJson } from '../../lib/apiFetch'
import { sanitizeImgSrc } from '../../lib/url'
import type { MetaPreview } from '../../services/addons/types'
import type { SearchScreenModel } from './Search.model'
import { StreamingTvScaffold } from './StreamingTvScaffold'
import styles from './Search.tv.module.css'

interface SearchResultLane {
  zoneId: string
  title: string
  items: MetaPreview[]
  isLoading: boolean
}

const buildRowKey = (manifestUrl: string, type: string, id: string) => `${manifestUrl}::${type}::${id}`

const fetchSearchCatalogItems = async (
  profileId: string,
  manifestUrl: string,
  type: string,
  id: string,
  query: string,
): Promise<MetaPreview[]> => {
  const params = new URLSearchParams({
    profileId,
    manifestUrl,
    type,
    id,
    q: query,
  })

  const data = await apiFetchJson<{ items: MetaPreview[] }>(`/api/streaming/search-catalog-items?${params.toString()}`)
  return data.items || []
}

function SearchResultCard({
  item,
  id,
  index,
  onActivate,
}: {
  item: MetaPreview
  id: string
  index: number
  onActivate: () => void
}) {
  return (
    <TvFocusItem id={id} index={index} className={styles.resultCard} onActivate={onActivate} aria-label={item.name}>
      <div className={styles.resultPosterShell}>
        {item.poster ? (
          <img src={sanitizeImgSrc(item.poster)} alt={item.name} className={styles.resultPoster} loading="lazy" />
        ) : (
          <div className={styles.resultPoster} aria-hidden="true" />
        )}
        <div className={styles.resultActionOverlay} aria-hidden="true">
          <span className={`${styles.resultActionPill} ${styles.resultActionPrimary}`}>
            <Info size={12} />
            <span>Details</span>
          </span>
        </div>
      </div>
      <div className={styles.resultBody}>
        <p className={styles.resultTitle}>{item.name}</p>
        <p className={styles.resultMeta}>{item.type === 'movie' ? 'Movie' : 'Series'}</p>
      </div>
    </TvFocusItem>
  )
}

function SearchSkeletonRow({
  zoneId,
  nextUp,
  nextDown,
}: {
  zoneId: string
  nextUp?: string
  nextDown?: string
}) {
  return (
    <TvShelf zoneId={zoneId} nextLeft="streaming-rail" nextUp={nextUp} nextDown={nextDown}>
      {Array.from({ length: 5 }).map((_, index) => (
        <TvFocusItem key={`${zoneId}-skeleton-${index}`} id={`${zoneId}-skeleton-${index}`} index={index} className={styles.skeletonCard}>
          <span className={styles.skeletonPoster} aria-hidden="true" />
          <span className={styles.skeletonLine} aria-hidden="true" />
          <span className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} aria-hidden="true" />
        </TvFocusItem>
      ))}
    </TvShelf>
  )
}

export function StreamingSearchTvView({ model }: { model: SearchScreenModel }) {
  const navigate = useNavigate()
  const queryText = model.query.trim()
  const activeFilter = model.typeParam

  const searchResults = useQueries({
    queries: queryText
      ? model.searchCatalogs.map((catalog) => ({
          queryKey: ['tv-search-catalog-items', model.profileId, catalog.manifestUrl, catalog.catalog.type, catalog.catalog.id, queryText],
          queryFn: () => fetchSearchCatalogItems(
            model.profileId,
            catalog.manifestUrl,
            catalog.catalog.type,
            catalog.catalog.id,
            queryText,
          ),
          enabled: Boolean(model.profileId && queryText),
          staleTime: 1000 * 60 * 5,
          gcTime: 1000 * 60 * 20,
          retry: 1,
          refetchOnWindowFocus: false,
        }))
      : [],
  })

  useEffect(() => {
    if (!queryText) return

    model.searchCatalogs.forEach((catalog, index) => {
      const result = searchResults[index]
      if (!result) return

      const rowKey = buildRowKey(catalog.manifestUrl, catalog.catalog.type, catalog.catalog.id)
      const status: SearchCatalogRowStatus = result.isPending
        ? { state: 'loading', itemCount: 0 }
        : result.isError
          ? { state: 'error', itemCount: 0 }
          : {
              state: 'success',
              itemCount: result.data?.length || 0,
              previewImage: result.data?.[0]?.background || result.data?.[0]?.poster,
            }

      model.actions.handleRowStatusChange(rowKey, status)
    })
  }, [model.actions, model.searchCatalogs, queryText, searchResults])

  const resultLanes = useMemo<SearchResultLane[]>(() => {
    if (!queryText) return []

    return model.searchCatalogs
      .map((catalog, index) => {
        const result = searchResults[index]
        const items = result?.data || []
        const isLoading = !result || result.isPending
        const shouldRender = isLoading || items.length > 0

        if (!shouldRender) return null

        return {
          zoneId: `search-lane-${index}`,
          title: catalog.title,
          items,
          isLoading,
        }
      })
      .filter((lane): lane is SearchResultLane => Boolean(lane))
  }, [model.searchCatalogs, queryText, searchResults])

  const controlsNextDown = !queryText
    ? 'search-empty'
    : model.isCatalogMetadataLoading
      ? 'search-loading'
      : resultLanes[0]?.zoneId || (model.searchCatalogs.length === 0 ? 'search-no-catalogs' : 'search-empty')

  const filterItems = [
    { key: 'all' as const, label: 'All', icon: Sparkles },
    { key: 'movie' as const, label: 'Movies', icon: Film },
    { key: 'series' as const, label: 'Series', icon: Tv },
  ]

  return (
    <>
      <StreamingTvScaffold
        profileId={model.profileId}
        activeNav="search"
        title="Search"
        initialZoneId="search-controls"
        hideHeader
        onBack={() => {
          if (window.history.length > 1) {
            navigate(-1)
            return
          }
          navigate(model.profileId ? `/streaming/${model.profileId}` : '/profiles')
        }}
      >
        <div className={styles.searchControls}>
          <div className={styles.searchInputShell}>
            <Search size={18} className={styles.searchInputIcon} />
            <form
              onSubmit={(event) => {
                event.preventDefault()
                model.actions.handleSearch()
              }}
            >
              <input
                ref={model.inputRef}
                type="text"
                placeholder="Search movies and series"
                value={model.inputValue}
                onChange={(event) => model.actions.setInputValue(event.target.value)}
                className={styles.searchInput}
              />
            </form>
          </div>

          <TvActionStrip zoneId="search-controls" nextLeft="streaming-rail" nextDown={controlsNextDown}>
            <TvFocusItem id="search-control-query" className={styles.controlCard} onActivate={model.actions.focusInput}>
              <Search size={18} />
              <span className={styles.controlValue}>{model.inputValue.trim() || 'Edit search'}</span>
            </TvFocusItem>

            {filterItems.map((item) => {
              const Icon = item.icon
              const isActive = activeFilter === item.key
              return (
                <TvFocusItem
                  key={item.key}
                  id={`search-filter-${item.key}`}
                  className={`${styles.filterChip} ${isActive ? styles.filterChipActive : ''}`}
                  onActivate={() => model.actions.handleTypeSelect(item.key)}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </TvFocusItem>
              )
            })}
          </TvActionStrip>
        </div>

        {!queryText ? (
          <TvShelf zoneId="search-empty" nextLeft="streaming-rail" nextUp="search-controls">
            <TvFocusItem id="search-empty-state" className={styles.stateCard} onActivate={model.actions.focusInput}>
              <p className={styles.stateTitle}>Search for a title</p>
            </TvFocusItem>
          </TvShelf>
        ) : model.isCatalogMetadataLoading ? (
          <TvSection title="Results">
            <SearchSkeletonRow zoneId="search-loading" nextUp="search-controls" />
          </TvSection>
        ) : model.isCatalogMetadataError ? (
          <TvShelf zoneId="search-empty" nextLeft="streaming-rail" nextUp="search-controls">
            <TvFocusItem id="search-error-state" className={styles.stateCard}>
              <p className={styles.stateTitle}>Search is unavailable right now</p>
            </TvFocusItem>
          </TvShelf>
        ) : model.searchCatalogs.length === 0 ? (
          <TvShelf zoneId="search-no-catalogs" nextLeft="streaming-rail" nextUp="search-controls">
            <TvFocusItem id="search-no-catalogs-state" className={styles.stateCard}>
              <p className={styles.stateTitle}>No searchable catalogs</p>
            </TvFocusItem>
          </TvShelf>
        ) : resultLanes.length > 0 ? (
          <>
            {resultLanes.map((lane, laneIndex) => {
              const previousZoneId = laneIndex === 0 ? 'search-controls' : resultLanes[laneIndex - 1]?.zoneId
              const nextZoneId = laneIndex < resultLanes.length - 1 ? resultLanes[laneIndex + 1]?.zoneId : undefined

              return (
                <TvSection key={lane.zoneId} title={lane.title}>
                  {lane.isLoading ? (
                    <SearchSkeletonRow zoneId={lane.zoneId} nextUp={previousZoneId} nextDown={nextZoneId} />
                  ) : (
                    <TvShelf zoneId={lane.zoneId} nextLeft="streaming-rail" nextUp={previousZoneId} nextDown={nextZoneId}>
                      {lane.items.map((item, itemIndex) => (
                        <SearchResultCard
                          key={`${lane.zoneId}-${item.type}-${item.id}-${itemIndex}`}
                          id={`${lane.zoneId}-${item.id}-${itemIndex}`}
                          index={itemIndex}
                          item={item}
                          onActivate={() => navigate(`/streaming/${model.profileId}/${item.type}/${item.id}`)}
                        />
                      ))}
                    </TvShelf>
                  )}
                </TvSection>
              )
            })}
          </>
        ) : (
          <TvShelf zoneId="search-empty" nextLeft="streaming-rail" nextUp="search-controls">
            <TvFocusItem id="search-no-results-state" className={styles.stateCard}>
              <p className={styles.stateTitle}>No matches for "{queryText}"</p>
            </TvFocusItem>
          </TvShelf>
        )}
      </StreamingTvScaffold>
    </>
  )
}

export default StreamingSearchTvView
