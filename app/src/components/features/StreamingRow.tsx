import { useRef, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { MetaPreview } from '../../services/addons/types'
import { LazyImage } from '../ui/LazyImage'
import { RatingBadge } from '../ui/RatingBadge'
import styles from '../../styles/Streaming.module.css'

interface StreamingRowProps {
  title: string
  items: (MetaPreview & { progressPercent?: number; episodeDisplay?: string; lastStream?: any; season?: number; episode?: number })[]
  profileId: string
  showImdbRatings?: boolean
  showAgeRatings?: boolean
  seeAllUrl?: string
  isContinueWatching?: boolean
}

export function StreamingRow({ title, items, profileId, showImdbRatings = true, showAgeRatings = true, seeAllUrl, isContinueWatching = false }: StreamingRowProps) {
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
  }, [items]) // Re-run if items change, as scrollWidth might change

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
          {items.map(item => (
            <a 
              key={item.id} 
              href={`/streaming/${profileId}/${item.type}/${item.id}`} 
              className={styles.mediaCard}
              onClick={(e) => handleItemClick(e, item)}
              onDragStart={handleDragStart}
              draggable={false}
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
                {/* Progress bar for continue watching */}
                {isContinueWatching && item.progressPercent !== undefined && item.progressPercent > 0 && (
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
                {isContinueWatching && item.episodeDisplay && (
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
