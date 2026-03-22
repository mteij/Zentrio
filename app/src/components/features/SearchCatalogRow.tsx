import { memo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { MetaPreview } from '../../services/addons/types'
import { ContentCard, ContentItem } from './ContentCard'
import { SkeletonCard } from '../ui/SkeletonCard'
import { useRowPosterPreload } from '../../hooks/useRowPosterPreload'
import { useScrollRow } from '../../hooks/useScrollRow'
import { apiFetchJson } from '../../lib/apiFetch'
import styles from '../../styles/Streaming.module.css'

export interface SearchCatalogRowStatus {
  itemCount: number
  previewImage?: string
  state: 'loading' | 'success' | 'error'
}

interface SearchCatalogRowProps {
  addon: { id: string; name: string; logo?: string }
  manifestUrl: string
  catalog: { type: string; id: string; name?: string }
  title: string
  query: string
  profileId: string
  showImdbRatings?: boolean
  showAgeRatings?: boolean
  onStatusChange?: (rowKey: string, status: SearchCatalogRowStatus) => void
}

const buildRowKey = (manifestUrl: string, type: string, id: string) => `${manifestUrl}::${type}::${id}`

const fetchSearchCatalogItems = async (
  profileId: string,
  manifestUrl: string,
  type: string,
  id: string,
  query: string
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

export const SearchCatalogRow = memo(function SearchCatalogRow({
  addon,
  manifestUrl,
  catalog,
  title,
  query,
  profileId,
  showImdbRatings = true,
  showAgeRatings = true,
  onStatusChange,
}: SearchCatalogRowProps) {
  const rowKey = buildRowKey(manifestUrl, catalog.type, catalog.id)

  const {
    data: items = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['search-catalog-items', profileId, manifestUrl, catalog.type, catalog.id, query],
    queryFn: () => fetchSearchCatalogItems(profileId, manifestUrl, catalog.type, catalog.id, query),
    enabled: Boolean(profileId && query.trim()),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 20,
    retry: 1,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!query.trim()) return

    if (isLoading) {
      onStatusChange?.(rowKey, { state: 'loading', itemCount: 0 })
      return
    }

    if (isError) {
      onStatusChange?.(rowKey, { state: 'error', itemCount: 0 })
      return
    }

    onStatusChange?.(rowKey, {
      state: 'success',
      itemCount: items.length,
      previewImage: items[0]?.background || items[0]?.poster,
    })
  }, [isError, isLoading, items, onStatusChange, query, rowKey])

  const {
    containerRef,
    showLeftArrow,
    showRightArrow,
    isDown,
    scroll,
    handlers,
    isDragging
  } = useScrollRow({ items })

  useRowPosterPreload({
    containerRef,
    items,
    enabled: !isLoading && items.length > 0,
  })

  const handleItemClick = (e: React.MouseEvent, _item: ContentItem) => {
    if (isDragging()) {
      e.preventDefault()
      e.stopPropagation()
      return false
    }
  }

  if (!query.trim()) return null
  if (isError || (!isLoading && items.length === 0)) return null

  return (
    <div className={styles.contentRow}>
      <div className={styles.rowHeader}>
        <h2 className={styles.rowTitle}>{title || `${addon.name} - ${catalog.type}`}</h2>
      </div>
      <div className={styles.rowWrapper}>
        <button
          className={`${styles.scrollBtn} ${styles.scrollBtnLeft} ${!showLeftArrow ? styles.scrollBtnHidden : ''}`}
          onClick={() => scroll('left')}
        >
          <ChevronLeft size={24} />
        </button>

        <div
          className={styles.rowScrollContainer}
          data-row-scroll-container="true"
          ref={containerRef}
          {...handlers}
          style={{ cursor: isLoading ? 'default' : (isDown ? 'grabbing' : 'grab'), userSelect: 'none' }}
        >
          {isLoading ? (
            <motion.div initial={{ opacity: 1 }} style={{ display: 'flex', gap: '20px' }}>
              {Array.from({ length: 7 }).map((_, index) => (
                <SkeletonCard key={`${rowKey}-skeleton-${index}`} />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="items"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'flex', gap: '20px' }}
            >
              {items.map((item, index) => (
                <motion.div
                  key={`${item.id}-${index}-${item.type}-${item.name}`.replace(/\s+/g, '-').toLowerCase()}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.25,
                    delay: Math.min(index * 0.02, 0.14)
                  }}
                  className={styles.cardWrapper}
                  data-row-card="true"
                >
                  <ContentCard
                    item={item as ContentItem}
                    profileId={profileId}
                    showImdbRatings={showImdbRatings}
                    showAgeRatings={showAgeRatings}
                    onDragStart={handlers.onDragStart}
                    onClick={handleItemClick}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>

        <button
          className={`${styles.scrollBtn} ${styles.scrollBtnRight} ${!showRightArrow ? styles.scrollBtnHidden : ''}`}
          onClick={() => scroll('right')}
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.addon.id === nextProps.addon.id &&
    prevProps.manifestUrl === nextProps.manifestUrl &&
    prevProps.catalog.id === nextProps.catalog.id &&
    prevProps.catalog.type === nextProps.catalog.type &&
    prevProps.title === nextProps.title &&
    prevProps.query === nextProps.query &&
    prevProps.profileId === nextProps.profileId &&
    prevProps.showImdbRatings === nextProps.showImdbRatings &&
    prevProps.showAgeRatings === nextProps.showAgeRatings &&
    prevProps.onStatusChange === nextProps.onStatusChange
  )
})
