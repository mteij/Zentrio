import { useCallback, useRef } from 'react'

interface UseLongPressOptions {
  threshold?: number // Time in ms to trigger long press
  onLongPress: (event: React.TouchEvent | React.MouseEvent) => void
  onClick?: (event: React.MouseEvent) => void
}

export const useLongPress = ({
  threshold = 500,
  onLongPress,
  onClick
}: UseLongPressOptions) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPress = useRef(false)
  const startPosition = useRef<{ x: number; y: number } | null>(null)

  const start = useCallback((event: React.TouchEvent | React.MouseEvent) => {
    isLongPress.current = false
    
    // Get starting position
    if ('touches' in event) {
      startPosition.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
      }
    } else {
      startPosition.current = {
        x: event.clientX,
        y: event.clientY
      }
    }

    timerRef.current = setTimeout(() => {
      isLongPress.current = true
      onLongPress(event)
    }, threshold)
  }, [onLongPress, threshold])

  const clear = useCallback((event: React.TouchEvent | React.MouseEvent, shouldTriggerClick = true) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    
    // If it wasn't a long press and we have an onClick handler, trigger it
    if (shouldTriggerClick && !isLongPress.current && onClick && 'button' in event) {
      onClick(event as React.MouseEvent)
    }
    
    startPosition.current = null
  }, [onClick])

  const move = useCallback((event: React.TouchEvent) => {
    // Cancel long press if finger moved too much
    if (startPosition.current && timerRef.current) {
      const touch = event.touches[0]
      const dx = Math.abs(touch.clientX - startPosition.current.x)
      const dy = Math.abs(touch.clientY - startPosition.current.y)
      
      // If moved more than 10px, cancel
      if (dx > 10 || dy > 10) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  return {
    onTouchStart: start,
    onTouchEnd: (e: React.TouchEvent) => clear(e, false),
    onTouchMove: move,
    onTouchCancel: (e: React.TouchEvent) => clear(e, false),
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: (e: React.MouseEvent) => clear(e, false)
  }
}
