import { useEffect } from 'react'

/**
 * Attaches a wheel listener to an overflow-x:auto container so that vertical
 * wheel events (plain mouse scroll) are forwarded to the window instead of
 * being swallowed by the container.
 *
 * Browsers route wheel events to the nearest scrollable ancestor based on CSS
 * overflow, so an overflow-x:auto element will intercept vertical scroll even
 * though it cannot scroll vertically. This hook takes ownership of those
 * events and manually forwards them to window.scrollBy.
 *
 * Horizontal wheel events (trackpad panning) are left fully native.
 *
 * Usage — pass an element via a state ref so the effect reruns on mount/unmount:
 *
 *   const [el, setEl] = useState<HTMLDivElement | null>(null)
 *   usePassthroughVerticalScroll(el)
 *   <div ref={setEl} className="overflow-x-auto">...</div>
 */
export function usePassthroughVerticalScroll(el: HTMLElement | null) {
  useEffect(() => {
    if (!el) return

    const handler = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return

      e.preventDefault()
      const delta =
        e.deltaMode === 1
          ? e.deltaY * 16
          : e.deltaMode === 2
            ? e.deltaY * window.innerHeight
            : e.deltaY
      window.scrollBy(0, delta)
    }

    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [el])
}
