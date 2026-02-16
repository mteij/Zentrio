import { useState, useRef, useCallback, useEffect } from 'react'

interface UseContextMenuOptions {
  onOpen?: () => void
  onClose?: () => void
}

export function useContextMenu(options?: UseContextMenuOptions) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const longPressTimerRef = useRef<Timer | null>(null)
  const isLongPressRef = useRef(false)
  
  // To prevent click event after long press
  useEffect(() => {
    const preventClick = (e: MouseEvent) => {
        if (isLongPressRef.current) {
            e.preventDefault()
            e.stopPropagation()
            isLongPressRef.current = false // Reset after consuming
        }
    }
    // Capture phase to intercept early
    window.addEventListener('click', preventClick, true) 
    return () => window.removeEventListener('click', preventClick, true)
  }, [])

  const openMenu = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    e.preventDefault()
    e.stopPropagation() // Stop bubbling

    let clientX, clientY
    // @ts-expect-error
    if (e.touches && e.touches.length > 0) {
      // @ts-expect-error
      clientX = e.touches[0].clientX
      // @ts-expect-error
      clientY = e.touches[0].clientY
    } else {
      // @ts-expect-error
      clientX = e.clientX
      // @ts-expect-error
      clientY = e.clientY
    }

    setPosition({ x: clientX, y: clientY })
    setIsOpen(true)
    options?.onOpen?.()
  }, [options])

  const closeMenu = useCallback(() => {
    setIsOpen(false)
    options?.onClose?.()
  }, [options])

  // Right Click (Desktop)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    openMenu(e)
  }, [openMenu])

  // Touch Events (Mobile Long Press)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isLongPressRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true
      openMenu(e)
    }, 500) // 500ms long press
  }, [openMenu])

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const handleTouchMove = useCallback(() => {
    // If moved, cancel long press
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const triggerProps = {
    onContextMenu: handleContextMenu,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchMove: handleTouchMove
  }

  return {
    isOpen,
    position,
    closeMenu,
    triggerProps,
    setIsOpen 
  }
}
