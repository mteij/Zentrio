import React from 'react'
import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { authClient } from '../lib/auth-client'

interface User {
  id: string
  email: string
  name?: string
  username?: string
  firstName?: string
  lastName?: string
  avatar?: string
  image?: string | null
  emailVerified?: boolean
  createdAt?: Date | string
  updatedAt?: Date | string
  twoFactorEnabled?: boolean | null
}

interface Session {
  user: User
  expiresAt: Date
  token?: string
}

interface AuthState {
  user: User | null
  session: Session | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  lastActivity: number
  login: (user: User, session?: Session) => void
  logout: () => Promise<void>
  updateUser: (updates: Partial<User>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  refreshSession: (token?: string) => Promise<boolean>
  checkSession: () => Promise<boolean>
  reset: () => void
}

// Session duration constant (24 hours)
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export const useAuthStore = create<AuthState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: true, // Default to true so we wait for session check
        error: null,
        lastActivity: Date.now(),

        login: (user, session) => {
          const now = Date.now()
          set({
            user,
            session: session || { user, expiresAt: new Date(Date.now() + SESSION_DURATION_MS) },
            isAuthenticated: true,
            isLoading: false,
            error: null,
            lastActivity: now,
          })
        },

        // Clean up state without forcing a reload/redirect loop
        // Used internally when session is invalid
        reset: () => {
             set({
              user: null,
              session: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
              lastActivity: Date.now(),
            })
        },

        logout: async () => {
          try {
            // Call Better Auth sign out
            await authClient.signOut()
          } catch (error) {
            console.error('Error during sign out:', error)
          } finally {
            // Use internal reset to clear state
            get().reset()
            
            // Clear app mode and server URL to show onboarding wizard
            // Import dynamically to avoid circular dependency
            import('../lib/app-mode').then(({ appMode }) => {
              appMode.clear()
            })
            localStorage.removeItem('zentrio_server_url')
            
            // Reload to show onboarding wizard
            window.location.href = '/'
          }
        },

        updateUser: (updates) =>
          set((state) => ({
            user: state.user ? { ...state.user, ...updates } : null,
            session: state.session ? { ...state.session, user: state.user ? { ...state.user, ...updates } : state.session.user } : null,
          })),

        setLoading: (loading) => set({ isLoading: loading }),

        setError: (error) => set({ error, isLoading: false }),

        clearError: () => set({ error: null }),

        refreshSession: async (token?: string) => {
          try {
            // Capture the token BEFORE the async call to detect concurrent logins later
            const initialToken = token || get().session?.token;
            
            set({ isLoading: true, error: null })
            
            // DON'T send Authorization header when refreshing
            // Let the server use the session cookie to generate a NEW token
            // Sending the old token causes the server to return the same expired token
            console.log('[AuthStore] Refreshing session...');
            const session = await authClient.getSession()
            
            // Prefer fresh token from server, then passed token, then fallback to existing
            const freshToken = session?.data?.session?.token;
            const tokenToUse = freshToken || token || get().session?.token;
            
            console.log('[AuthStore] Session refresh response:', {
                hasUser: !!session?.data?.user,
                hasToken: !!freshToken,
                userEmail: session?.data?.user?.email,
                newToken: freshToken ? `...${freshToken.slice(-6)}` : null,
                tokenToUse: tokenToUse ? `...${tokenToUse.slice(-6)}` : null,
                error: session?.error
            });
            
            if (session?.data?.user) {
              const user = session.data.user
              const sessionData = {
                user,
                expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
                token: tokenToUse
              }
              
              // Set state synchronously
              set({
                user,
                session: sessionData,
                isAuthenticated: true,
                isLoading: false,
                error: null,
                lastActivity: Date.now(),
              })
              
              console.log('[AuthStore] Session refreshed, token set:', tokenToUse ? `...${tokenToUse.slice(-6)}` : null);
              return true
            } else {
              // Session expired or invalid
              
              const currentToken = get().session?.token;
              
              // RACE CONDITION GUARD:
              // Only preserve the session if the token has CHANGED while we were waiting.
              // If initialToken !== currentToken, it means a login happened in parallel.
              if (currentToken && currentToken !== initialToken) {
                 console.log('[AuthStore] Token changed during refresh (concurrent login detected). Keeping new session.');
                 set({ isLoading: false });
                 return true; 
              }
              
              // Otherwise, the session is truly dead.
              
              // No valid server session and no concurrent login detected.
              // Force local reset so route guards stop treating the user as authenticated.
              console.log('[AuthStore] Refresh returned no user and no concurrent login detected. Resetting local auth state.');
              get().reset()
              return false
            }
          } catch (error: any) {
            console.error('Error refreshing session:', error)
            
            // Only reset if it's explicitly an auth error (401/403)
            // For network errors (fetch failed) or server errors (500), keep the local session
            // This prevents "flickering" or logging out when the server is restarting/unreachable
            const isAuthError = error?.status === 401 || error?.status === 403 || 
                               (error?.message && (error.message.includes('401') || error.message.includes('403')));
            
            if (isAuthError) {
                console.log('[AuthStore] Auth error detected, resetting session');
                get().reset()
            } else {
                console.log('[AuthStore] Non-auth error during refresh, retaining session');
            }
            
            set({ error: 'Failed to refresh session' })
            return false
          } finally {
            set({ isLoading: false })
          }
        },

        checkSession: async () => {
          const { session } = get()
          
          // Check if session exists and hasn't expired
          if (!session) {
            // Even if no local session, we might have a server cookie (SSO case)
            // So we should try to refresh once if we are loading
            return await get().refreshSession()
          }

          const now = Date.now()
          const sessionExpiry = new Date(session.expiresAt).getTime()
          
          // Check if session is still valid (with 5-minute buffer)
          if (now > sessionExpiry - 5 * 60 * 1000) {
            // Session expired or about to expire, try to refresh
            return await get().refreshSession()
          }

          // Update last activity
          set({ lastActivity: now })
          return true
        },
      }),
      {
        name: 'zentrio-auth-storage',
        partialize: (state) => ({
          user: state.user,
          session: state.session,
          isAuthenticated: state.isAuthenticated,
          lastActivity: state.lastActivity,
        }),
        onRehydrateStorage: () => (state) => {
          console.log('[AuthStore] Rehydrated:', { 
              isAuthenticated: state?.isAuthenticated, 
              forceCheck: true
          });
          
          // ALWAYS check session on rehydration to handle SSO redirects
          // This will verify with the server (cookies) even if localStorage is empty
          if (state) {
              state.refreshSession().catch(console.error)
          }
        },
      }
    )
  )
)

// Auto-session refresh hook
export const useSessionRefresh = () => {
  const { checkSession, isAuthenticated } = useAuthStore()

  // Check session every 5 minutes
  React.useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(() => {
      checkSession().catch(console.error)
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [isAuthenticated, checkSession])

  // Check session on window focus
  React.useEffect(() => {
    if (!isAuthenticated) return

    const handleFocus = () => {
      checkSession().catch(console.error)
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [isAuthenticated, checkSession])
}