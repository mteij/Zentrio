import { useEffect, useState, ReactNode, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useLoginBehavior } from '../../hooks/useLoginBehavior'
import { SplashScreen } from '../ui/SplashScreen'
import { appMode } from '../../lib/app-mode'
import { isTauri } from '../../lib/auth-client'

interface RouteGuardProps {
  children: ReactNode
}

/**
 * ProtectedRoute - Wrapper for routes that require authentication.
 * Redirects unauthorized users to the landing page.
 * 
 * In Guest Mode, this component allows access without authentication,
 * using the local server with a default guest profile.
 * 
 * Important: This component waits for the auth store to be hydrated from localStorage
 * and verifies with the server before making any redirect decisions. This is crucial
 * for SSO login where the server sets cookies but the client store isn't synced yet.
 */
export function ProtectedRoute({ children }: RouteGuardProps) {
  const { isAuthenticated, isLoading } = useAuthStore()
  const navigate = useNavigate()
  // Check if in guest mode - skip auth check entirely
  const isGuestMode = appMode.isGuest()
  
  // Track if we've already initiated a redirect to prevent multiple redirects
  const [redirectInitiated, setRedirectInitiated] = useState(false)

  // Redirect if not authenticated (connected mode only)
  useEffect(() => {
    if (isGuestMode) return // Don't redirect in guest mode
    if (redirectInitiated) return // Already handling redirect

    if (!isLoading && !isAuthenticated) {
      // For Tauri apps, clear the app mode so the OnboardingWizard shows
      // This provides a native-feeling re-authentication experience
      // instead of showing the web-oriented LandingPage
      if (isTauri()) {
        console.log('[ProtectedRoute] Session expired in Tauri, resetting mode for OnboardingWizard')
        setRedirectInitiated(true)
        appMode.clear()
        // Clear server URL too so the OnboardingWizard condition triggers properly
        localStorage.removeItem('zentrio_server_url')
        // Use navigate to prevent full app reload which clears state
        navigate('/', { replace: true })
      } else {
        setRedirectInitiated(true)
        navigate('/', { replace: true })
      }
    }
  }, [isAuthenticated, isLoading, navigate, isGuestMode, redirectInitiated])

  // Show loading ONLY while checking session initially
  if (isLoading) {
    return <SplashScreen />
  }

  // Don't render children if not authenticated (connected mode only)
  if (!isGuestMode && !isAuthenticated) {
    return <SplashScreen /> // Show splash while redirect is processing
  }

  return <>{children}</>
}

/**
 * PublicRoute - Wrapper for public/auth pages that should redirect authenticated users.
 * Redirects authenticated users based on login behavior settings.
 * 
 * In Guest Mode, redirects to streaming home immediately.
 */
export function PublicRoute({ children }: RouteGuardProps) {
  const { isAuthenticated, isLoading } = useAuthStore()
  const { getRedirectPath } = useLoginBehavior()
  const navigate = useNavigate()
  const [hasHydrated, setHasHydrated] = useState(false)
  
  // Check if in guest mode
  const isGuestMode = appMode.isGuest()

  // Wait for Zustand store to hydrate from localStorage
  useEffect(() => {
    const timeoutId = requestAnimationFrame(() => {
      setHasHydrated(true)
    })
    return () => cancelAnimationFrame(timeoutId)
  }, [])

  useEffect(() => {
    // Guest mode: redirect to profiles page
    if (hasHydrated && isGuestMode) {
      navigate('/profiles', { replace: true })
      return
    }
    
    const verifyAndRedirect = async () => {
      if (hasHydrated && isAuthenticated && !isLoading) {
        // Verify the session is actually valid with the server before redirecting
        try {
          const sessionValid = await useAuthStore.getState().refreshSession()
          if (sessionValid) {
            navigate(getRedirectPath(), { replace: true })
          }
          // If session is invalid, refreshSession() will have cleared the auth state
        } catch (e) {
          console.error('Session verification failed', e)
        }
      }
    }
    verifyAndRedirect()
  }, [hasHydrated, isAuthenticated, isLoading, navigate, getRedirectPath, isGuestMode])

  // Guest mode shouldn't see public/auth pages
  if (isGuestMode) {
    return null
  }

  // Always render children for public routes (they handle their own UI)
  return <>{children}</>
}
