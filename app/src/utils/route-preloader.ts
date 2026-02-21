/**
 * Route Preloader Utility
 * 
 * Preloads routes that are likely to be accessed soon to improve perceived performance.
 * This helps with code-split routes by loading them in the background.
 */

type PreloadRoute = () => Promise<any>

type NetworkInfo = {
  effectiveType?: string
  saveData?: boolean
}

/**
 * Routes to preload after the app mounts.
 * These are ordered by likelihood of being accessed.
 */
const ROUTES_TO_PRELOAD: PreloadRoute[] = [
  // Most common routes first
  () => import('../pages/streaming/Home'),
  () => import('../pages/streaming/Explore'),
  () => import('../pages/streaming/Library'),
  () => import('../pages/streaming/Search'),
  
  // Secondary routes
  () => import('../pages/streaming/Details'),
  () => import('../pages/SettingsPage.tsx'),
  () => import('../pages/ProfilesPage'),
  
  // Less common routes
  () => import('../pages/ExploreAddonsPage'),
]

function getNetworkInfo(): NetworkInfo | null {
  try {
    return (navigator as any).connection || null
  } catch {
    return null
  }
}

function getAdaptivePreloadCount(): number {
  const connection = getNetworkInfo()
  if (!connection) return ROUTES_TO_PRELOAD.length

  if (connection.saveData) return 0

  const effectiveType = connection.effectiveType || '4g'
  const deviceMemory = (navigator as any).deviceMemory as number | undefined

  if (effectiveType === 'slow-2g' || effectiveType === '2g') return 0
  if (effectiveType === '3g') return 3
  if (typeof deviceMemory === 'number' && deviceMemory <= 2) return 4

  return ROUTES_TO_PRELOAD.length
}

/**
 * Preloads common routes in the background after a small delay.
 * This ensures the initial render is not blocked while still improving
 * navigation speed for common user flows.
 */
export function preloadCommonRoutes() {
  if (!shouldPreload()) return () => {}

  const preloadCount = getAdaptivePreloadCount()
  if (preloadCount <= 0) return () => {}
  const routesToPreload = ROUTES_TO_PRELOAD.slice(0, preloadCount)

  // Delay preloading briefly to allow initial render to complete
  const PRELOAD_DELAY = 500 // 500ms - load chunks quickly after mount

  const timer = setTimeout(() => {
    // Use requestIdleCallback if available to load during browser idle periods
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        preloadRoutesWithIdleCallback(routesToPreload)
      }, { timeout: 5000 })
    } else {
      // Fallback: preload after delay
      preloadRoutesWithTimeout(routesToPreload)
    }
  }, PRELOAD_DELAY)

  return () => clearTimeout(timer)
}

/**
 * Preloads routes using requestIdleCallback for optimal performance
 */
function preloadRoutesWithIdleCallback(routes: PreloadRoute[]) {
  let index = 0

  function preloadNext() {
    if (index >= routes.length) return

    const route = routes[index]
    index++

    if ('requestIdleCallback' in window) {
      requestIdleCallback(
        () => {
          route().catch(() => {
            // Silently ignore preload errors - they'll be caught on actual navigation
          })
          preloadNext()
        },
        { timeout: 3000 }
      )
    }
  }

  preloadNext()
}

/**
 * Preloads routes with a staggered timeout
 * Used as fallback when requestIdleCallback is not available
 */
function preloadRoutesWithTimeout(routes: PreloadRoute[]) {
  routes.forEach((route, index) => {
    const delay = index * 200 // Stagger by 200ms
    
    setTimeout(() => {
      route().catch(() => {
        // Silently ignore preload errors
      })
    }, delay)
  })
}

/**
 * Preloads a specific route immediately
 * Useful for prefetching routes when the user hovers over a link
 */
export function preloadRoute(routeLoader: PreloadRoute) {
  // Use requestIdleCallback if available
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      routeLoader().catch(() => {})
    })
  } else {
    // Fallback: setTimeout with small delay
    setTimeout(() => {
      routeLoader().catch(() => {})
    }, 100)
  }
}

/**
 * Creates hover-based preloader for routes
 * Used by Navbar to preload routes when user hovers over navigation items
 */
export function createHoverPreloader(routeName: string) {
  let preloadTriggered = false

  const handleMouseEnter = () => {
    if (preloadTriggered || !shouldPreload()) return
    preloadTriggered = true
    
    // Map route names to actual imports
    const routeMap: Record<string, PreloadRoute> = {
      'streaming-home': () => import('../pages/streaming/Home'),
      'streaming-explore': () => import('../pages/streaming/Explore'),
      'streaming-library': () => import('../pages/streaming/Library'),
      'streaming-search': () => import('../pages/streaming/Search'),
      '/settings': () => import('../pages/SettingsPage.tsx'),
      '/profiles': () => import('../pages/ProfilesPage'),
    }

    const routeLoader = routeMap[routeName]
    if (routeLoader) {
      preloadRoute(routeLoader)
    }
  }

  const handleFocus = () => {
    handleMouseEnter()
  }

  return {
    onMouseEnter: handleMouseEnter,
    onFocus: handleFocus,
  }
}

/**
 * Preloads the player page with higher priority
 * This should be called when the user clicks on a content item
 */
export function preloadPlayer() {
  // Higher priority preload - load immediately but non-blocking
  if (!shouldPreload()) return

  requestAnimationFrame(() => {
    import('../pages/streaming/Player').catch(() => {})
  })
}

/**
 * Connection-aware preloading
 * Only preload if the user has a good connection
 */
export function shouldPreload() {
  const connection = (navigator as any).connection
  if (!connection) return true // Assume true if API not available

  // Don't preload on slow connections or if data saver is enabled
  if (connection.saveData) return false
  if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
    return false
  }

  return true
}
