let tvPageTopAnimationFrame: number | null = null

export function scrollTvPageTop(durationMs = 260) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const mainContent = document.querySelector<HTMLElement>('[data-tv-page-main="true"]')
  if (!mainContent) return

  if (tvPageTopAnimationFrame !== null) {
    window.cancelAnimationFrame(tvPageTopAnimationFrame)
    tvPageTopAnimationFrame = null
  }

  const startTop = mainContent.scrollTop
  if (startTop <= 1) {
    mainContent.scrollTop = 0
    return
  }

  const startTime = window.performance.now()
  const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3)

  const animate = (now: number) => {
    const progress = Math.min(1, (now - startTime) / durationMs)
    const easedProgress = easeOutCubic(progress)

    mainContent.scrollTop = startTop * (1 - easedProgress)

    if (progress < 1) {
      tvPageTopAnimationFrame = window.requestAnimationFrame(animate)
      return
    }

    mainContent.scrollTop = 0
    tvPageTopAnimationFrame = null
  }

  tvPageTopAnimationFrame = window.requestAnimationFrame(animate)
}
