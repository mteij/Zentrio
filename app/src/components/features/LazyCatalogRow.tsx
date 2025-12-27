import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { MetaPreview } from '../../services/addons/types'
import { ContentCard, ContentItem } from './ContentCard'
import { SkeletonCard } from '../ui/SkeletonCard'
import { useScrollRow } from '../../hooks/useScrollRow'
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
}

const fetchCatalogItems = async (
  profileId: string,
  manifestUrl: string,
  type: string,
  id: string
): Promise<MetaPreview[]> => {
  const params = new URLSearchParams({
    profileId,
    manifestUrl: encodeURIComponent(manifestUrl),
    type,
    id
  })
  const res = await fetch(`/api/streaming/catalog-items?${params}`)
  if (!res.ok) throw new Error('Failed to fetch catalog')
  const data = await res.json()
  return data.items || []
}

/**
 * Lazy-loading horizontal scrollable catalog row.
 * Fetches items on mount via React Query and displays with skeleton loading.
 */
export function LazyCatalogRow({ 
  metadata, 
  profileId, 
  showImdbRatings = true, 
  showAgeRatings = true 
}: LazyCatalogRowProps) {
  // Fetch catalog items
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['catalog-items', profileId, metadata.manifestUrl, metadata.catalog.type, metadata.catalog.id],
    queryFn: () => fetchCatalogItems(
      profileId,
      metadata.manifestUrl,
      metadata.catalog.type,
      metadata.catalog.id
    ),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: !!metadata
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
  const handleItemClick = (e: React.MouseEvent, item: ContentItem) => {
    if (isDragging()) {
      e.preventDefault()
      e.stopPropagation()
      return false
    }
  }

  // Don't render if error or no items
  if (error || (!isLoading && items.length === 0)) {
    return null
  }

  return (
    <div className={styles.contentRow}>
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
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', gap: '20px' }}
              >
                {Array.from({ length: 7 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="items"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                style={{ display: 'flex', gap: '20px' }}
              >
                {items.map((item, index) => (
                  <motion.div 
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.3, 
                      delay: Math.min(index * 0.05, 0.3)
                    }}
                    style={{ flex: '0 0 auto', width: 180 }}
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
          </AnimatePresence>
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
}
