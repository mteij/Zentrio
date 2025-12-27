import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MetaPreview } from '../../services/addons/types'
import { ContentCard, ContentItem } from './ContentCard'
import { useScrollRow } from '../../hooks/useScrollRow'
import { useAutoPlay } from '../../hooks/useAutoPlay'
import { getPackId } from '../../services/addons/stream-service'
import { apiFetch } from '../../lib/apiFetch'
import styles from '../../styles/Streaming.module.css'

interface StreamingRowProps {
  title: string
  items: ContentItem[]
  profileId: string
  showImdbRatings?: boolean
  showAgeRatings?: boolean
  seeAllUrl?: string
  isContinueWatching?: boolean
  isRanked?: boolean
}

/**
 * Horizontal scrollable row of media items.
 * Used for Continue Watching, Top 10, and similar static rows.
 */
export function StreamingRow({ 
  title, 
  items, 
  profileId, 
  showImdbRatings = true, 
  showAgeRatings = true, 
  seeAllUrl, 
  isContinueWatching = false, 
  isRanked = false 
}: StreamingRowProps) {
  const navigate = useNavigate()
  const { startAutoPlay } = useAutoPlay()
  
  // Local items state for optimistic updates (e.g., removing from continue watching)
  const [rowItems, setRowItems] = useState(items)
  
  useEffect(() => {
    setRowItems(items)
  }, [items])

  // Use the shared scroll hook
  const { 
    containerRef, 
    showLeftArrow, 
    showRightArrow, 
    isDown, 
    scroll, 
    handlers,
    isDragging 
  } = useScrollRow({ items: rowItems })

  // Handle item removal (for continue watching)
  const handleRemove = async (item: ContentItem) => {
    // Optimistic update
    setRowItems(prev => prev.filter(i => i.id !== item.id))
    
    try {
      await apiFetch(`/api/streaming/progress/${item.type}/${item.id}?profileId=${profileId}`, {
        method: 'DELETE'
      })
      window.dispatchEvent(new CustomEvent('history-updated'))
    } catch (e) {
      console.error("Failed to remove progress", e)
    }
  }

  // Handle item click - prevent if dragging, auto-play for continue watching
  const handleItemClick = (e: React.MouseEvent, item: ContentItem) => {
    if (isDragging()) {
      e.preventDefault()
      e.stopPropagation()
      return false
    }

    if (isContinueWatching) {
      e.preventDefault()

      // Parse season/episode from item or episodeDisplay
      let season = item.season
      let episode = item.episode
      
      if (!season && item.episodeDisplay) {
         const match = item.episodeDisplay.match(/S(\d+):E(\d+)/)
         if (match) {
           season = parseInt(match[1])
           episode = parseInt(match[2])
         }
      }

      // Use unified auto-play hook with pack matching
      startAutoPlay({
        profileId,
        meta: {
          id: item.id,
          type: item.type,
          name: item.name,
          poster: item.poster
        },
        season,
        episode,
        lastStream: item.lastStream,
        preferredPackId: item.lastStream ? getPackId(item.lastStream) : null
      })
      
      return false
    }
  }

  return (
    <div className={styles.contentRow}>
      <div className={styles.rowHeader}>
        <h2 className={styles.rowTitle}>{title}</h2>
        {seeAllUrl && (
          <a href={seeAllUrl} className={styles.seeAllLink}>See All</a>
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
          {rowItems.map((item, index) => (
            <ContentCard 
              key={item.id}
              item={item}
              profileId={profileId}
              showImdbRatings={showImdbRatings}
              showAgeRatings={showAgeRatings}
              isContinueWatching={isContinueWatching}
              isRanked={isRanked}
              rank={index + 1}
              onRemove={handleRemove}
              onDragStart={handlers.onDragStart}
              onClick={handleItemClick}
            />
          ))}
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
