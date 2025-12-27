import { useRef, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MetaPreview } from '../../services/addons/types'
import { LazyImage } from '../ui/LazyImage'
import { RatingBadge } from '../ui/RatingBadge'
import { ContextMenu } from '../ui/ContextMenu'
import { ListSelectionModal } from './ListSelectionModal'
import { Plus, Play, Trash2, Eye, Check, X } from 'lucide-react'
import { apiFetch } from '../../lib/apiFetch'
import styles from '../../styles/Streaming.module.css'

interface StreamingRowProps {
  title: string
  items: (MetaPreview & { progressPercent?: number; episodeDisplay?: string; lastStream?: any; season?: number; episode?: number })[]
  profileId: string
  showImdbRatings?: boolean
  showAgeRatings?: boolean
  seeAllUrl?: string
  isContinueWatching?: boolean
  isRanked?: boolean
}

export function StreamingRow({ title, items, profileId, showImdbRatings = true, showAgeRatings = true, seeAllUrl, isContinueWatching = false, isRanked = false }: StreamingRowProps) {

  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
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

  const updateArrows = () => {
    if (containerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = containerRef.current
      setShowLeftArrow(scrollLeft > 0)
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1)
    }
  }

  // ... (useEffect remains same, handled by diff context if possible or I'll retain it if I replace enough)
  const [rowItems, setRowItems] = useState(items)

  useEffect(() => {
    setRowItems(items)
  }, [items])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    updateArrows() // Initial check

    const handleScroll = () => updateArrows()
    container.addEventListener('scroll', handleScroll)

    // Also update arrows on window resize
    window.addEventListener('resize', handleScroll)

    return () => {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
      stopMomentum() // Clean up any ongoing momentum animation
    }
  }, [rowItems]) // Re-run if items change, as scrollWidth might change

  const handleRemove = async (item: MetaPreview) => {
    // Optimistic update
    setRowItems(prev => prev.filter(i => i.id !== item.id))
    
    // Perform API call
    try {
        await apiFetch(`/api/streaming/progress/${item.type}/${item.id}?profileId=${profileId}`, {
            method: 'DELETE'
        })
        // Dispatch event in case other components need to know (though we already updated UI locally)
        window.dispatchEvent(new CustomEvent('history-updated'))
    } catch (e) {
        console.error("Failed to remove progress", e)
        // Optionally revert state here if needed, but for "remove" it's usually fine to just log
    }
  }

  const stopMomentum = () => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
  }
  
  const scroll = (direction: 'left' | 'right') => {
    if (containerRef.current) {
      stopMomentum() // Stop any ongoing momentum
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
    
    // Init momentum tracking
    lastPageXRef.current = e.pageX
    lastMoveTimeRef.current = Date.now()
    velocityRef.current = 0
  }

  const handleMouseLeave = () => {
    if (isDown) handleMouseUp()
  }

  const handleMouseUp = () => {
    setIsDown(false)
    
    // Start momentum if there's velocity
    if (Math.abs(velocityRef.current) > 0.5) {
      const applyMomentum = () => {
        if (!containerRef.current) return
        
        // Decay
        velocityRef.current *= 0.95 // Friction
        containerRef.current.scrollLeft -= velocityRef.current
        
        if (Math.abs(velocityRef.current) > 0.5) {
          rafIdRef.current = requestAnimationFrame(applyMomentum)
        } else {
          stopMomentum()
        }
      }
      rafIdRef.current = requestAnimationFrame(applyMomentum)
    }

    setTimeout(() => {
      isDraggingRef.current = false
    }, 0)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown || !containerRef.current) return
    e.preventDefault()
    
    const x = e.pageX - containerRef.current.offsetLeft
    const walk = (x - startXRef.current) * 2.5 
    
    // Threshold check
    if (!isDraggingRef.current && Math.abs(walk) > 5) {
      isDraggingRef.current = true
    }

    if (isDraggingRef.current) {
      containerRef.current.scrollLeft = scrollLeftRef.current - walk
      
      // Calculate velocity
      const now = Date.now()
      const dt = now - lastMoveTimeRef.current
      const dX = (e.pageX - lastPageXRef.current) * 2.5 // Apply same multiplier to velocity
      
      if (dt > 0) {
        // Smooth out velocity with simple moving average or just take latest
        // For 'throw' feel, latest is usually better but can be erratic.
        // Let's bias towards new value
        const newVel = dX // / dt * 16 (normalize to frame?) - simpler: just calculated delta per event
        velocityRef.current = newVel
        
        lastMoveTimeRef.current = now
        lastPageXRef.current = e.pageX
      }
    }
  }

  // Prevent click if dragged, handle continue watching instant play
  const handleItemClick = (e: React.MouseEvent, item: any) => {
    if (isDraggingRef.current) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    if (isContinueWatching && item.lastStream) {
        e.preventDefault()
        
        // Construct minimal meta for player
        const meta = {
            id: item.id,
            type: item.type,
            name: item.name,
            poster: item.poster,
            season: item.season,
            episode: item.episode
            // videos intentionally omitted - next/prev won't work until full meta is fetched or passed
        }

        navigate(`/streaming/${profileId}/player`, { 
            state: { 
                stream: item.lastStream,
                meta: meta
            }
        })
    }
  }

  // Prevent native drag for smoother custom scrolling
  const handleDragStart = (e: React.DragEvent) => {
    e.preventDefault()
    return false
  }

  // Generate URL with fallback metadata for addons that don't provide meta resource
  const getItemUrl = (item: MetaPreview) => {
    const baseUrl = `/streaming/${profileId}/${item.type}/${item.id}`
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
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onDragStart={handleDragStart}
          style={{ cursor: isDown ? 'grabbing' : 'grab', userSelect: 'none' }}
        >
          {rowItems.map((item, index) => (
            <StreamingItem 
                key={item.id}
                item={item} 
                getItemUrl={getItemUrl} 
                handleItemClick={handleItemClick}
                handleDragStart={handleDragStart}
                onRemove={handleRemove}
                showImdbRatings={showImdbRatings}
                showAgeRatings={showAgeRatings}
                isContinueWatching={isContinueWatching}
                profileId={profileId}
                isRanked={isRanked}
                rank={index + 1}
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

function StreamingItem({ 
    item, 
    getItemUrl, 
    handleItemClick, 
    handleDragStart, 
    showImdbRatings, 
    showAgeRatings,
    isContinueWatching,
    profileId,
    isRanked,
    rank,
    onRemove
}: { 
    item: MetaPreview & { progressPercent?: number; episodeDisplay?: string; lastStream?: any }, 
    getItemUrl: (i: MetaPreview) => string, 
    handleItemClick: (e: React.MouseEvent, i: any) => void,
    handleDragStart: (e: React.DragEvent) => void,
    onRemove: (item: any) => void,
    showImdbRatings: boolean,
    showAgeRatings: boolean,
    isContinueWatching: boolean,
    profileId: string,
    isRanked?: boolean,
    rank?: number
}) {
    const [showListModal, setShowListModal] = useState(false)
    const navigate = useNavigate()

    // Handle play with smart source selection
    const handlePlay = async () => {
        // For continue watching items, they already have lastStream
        if (isContinueWatching && item.lastStream) {
            navigate(`/streaming/${profileId}/player`, { 
                state: { 
                    stream: item.lastStream,
                    meta: { id: item.id, type: item.type, name: item.name, poster: item.poster }
                }
            })
            return
        }
        
        // Otherwise go to details page
        window.location.href = getItemUrl(item)
    }

    // Local state for immediate UI feedback
    const [isWatched, setIsWatched] = useState((item as any).isWatched);

    useEffect(() => {
        setIsWatched((item as any).isWatched);
    }, [(item as any).isWatched]);

    const toggleWatched = async () => {
        const newWatchedState = !isWatched;
        // Optimistic update
        setIsWatched(newWatchedState);
        // Also update parent list if possible (won't affect parent state deep down but helps local re-renders)
        (item as any).isWatched = newWatchedState;

        try {
            await apiFetch(newWatchedState ? '/api/streaming/mark-series-watched' : '/api/streaming/mark-watched', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profileId: parseInt(profileId),
                    metaId: item.id,
                    metaType: item.type,
                    watched: newWatchedState,
                    season: item.type === 'series' ? -1 : undefined,
                    episode: item.type === 'series' ? -1 : undefined
                })
            })
            
            // Dispatch event to refresh home
            window.dispatchEvent(new CustomEvent('history-updated'))
        } catch (e) {
            console.error('Failed to mark as watched', e)
            setIsWatched(!newWatchedState) // Revert
        }
    }

    const markEpisodeWatched = async () => {
         if (!item.episodeDisplay) return;
         // Parse S1:E5
         const match = item.episodeDisplay.match(/S(\d+):E(\d+)/);
         if (!match) return;
         
         const season = parseInt(match[1]);
         const episode = parseInt(match[2]);

         try {
             await apiFetch('/api/streaming/mark-watched', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     profileId: parseInt(profileId),
                     metaId: item.id,
                     metaType: item.type,
                     watched: true,
                     season,
                     episode
                 })
             })
             window.dispatchEvent(new CustomEvent('history-updated'))
         } catch (e) {
             console.error('Failed to mark episode watched', e)
         }
    }

    const removeFromContinueWatching = async () => {
        onRemove(item)
    }

    const contextItems = [
        {
            label: 'Play',
            icon: Play,
            onClick: handlePlay
        },
        {
            label: 'View Details',
            icon: Eye,
            onClick: () => {
                window.location.href = getItemUrl(item)
            }
        },
        { type: 'separator' } as any,
        isContinueWatching ? {
            label: 'Remove from Continue Watching',
            icon: Trash2,
            variant: 'danger',
            onClick: removeFromContinueWatching
        } : (
            // If it's a series and has an active episode, show "Mark Episode" option too
            item.type === 'series' && item.episodeDisplay ? [
                {
                    label: `Mark ${item.episodeDisplay} Watched`,
                    icon: Check,
                    onClick: markEpisodeWatched
                },
                {
                    label: isWatched ? 'Mark Series Unwatched' : 'Mark Series Watched',
                    icon: isWatched ? X : Check,
                    onClick: toggleWatched
                }
            ] : {
                label: isWatched ? 'Mark as Unwatched' : 'Mark as Watched',
                icon: isWatched ? X : Check,
                onClick: toggleWatched
            }
        ),
        { type: 'separator' } as any,
        {
            label: 'Add to List...',
            icon: Plus,
            onClick: () => setShowListModal(true)
        }
    ].flat()

    return (
        <>
            <ContextMenu
                items={contextItems}
            >
                <a 
                  href={getItemUrl(item)} 
                  className={`${styles.mediaCard} ${isRanked ? styles.rankedCard : ''}`}
                  onClick={(e) => handleItemClick(e, item)}
                  onDragStart={handleDragStart}
                  draggable={false}
                >
                  {isRanked && rank && (
                    <span className={`${styles.rankNumber} ${rank === 10 ? styles.rankNumber10 : ''}`}>
                        {rank}
                    </span>
                  )}
                  
                  <div className={styles.posterContainer}>
                    {item.poster ? (
                      <LazyImage src={item.poster} alt={item.name} className={styles.posterImage} />
                    ) : (
                      <div className={styles.noPoster}>{item.name}</div>
                    )}
                    
                    {/* Watched Indicator - Top Left */}
                    {/* @ts-ignore */}
                    {item.isWatched && (
                        <div style={{
                            position: 'absolute',
                            top: '8px',
                            left: '8px',
                            background: 'rgba(0, 0, 0, 0.7)',
                            color: '#4ade80',
                            padding: '4px',
                            borderRadius: '50%',
                            backdropFilter: 'blur(4px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10
                        }}>
                            <Check size={14} strokeWidth={3} />
                        </div>
                    )}

                    <div className={styles.badgesContainer}>
                      {showImdbRatings && item.imdbRating && (
                        <RatingBadge 
                          rating={parseFloat(item.imdbRating)} 
                          style={{ position: 'relative', top: 'auto', right: 'auto', marginBottom: '0' }}
                        />
                      )}
                      {/* @ts-ignore */}
                      {showAgeRatings && (item.ageRating || item.certification || item.rating || item.contentRating) && (
                        <span className={styles.ageRatingBadge}>
                          {/* @ts-ignore */}
                          {item.ageRating || item.certification || item.rating || item.contentRating}
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    {(isContinueWatching || (item.progressPercent !== undefined && item.progressPercent > 0)) && (
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background: 'rgba(0, 0, 0, 0.6)',
                        borderBottomLeftRadius: '8px',
                        borderBottomRightRadius: '8px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${item.progressPercent}%`,
                          height: '100%',
                          background: 'linear-gradient(90deg, #8b5cf6, #a855f7)',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    )}
                    {/* Episode badge for series */}
                    {item.episodeDisplay && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        background: 'rgba(0, 0, 0, 0.7)',
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backdropFilter: 'blur(4px)'
                      }}>
                        {item.episodeDisplay}
                      </div>
                    )}
                    <div className={styles.cardOverlay}>
                      <div className={styles.cardTitle}>{item.name}</div>
                    </div>
                  </div>
                </a>
            </ContextMenu>
            
            <ListSelectionModal
                isOpen={showListModal}
                onClose={() => setShowListModal(false)}
                profileId={parseInt(profileId)}
                item={item}
            />
        </>
    )
}
