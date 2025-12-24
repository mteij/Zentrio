import { useRef, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { MetaPreview } from '../../services/addons/types'
import { LazyImage } from '../ui/LazyImage'
import { RatingBadge } from '../ui/RatingBadge'
import { SkeletonCard } from '../ui/SkeletonCard'
import { ContextMenu, ContextMenuItem } from '../ui/ContextMenu'
import { useContextMenu } from '../../hooks/useContextMenu'
import { ListSelectionModal } from './ListSelectionModal'
import { Plus, Play, Trash2, Check, Eye } from 'lucide-react'
import { apiFetch } from '../../lib/apiFetch'
import { useAuthStore } from '../../stores/authStore' // Assuming we might need this or profileId is passed
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

export function LazyCatalogRow({ 
  metadata, 
  profileId, 
  showImdbRatings = true, 
  showAgeRatings = true 
}: LazyCatalogRowProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)
  const [isDown, setIsDown] = useState(false)
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const scrollLeftRef = useRef(0)
  const velocityRef = useRef(0)
  const lastMoveTimeRef = useRef(0)
  const lastPageXRef = useRef(0)
  const rafIdRef = useRef<number | null>(null)

  // Fetch catalog items
  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['catalog-items', profileId, metadata.manifestUrl, metadata.catalog.type, metadata.catalog.id],
    queryFn: () => fetchCatalogItems(
      profileId,
      metadata.manifestUrl,
      metadata.catalog.type,
      metadata.catalog.id
    ),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1, // Only retry once to avoid blocking on failing addons
    refetchOnWindowFocus: false
  })

  const updateArrows = () => {
    if (containerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = containerRef.current
      setShowLeftArrow(scrollLeft > 0)
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1)
    }
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    updateArrows()

    const handleScroll = () => updateArrows()
    container.addEventListener('scroll', handleScroll)
    window.addEventListener('resize', handleScroll)

    return () => {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
      stopMomentum()
    }
  }, [items])

  const stopMomentum = () => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
  }
  
  const scroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      stopMomentum()
      const scrollAmount = containerRef.current.clientWidth * 0.8
      containerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    stopMomentum()
    setIsDown(true)
    isDraggingRef.current = false
    startXRef.current = e.pageX - containerRef.current.offsetLeft
    scrollLeftRef.current = containerRef.current.scrollLeft
    lastPageXRef.current = e.pageX
    lastMoveTimeRef.current = Date.now()
    velocityRef.current = 0
  }

  const handleMouseLeave = () => {
    if (isDown) handleMouseUp()
  }

  const handleMouseUp = () => {
    setIsDown(false)
    if (Math.abs(velocityRef.current) > 0.5) {
      const applyMomentum = () => {
        if (!containerRef.current) return
        velocityRef.current *= 0.95
        containerRef.current.scrollLeft -= velocityRef.current
        if (Math.abs(velocityRef.current) > 0.5) {
          rafIdRef.current = requestAnimationFrame(applyMomentum)
        } else {
          stopMomentum()
        }
      }
      rafIdRef.current = requestAnimationFrame(applyMomentum)
    }
    setTimeout(() => { isDraggingRef.current = false }, 0)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown || !containerRef.current) return
    e.preventDefault()
    
    const x = e.pageX - containerRef.current.offsetLeft
    const walk = (x - startXRef.current) * 2.5 
    
    if (!isDraggingRef.current && Math.abs(walk) > 5) {
      isDraggingRef.current = true
    }

    if (isDraggingRef.current) {
      containerRef.current.scrollLeft = scrollLeftRef.current - walk
      const now = Date.now()
      const dt = now - lastMoveTimeRef.current
      const dX = (e.pageX - lastPageXRef.current) * 2.5
      if (dt > 0) {
        velocityRef.current = dX
        lastMoveTimeRef.current = now
        lastPageXRef.current = e.pageX
      }
    }
  }

  const handleItemClick = (e: React.MouseEvent, item: MetaPreview) => {
    if (isDraggingRef.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault()
    return false
  }

  // Generate URL with fallback metadata for addons that don't provide meta resource
  const getItemUrl = (item: MetaPreview) => {
    const baseUrl = `/streaming/${profileId}/${item.type}/${item.id}`
    // Create a minimal fallback object with essential display data
    const fallback = {
      id: item.id,
      type: item.type,
      name: item.name,
      poster: item.poster,
      background: item.background,
      description: item.description,
      releaseInfo: item.releaseInfo,
      imdbRating: item.imdbRating,
    }
    const fallbackParam = encodeURIComponent(JSON.stringify(fallback))
    return `${baseUrl}?metaFallback=${fallbackParam}`
  }

  // Don't render if error or empty after loading
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
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onDragStart={handleDragStart}
          style={{ cursor: isDown ? 'grabbing' : 'grab', userSelect: 'none' }}
        >
          <AnimatePresence mode="wait">
            {isLoading ? (
              // Skeleton loading state
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
              // Loaded items with staggered fade-in
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
                    <CatalogItem 
                        item={item} 
                        getItemUrl={getItemUrl} 
                        handleItemClick={handleItemClick}
                        handleDragStart={handleDragStart}
                        showImdbRatings={showImdbRatings}
                        showAgeRatings={showAgeRatings}
                        profileId={profileId}
                        metadata={metadata}
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

function CatalogItem({ 
    item, 
    getItemUrl, 
    handleItemClick, 
    handleDragStart, 
    showImdbRatings, 
    showAgeRatings,
    profileId,
    metadata
}: { 
    item: MetaPreview, 
    getItemUrl: (i: MetaPreview) => string, 
    handleItemClick: (e: React.MouseEvent, i: MetaPreview) => void,
    handleDragStart: (e: React.DragEvent) => void,
    showImdbRatings: boolean,
    showAgeRatings: boolean,
    profileId: string,
    metadata: CatalogMetadata
}) {
    const { isOpen, position, closeMenu, triggerProps } = useContextMenu()
    const [showListModal, setShowListModal] = useState(false)
    
    // Check if this row is a "Continue Watching" row or "Watch History"
    // Usually these are identified by catalog type or ID. 
    // metadata.catalog.type might be 'history' or similar? 
    // Actually, looking at streaming.ts dashboard, history is served separately.
    // But LazyCatalogRow might be used for history if we implement it that way.
    // The user request specifically mentioned "remove from continue watching". 
    // If this item has progress (which we don't know for sure in generic LazyCatalogRow unless passed in item), we might not show it.
    // However, if the catalog is "Continue Watching", we should show it.
    // For now, let's assume we can try to delete progress if the user asks, or only show it if we are confident.
    // Since LazyCatalogRow is generic, let's show it if `item` has `progressPercent` (which it doesn't in MetaPreview usually) OR blindly show it?
    // Blindly showing "Remove from Continue Watching" might be confusing if it's not in continue watching.
    // Better: Only show "Add to List".
    // Wait, the user asked for "remove from continue watching etc".
    // I should check if the parent passed `isContinueWatching` prop? `LazyCatalogRow` doesn't have it in props definition currently.
    // I'll add the menu item but maybe disable it if we don't think it applies?
    // Let's add "Remove from Continue Watching" always, but maybe it only works if history exists.
    
    const contextItems: ContextMenuItem[] = [
        {
            label: 'Play',
            icon: <Play size={16} />,
            action: () => {
                window.location.href = getItemUrl(item)
            }
        },
        {
            label: 'View Details',
            icon: <Eye size={16} />,
            action: () => {
                window.location.href = getItemUrl(item)
            }
        },
        {
            label: 'Add to List...',
            icon: <Plus size={16} />,
            action: () => setShowListModal(true)
        }
    ]

    // Only show "Remove from Continue Watching" if this is a history/continue watching row
    // we can check metadata.catalog.type.
    // 'history' is usually the type for continue watching catalogs or similar.
    // Let's also check if user explicity passed it via props (not available here)
    // Checking type 'history' or 'continue_watching' seems safest for now.
    // Also if the item has a 'progress' field (which might not be in MetaPreview but sometimes is attached).
    if (metadata?.catalog?.type === 'history' || metadata?.catalog?.id === 'continue_watching') {
         contextItems.push({
            label: 'Remove from Continue Watching',
            icon: <Trash2 size={16} />,
            danger: true,
            action: async () => {
                try {
                    await apiFetch(`/api/streaming/progress/${item.type}/${item.id}?profileId=${profileId}`, {
                        method: 'DELETE'
                    })
                    window.dispatchEvent(new CustomEvent('history-updated'))
                } catch (e) {
                    console.error("Failed to remove progress", e)
                }
            }
        })
    }

    return (
        <>
            <a 
                href={getItemUrl(item)} 
                className={styles.mediaCard}
                onClick={(e) => handleItemClick(e, item)}
                onDragStart={handleDragStart}
                draggable={false}
                {...triggerProps}
            >
                <div className={styles.posterContainer}>
                {item.poster ? (
                    <LazyImage src={item.poster} alt={item.name} className={styles.posterImage} />
                ) : (
                    <div className={styles.noPoster}>{item.name}</div>
                )}
                <div className={styles.badgesContainer}>
                    {showImdbRatings && item.imdbRating && (
                    <RatingBadge 
                        rating={parseFloat(item.imdbRating)} 
                        style={{ position: 'relative', top: 'auto', right: 'auto', marginBottom: '0' }}
                    />
                    )}
                    {/* @ts-ignore */}
                    {showAgeRatings && (item.certification || item.rating || item.contentRating) && (
                    <span className={styles.ageRatingBadge}>
                        {/* @ts-ignore */}
                        {item.certification || item.rating || item.contentRating}
                    </span>
                    )}
                </div>
                <div className={styles.cardOverlay}>
                    <div className={styles.cardTitle}>{item.name}</div>
                </div>
                </div>
            </a>

            <ContextMenu 
                isOpen={isOpen}
                onClose={closeMenu}
                position={position}
                items={contextItems}
                title={item.name}
            />
            
            <ListSelectionModal
                isOpen={showListModal}
                onClose={() => setShowListModal(false)}
                profileId={parseInt(profileId)}
                item={item}
            />
        </>
    )
}
