import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isTauri } from '../lib/auth-client'

interface UseRootScrollPinnedOptions {
  extraTopPx?: number
  enabled?: boolean
}

export function useRootScrollPinned(options: UseRootScrollPinnedOptions = {}) {
  const { extraTopPx = 0, enabled = true } = options
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const [isPinned, setIsPinned] = useState(false)
  const [headerHeight, setHeaderHeight] = useState(0)

  const active = enabled && isTauri()

  useLayoutEffect(() => {
    if (!active || !headerRef.current) return

    const measure = () => {
      setHeaderHeight(headerRef.current?.offsetHeight || 0)
    }

    measure()

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => measure())
      : null

    resizeObserver?.observe(headerRef.current)
    window.addEventListener('resize', measure)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [active])

  useEffect(() => {
    if (!active || !sentinelRef.current) return

    const scroller = document.getElementById('root')
    if (!scroller) return

    const updatePinned = () => {
      const sentinel = sentinelRef.current
      if (!sentinel) return

      const rootStyles = getComputedStyle(document.documentElement)
      const topOffset = parseFloat(rootStyles.getPropertyValue('--app-content-top-offset')) || 0
      const threshold = topOffset + extraTopPx
      setIsPinned(sentinel.getBoundingClientRect().top <= threshold)
    }

    updatePinned()

    scroller.addEventListener('scroll', updatePinned, { passive: true })
    window.addEventListener('resize', updatePinned)

    return () => {
      scroller.removeEventListener('scroll', updatePinned)
      window.removeEventListener('resize', updatePinned)
    }
  }, [active, extraTopPx])

  return {
    active,
    isPinned,
    sentinelRef,
    headerRef,
    spacerStyle: active && isPinned && headerHeight > 0 ? { height: `${headerHeight}px` } : undefined,
  }
}
