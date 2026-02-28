import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { MetaPreview } from '../../services/addons/types'
import { ContentCard, ContentItem } from './ContentCard'
import { SkeletonCard } from '../ui/SkeletonCard'
import { useScrollRow } from '../../hooks/useScrollRow'
import { apiFetchJson } from '../../lib/apiFetch'
import styles from '../../styles/Streaming.module.css'

interface CatalogMetadata {
  addon: { id: string; name: string; logo?: string }
  manifestUrl: string
  catalog: { type: string; id: string; name?: string }
  title: string
  seeAllUrl: string
}

interface LazyCatalogRowProps {
  metadata: CatalogMetadata
  profileId: string
  showImdbRatings?: boolean
  showAgeRatings?: boolean
  priority?: 'eager' | 'lazy'
}

const fetchCatalogItems = async (
  profileId: string,
  manifestUrl: string,
  type: string,
  id: string
): Promise<MetaPreview[]> => {
  const params = new URLSearchParams({
    profileId,
    manifestUrl,
    type,
    id
  })
  const data = await apiFetchJson<{ items: MetaPreview[] }>(`/api/streaming/catalog-items?${params}`)
  return data.items || []
}

/**
 * Lazy-loading horizontal scrollable catalog row.
 * Fetches items on mount via React Query and displays with skeleton loading.
 * Memoized to prevent unnecessary re-renders.
 */
export const LazyCatalogRow = memo(function LazyCatalogRow({
  metadata, 
  profileId, 
  showImdbRatings = true, 
  showAgeRatings = true,
  priority = 'lazy'
}: LazyCatalogRowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null)
  const isObserverSupported = typeof IntersectionObserver !== 'undefined'
  const [isNearViewport, setIsNearViewport] = useState(priority === 'eager')

  useEffect(() => {
    if (priority === 'eager' || !isObserverSupported) return

    const el = rowRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry?.isIntersecting) {
          setIsNearViewport(true)
          observer.disconnect()
        }
      },
      { rootMargin: '250px 0px', threshold: 0.01 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [priority, isObserverSupported])

  const disableStagger = useMemo(() => {
    if (typeof window === 'undefined') return false
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mobile = window.matchMedia('(max-width: 768px)').matches
    return reducedMotion || mobile
  }, [])

  // Fetch catalog items
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['catalog-items', profileId, metadata.manifestUrl, metadata.catalog.type, metadata.catalog.id],
    queryFn: () => fetchCatalogItems(
      profileId,
      metadata.manifestUrl,
      metadata.catalog.type,
      metadata.catalog.id
    ),
    staleTime: 1000 * 60 * 10, // 10 minutes - catalog items change rarely
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: !!metadata && (isNearViewport || !isObserverSupported)
  })

  // Use the shared scroll hook
  const { 
    containerRef, 
    showLeftArrow, 
    showRightArrow, 
    isDown, 
    scroll, 
    handlers,
    isDragging 
  } = useScrollRow({ items })

  // Handle item click - prevent if dragging
  const handleItemClick = (e: React.MouseEvent, _item: ContentItem) => {
    if (isDragging()) {
      e.preventDefault()
      e.stopPropagation()
      return false
    }
  }

  // Don't render if error or (after activation/loading) there are no items
  if (error || (isNearViewport && !isLoading && items.length === 0)) {
    return null
  }

  return (
    <div className={styles.contentRow} ref={rowRef}>
      <div className={styles.rowHeader}>
        <h2 className={styles.rowTitle}>{metadata.title}</h2>
        {metadata.seeAllUrl && (
          <a href={metadata.seeAllUrl} className={styles.seeAllLink}>See All</a>
        )}
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
          ref={containerRef}
          {...handlers}
          style={{ cursor: isDown ? 'grabbing' : 'grab', userSelect: 'none' }}
        >
          {isLoading || !isNearViewport ? (
            <motion.div
              initial={{ opacity: 1 }}
              style={{ display: 'flex', gap: '20px' }}
            >
              {Array.from({ length: 7 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: disableStagger ? 1 : 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: disableStagger ? 0 : 0.2 }}
              style={{ display: 'flex', gap: '20px' }}
            >
              {items.map((item, index) => (
                <div
                  key={`${item.id}-${index}-${item.type}-${item.name}`.replace(/\s+/g, '-').toLowerCase()}
                  className={styles.cardWrapper}
                >
                  <ContentCard 
                    item={item as ContentItem}
                    profileId={profileId}
                    showImdbRatings={showImdbRatings}
                    showAgeRatings={showAgeRatings}
                    onDragStart={handlers.onDragStart}
                    onClick={handleItemClick}
                  />
                </div>
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
  // Custom comparison: only re-render if metadata or key props change
  return (
    prevProps.metadata === nextProps.metadata &&
    prevProps.profileId === nextProps.profileId &&
    prevProps.showImdbRatings === nextProps.showImdbRatings &&
    prevProps.showAgeRatings === nextProps.showAgeRatings &&
    prevProps.priority === nextProps.priority
  )
})
