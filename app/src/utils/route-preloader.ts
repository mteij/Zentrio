/**
 * Route Preloader Utility
 * Preloads route chunks to make transitions instant
 */

type RoutePreloader = () => Promise<any>

// Map of route paths to their preload functions
const routePreloaders: Record<string, RoutePreloader> = {
  '/': () => import('../pages/LandingPage'),
  '/signin': () => import('../pages/auth/SignInPage'),
  '/register': () => import('../pages/auth/SignUpPage'),
  '/profiles': () => import('../pages/ProfilesPage'),
  '/settings': () => import('../pages/SettingsPage'),
  '/settings/explore-addons': () => import('../pages/ExploreAddonsPage'),
  'streaming-home': () => import('../pages/streaming/Home'),
  'streaming-explore': () => import('../pages/streaming/Explore'),
  'streaming-library': () => import('../pages/streaming/Library'),
  'streaming-search': () => import('../pages/streaming/Search'),
  'streaming-catalog': () => import('../pages/streaming/Catalog'),
  'streaming-details': () => import('../pages/streaming/Details'),
  'streaming-player': () => import('../pages/streaming/Player'),
}

// Track which routes have been preloaded
const preloadedRoutes = new Set<string>()

/**
 * Preload a specific route chunk
 */
export function preloadRoute(routeKey: string): void {
  if (preloadedRoutes.has(routeKey)) {
    return // Already preloaded
  }

  const preloader = routePreloaders[routeKey]
  if (preloader) {
    preloader()
      .then(() => {
        preloadedRoutes.add(routeKey)
      })
      .catch((error) => {
        console.warn(`Failed to preload route: ${routeKey}`, error)
      })
  }
}

/**
 * Preload multiple routes
 */
export function preloadRoutes(routeKeys: string[]): void {
  routeKeys.forEach(preloadRoute)
}

/**
 * Preload routes based on user navigation patterns
 * Call this on mount or after successful auth
 */
export function preloadCommonRoutes(): void {
  // Preload frequently accessed routes after initial load
  setTimeout(() => {
    preloadRoutes([
      '/profiles',
      '/settings',
      'streaming-home',
      'streaming-explore',
    ])
  }, 1000) // Wait 1 second to not interfere with initial page load
}

/**
 * Hook to preload route on element hover (link prefetching)
 */
export function createHoverPreloader(routeKey: string) {
  let hasPreloaded = false
  
  return {
    onMouseEnter: () => {
      if (!hasPreloaded) {
        preloadRoute(routeKey)
        hasPreloaded = true
      }
    },
    onFocus: () => {
      if (!hasPreloaded) {
        preloadRoute(routeKey)
        hasPreloaded = true
      }
    },
  }
}
