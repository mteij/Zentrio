/**
 * Route Preloader Utility
 * 
 * Preloads routes that are likely to be accessed soon to improve perceived performance.
 * This helps with code-split routes by loading them in the background.
 */

type PreloadRoute = () => Promise<any>

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
  () => import('../pages/SettingsPage'),
  () => import('../pages/ProfilesPage'),
  
  // Less common routes
  () => import('../pages/ExploreAddonsPage'),
]

/**
 * Preloads common routes in the background after a small delay.
 * This ensures the initial render is not blocked while still improving
 * navigation speed for common user flows.
 */
export function preloadCommonRoutes() {
  // Delay preloading briefly to allow initial render to complete
  const PRELOAD_DELAY = 500 // 500ms - load chunks quickly after mount

  const timer = setTimeout(() => {
    // Use requestIdleCallback if available to load during browser idle periods
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        preloadRoutesWithIdleCallback()
      }, { timeout: 5000 })
    } else {
      // Fallback: preload after delay
      preloadRoutesWithTimeout()
    }
  }, PRELOAD_DELAY)

  return () => clearTimeout(timer)
}

/**
 * Preloads routes using requestIdleCallback for optimal performance
 */
function preloadRoutesWithIdleCallback() {
  let index = 0

  function preloadNext() {
    if (index >= ROUTES_TO_PRELOAD.length) return

    const route = ROUTES_TO_PRELOAD[index]
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
function preloadRoutesWithTimeout() {
  ROUTES_TO_PRELOAD.forEach((route, index) => {
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
