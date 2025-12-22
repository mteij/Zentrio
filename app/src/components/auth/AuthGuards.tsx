import { useEffect, useState, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useLoginBehavior } from '../../hooks/useLoginBehavior'
import { LoadingSpinner } from '../ui/LoadingSpinner'

interface RouteGuardProps {
  children: ReactNode
}

/**
 * ProtectedRoute - Wrapper for routes that require authentication.
 * Redirects unauthorized users to the landing page.
 * 
 * Important: This component waits for the auth store to be hydrated from localStorage
 * and verifies with the server before making any redirect decisions. This is crucial
 * for SSO login where the server sets cookies but the client store isn't synced yet.
 */
export function ProtectedRoute({ children }: RouteGuardProps) {
  const { isAuthenticated, isLoading } = useAuthStore()
  const navigate = useNavigate()
  const [hasCheckedSession, setHasCheckedSession] = useState(false)
  const [sessionValid, setSessionValid] = useState(false)

  // Check session with server on mount
  useEffect(() => {

    const checkSession = async () => {
      try {
        // If already authenticated in store, verify it's still valid
        // If not authenticated, try to refresh in case of SSO callback
        const isValid = await useAuthStore.getState().refreshSession()
        setSessionValid(isValid)
      } catch (e) {
        console.error('Session check failed', e)
        setSessionValid(false)
      } finally {
        setHasCheckedSession(true)
      }
    }
    
    checkSession()

  }, [])

  // Redirect if session check completed and not authenticated
  useEffect(() => {


    if (hasCheckedSession && !isLoading && !sessionValid && !isAuthenticated) {

      navigate('/', { replace: true })
    }
  }, [hasCheckedSession, sessionValid, isAuthenticated, isLoading, navigate])

  // Show loading ONLY while checking session initially
  // Do NOT show loading if we have already checked session (background refresh)
  if (!hasCheckedSession) {
    return <LoadingSpinner fullScreen />
  }

  // Don't render children if not authenticated
  if (!sessionValid && !isAuthenticated) {
    return null
  }

  return <>{children}</>
}

/**
 * PublicRoute - Wrapper for public/auth pages that should redirect authenticated users.
 * Redirects authenticated users based on login behavior settings.
 */
export function PublicRoute({ children }: RouteGuardProps) {
  const { isAuthenticated, isLoading } = useAuthStore()
  const { getRedirectPath } = useLoginBehavior()
  const navigate = useNavigate()
  const [hasHydrated, setHasHydrated] = useState(false)

  // Wait for Zustand store to hydrate from localStorage
  useEffect(() => {
    const timeoutId = requestAnimationFrame(() => {
      setHasHydrated(true)
    })
    return () => cancelAnimationFrame(timeoutId)
  }, [])

  useEffect(() => {
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
  }, [hasHydrated, isAuthenticated, isLoading, navigate, getRedirectPath])

  // Always render children for public routes (they handle their own UI)
  return <>{children}</>
}
