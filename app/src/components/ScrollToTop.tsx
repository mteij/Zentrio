import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * ScrollToTop Component
 * 
 * Scrolls the window to the top when the route pathname changes.
 * This ensures that when navigating between pages, the new page
 * starts from the top instead of maintaining the previous scroll position.
 * 
 * Usage: Place this component inside your Router component.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    // Scroll to top when pathname changes
    // Use setTimeout to ensure it runs after the route change completes
    const timeoutId = setTimeout(() => {
      // Try scrolling the root element first (for mobile/locked body scenarios)
      const rootElement = document.getElementById('root')
      if (rootElement) {
        rootElement.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      }
      
      // Also scroll window as fallback
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      
      // Scroll document body for additional compatibility
      document.body.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      
      // Scroll document element for additional compatibility
      document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [pathname])

  return null
}
