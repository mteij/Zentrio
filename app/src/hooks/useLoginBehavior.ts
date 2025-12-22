import { useMemo } from 'react'

export type LoginBehavior = 'profiles' | 'last' | 'specific'

interface LoginBehaviorResult {
  behavior: LoginBehavior
  specificProfileId: string | null
  getRedirectPath: () => string
}

/**
 * Hook to determine post-login navigation behavior based on device settings.
 * 
 * Behavior options:
 * - 'profiles': Navigate to profile selection page (default)
 * - 'last': Navigate to the last used profile's streaming page
 * - 'specific': Navigate to a specific configured profile's streaming page
 */
export function useLoginBehavior(): LoginBehaviorResult {
  return useMemo(() => {
    const behavior = (localStorage.getItem('zentrioLoginBehavior') || 'profiles') as LoginBehavior
    const specificProfileId = localStorage.getItem('zentrioLoginBehaviorProfileId')

    const getRedirectPath = (): string => {
      if (behavior === 'last') {
        // Get last used profile from selectedProfile
        try {
          const selectedProfile = localStorage.getItem('selectedProfile')
          if (selectedProfile) {
            const profile = JSON.parse(selectedProfile)
            if (profile?.id) {
              return `/streaming/${profile.id}`
            }
          }
        } catch (e) {
          console.error('Failed to parse selectedProfile:', e)
        }
        // Fallback to profiles page if no last profile
        return '/profiles'
      }

      if (behavior === 'specific' && specificProfileId) {
        return `/streaming/${specificProfileId}`
      }

      // Default: show profile selection
      return '/profiles'
    }

    return {
      behavior,
      specificProfileId,
      getRedirectPath
    }
  }, [])
}

/**
 * Get the redirect path for use in non-hook contexts (e.g., callback URLs)
 */
export function getLoginBehaviorRedirectPath(): string {
  const behavior = (localStorage.getItem('zentrioLoginBehavior') || 'profiles') as LoginBehavior
  const specificProfileId = localStorage.getItem('zentrioLoginBehaviorProfileId')

  if (behavior === 'last') {
    try {
      const selectedProfile = localStorage.getItem('selectedProfile')
      if (selectedProfile) {
        const profile = JSON.parse(selectedProfile)
        if (profile?.id) {
          return `/streaming/${profile.id}`
        }
      }
    } catch (e) {
      console.error('Failed to parse selectedProfile:', e)
    }
    return '/profiles'
  }

  if (behavior === 'specific' && specificProfileId) {
    return `/streaming/${specificProfileId}`
  }

  return '/profiles'
}
