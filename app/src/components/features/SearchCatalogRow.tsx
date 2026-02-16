import { memo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { MetaPreview } from '../../services/addons/types'
import { ContentCard, ContentItem } from './ContentCard'
import { useScrollRow } from '../../hooks/useScrollRow'
import styles from '../../styles/Streaming.module.css'

interface SearchCatalogRowProps {
  addon: { id: string; name: string; logo?: string }
  catalog: { type: string; id: string; name?: string }
  items: MetaPreview[]
  profileId: string
  showImdbRatings?: boolean
  showAgeRatings?: boolean
}

/**
 * Search result row component for catalog-based search.
 * Displays items from a single catalog in a horizontal scrollable row.
 * Unlike LazyCatalogRow, items are already loaded.
 */
export const SearchCatalogRow = memo(function SearchCatalogRow({
  addon,
  catalog,
  items,
  profileId,
  showImdbRatings = true,
  showAgeRatings = true
}: SearchCatalogRowProps) {
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

  // Don't render if no items
  if (items.length === 0) return null

  // Build title: "{Addon} - {Catalog Type}"
  const typeLabel = catalog.type === 'movie' ? 'Movies' : catalog.type === 'series' ? 'Series' : catalog.type
  const title = catalog.name || `${addon.name} - ${typeLabel}`

  return (
    <div className={styles.contentRow}>
      <div className={styles.rowHeader}>
        <h2 className={styles.rowTitle}>{title}</h2>
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
          <motion.div
            key="items"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            style={{ display: 'flex', gap: '20px' }}
          >
            {items.map((item, index) => (
              <motion.div
                key={`${item.id}-${index}-${item.type}-${item.name}`.replace(/\s+/g, '-').toLowerCase()}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: Math.min(index * 0.03, 0.2)
                }}
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
              </motion.div>
            ))}
          </motion.div>
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
  // Custom comparison: only re-render if props change
  return (
    prevProps.addon.id === nextProps.addon.id &&
    prevProps.catalog.id === nextProps.catalog.id &&
    prevProps.items === nextProps.items &&
    prevProps.profileId === nextProps.profileId &&
    prevProps.showImdbRatings === nextProps.showImdbRatings &&
    prevProps.showAgeRatings === nextProps.showAgeRatings
  )
})
