import { useState, useEffect, useCallback } from 'react'

export type SessionDuration = 'indefinite' | 'session'

const STORAGE_KEY = 'zentrioSessionDuration'
const DEFAULT_DURATION: SessionDuration = 'indefinite'

/**
 * Hook to manage session duration preference.
 * - 'indefinite': Keep the user logged in for a long time (1 year)
 * - 'session': Session expires when browser closes
 */
export function useSessionDuration() {
  const [duration, setDurationState] = useState<SessionDuration>(() => {
    if (typeof window === 'undefined') return DEFAULT_DURATION
    const stored = localStorage.getItem(STORAGE_KEY) as SessionDuration
    return stored && ['indefinite', 'session'].includes(stored) ? stored : DEFAULT_DURATION
  })

  // Sync with localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as SessionDuration
    if (stored && ['indefinite', 'session'].includes(stored)) {
      setDurationState(stored)
    }
  }, [])

  const setDuration = useCallback((newDuration: SessionDuration) => {
    setDurationState(newDuration)
    localStorage.setItem(STORAGE_KEY, newDuration)
  }, [])

  return { duration, setDuration }
}

/**
 * Get the session duration preference without using a hook.
 * Useful for non-React contexts like API calls.
 */
export function getSessionDuration(): SessionDuration {
  if (typeof window === 'undefined') return DEFAULT_DURATION
  const stored = localStorage.getItem(STORAGE_KEY) as SessionDuration
  return stored && ['indefinite', 'session'].includes(stored) ? stored : DEFAULT_DURATION
}

/**
 * Check if the user prefers to stay logged in indefinitely.
 */
export function shouldKeepLoggedIn(): boolean {
  return getSessionDuration() === 'indefinite'
}
