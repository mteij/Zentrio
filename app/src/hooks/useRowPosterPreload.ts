import { RefObject, useEffect, useRef } from 'react'
import { preloadImages } from '../lib/imagePreload'

interface PosterLikeItem {
  poster?: string | null
  background?: string | null
}

interface UseRowPosterPreloadOptions<T extends PosterLikeItem> {
  containerRef: RefObject<HTMLDivElement | null>
  items: T[]
  enabled?: boolean
  preloadAhead?: number
}

function estimateCardStride(container: HTMLDivElement) {
  const measuredCard = container.querySelector<HTMLElement>('[data-row-card="true"]')
  const gapValue = window.getComputedStyle(container).gap || window.getComputedStyle(container).columnGap || '0'
  const gap = Number.parseFloat(gapValue) || 0

  if (measuredCard) {
    return Math.max(measuredCard.getBoundingClientRect().width + gap, 1)
  }

  return container.clientWidth <= 768 ? 160 : 200
}

export function useRowPosterPreload<T extends PosterLikeItem>({
  containerRef,
  items,
  enabled = true,
  preloadAhead = 8,
}: UseRowPosterPreloadOptions<T>) {
  const lastWindowRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled || items.length === 0) return

    const container = containerRef.current
    if (!container) return

    let rafId = 0

    const updateWindow = () => {
      rafId = 0

      const stride = estimateCardStride(container)
      const visibleCount = Math.max(1, Math.ceil(container.clientWidth / stride))
      const startIndex = Math.max(0, Math.floor(container.scrollLeft / stride) - 2)
      const endIndex = Math.min(items.length, startIndex + visibleCount + preloadAhead)
      const nextWindow = `${startIndex}:${endIndex}:${items.length}`

      if (lastWindowRef.current === nextWindow) return
      lastWindowRef.current = nextWindow

      preloadImages(
        items.slice(startIndex, endIndex).map((item) => item.poster || item.background),
        endIndex - startIndex
      )
    }

    const scheduleUpdate = () => {
      if (rafId) return
      rafId = requestAnimationFrame(updateWindow)
    }

    scheduleUpdate()
    container.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
      container.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [containerRef, enabled, items, preloadAhead])
}

