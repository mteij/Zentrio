import { useRef, useState, useEffect, useCallback } from 'react'

export interface UseScrollRowOptions {
  /** Items in the row - used to detect when content changes */
  items: any[]
  /** Speed multiplier for drag scrolling (default: 2.5) */
  multiplier?: number
  /** Friction for momentum scrolling (default: 0.95) */
  friction?: number
}

export interface UseScrollRowResult {
  /** Ref to attach to the scroll container */
  containerRef: React.RefObject<HTMLDivElement | null>
  /** Whether to show the left scroll arrow */
  showLeftArrow: boolean
  /** Whether to show the right scroll arrow */
  showRightArrow: boolean
  /** Whether the user is currently pressing down */
  isDown: boolean
  /** Scroll the container left or right */
  scroll: (direction: 'left' | 'right') => void
  /** Event handlers to attach to the scroll container */
  handlers: {
    onMouseDown: (e: React.MouseEvent) => void
    onMouseLeave: () => void
    onMouseUp: () => void
    onMouseMove: (e: React.MouseEvent) => void
    onDragStart: (e: React.DragEvent) => void
  }
  /** Check if currently dragging (for click prevention) */
  isDragging: () => boolean
}

/**
 * Hook for horizontal scroll rows with drag-to-scroll and momentum.
 * Extracted from StreamingRow and LazyCatalogRow to eliminate duplication.
 */

export function useScrollRow(options: UseScrollRowOptions): UseScrollRowResult {
  const { items, multiplier = 1, friction = 0.95 } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)
  const [isDown, setIsDown] = useState(false)

  // Refs for drag/momentum tracking
  const isDraggingRef = useRef(false)
  const startXRef = useRef(0)
  const scrollLeftRef = useRef(0)
  const velocityRef = useRef(0)
  const lastMoveTimeRef = useRef(0)
  const lastPageXRef = useRef(0)
  const rafIdRef = useRef<number | null>(null)

  // Update arrow visibility
  const updateArrows = useCallback(() => {
    if (containerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = containerRef.current
      setShowLeftArrow(scrollLeft > 0)
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1)
    }
  }, [])

  // Stop any ongoing momentum animation
  const stopMomentum = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    // Restore smooth scroll when momentum stops
    if (containerRef.current) {
      containerRef.current.style.removeProperty('scroll-behavior')
    }
  }, [])

  // Update arrows on scroll, resize, and item changes
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
  }, [items, updateArrows, stopMomentum])

  // Scroll by button click
  const scroll = useCallback((direction: 'left' | 'right') => {
    if (containerRef.current) {
      stopMomentum()
      // Ensure smooth scroll is enabled for button clicks (CSS handles it usually, but just in case we stripped it)
      containerRef.current.style.removeProperty('scroll-behavior')
      
      const scrollAmount = containerRef.current.clientWidth * 0.8
      containerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
    }
  }, [stopMomentum])


  const handleMouseUp = useCallback(() => {
    setIsDown(false)
    
    // Start momentum if there's velocity
    if (Math.abs(velocityRef.current) > 0.5) {
      const applyMomentum = () => {
        if (!containerRef.current) return
        
        velocityRef.current *= friction
        containerRef.current.scrollLeft -= velocityRef.current
        
        if (Math.abs(velocityRef.current) > 0.5) {
          rafIdRef.current = requestAnimationFrame(applyMomentum)
        } else {
          stopMomentum()
        }
      }
      rafIdRef.current = requestAnimationFrame(applyMomentum)
    } else {
      stopMomentum()
    }

    // Clear dragging flag after a tick (to prevent click)
    setTimeout(() => {
      isDraggingRef.current = false
    }, 0)

    // Remove global listeners
    document.removeEventListener('mousemove', handleGlobalMouseMove as any)
    document.removeEventListener('mouseup', handleMouseUp)
  }, [friction, stopMomentum])

  // Define handleGlobalMouseMove outside so it can be referenced in handleMouseDown
  // We use a ref to access the latest state/refs without re-binding
  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return
    e.preventDefault()
    
    const x = e.pageX - containerRef.current.offsetLeft
    const walk = (x - startXRef.current) * multiplier
    
    // Threshold check before considering as drag
    if (!isDraggingRef.current && Math.abs(walk) > 5) {
      isDraggingRef.current = true
    }

    if (isDraggingRef.current) {
      // Disable smooth scrolling during direct manipulation
      containerRef.current.style.scrollBehavior = 'auto'
      containerRef.current.scrollLeft = scrollLeftRef.current - walk
      
      // Calculate velocity for momentum
      const now = Date.now()
      const dt = now - lastMoveTimeRef.current
      const dX = (e.pageX - lastPageXRef.current) * multiplier
      
      if (dt > 0) {
        velocityRef.current = dX
        lastMoveTimeRef.current = now
        lastPageXRef.current = e.pageX
      }
    }
  }, [multiplier])

  // Mouse handlers for drag scrolling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    stopMomentum()
    
    // Disable smooth scrolling immediately on interaction start
    containerRef.current.style.scrollBehavior = 'auto'

    setIsDown(true)
    isDraggingRef.current = false
    startXRef.current = e.pageX - containerRef.current.offsetLeft
    scrollLeftRef.current = containerRef.current.scrollLeft
    lastPageXRef.current = e.pageX
    lastMoveTimeRef.current = Date.now()
    velocityRef.current = 0

    // Attach global listeners
    document.addEventListener('mousemove', handleGlobalMouseMove as any)
    document.addEventListener('mouseup', handleMouseUp)
  }, [stopMomentum, handleMouseUp, handleGlobalMouseMove])

  // Prevent native drag
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    return false
  }, [])

  // Check if currently dragging (for click prevention)
  const isDragging = useCallback(() => {
    return isDraggingRef.current
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove as any)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseUp, handleGlobalMouseMove])

  return {
    containerRef,
    showLeftArrow,
    showRightArrow,
    isDown,
    scroll,
    handlers: {
      onMouseDown: handleMouseDown,
      onDragStart: handleDragStart
    } as any, 
    isDragging
  }
}
