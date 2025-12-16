import { useRef, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MetaPreview } from '../../services/addons/types'
import { LazyImage } from '../ui/LazyImage'
import { RatingBadge } from '../ui/RatingBadge'
import styles from '../../styles/Streaming.module.css'

interface StreamingRowProps {
  title: string
  items: MetaPreview[]
  profileId: string
  showImdbRatings?: boolean
  showAgeRatings?: boolean
  seeAllUrl?: string
}

export function StreamingRow({ title, items, profileId, showImdbRatings = true, showAgeRatings = true, seeAllUrl }: StreamingRowProps) {
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

  // Prevent click if dragged
  const handleClick = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      e.preventDefault()
      e.stopPropagation()
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
              onClick={handleClick}
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
