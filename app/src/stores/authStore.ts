import React from 'react'
import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { apiFetch } from '../lib/apiFetch'
import { appMode } from '../lib/app-mode'
import { authClient } from '../lib/auth-client'
import { createLogger } from '../utils/client-logger'
import { isTauriRuntime } from '../lib/runtime-env'

const log = createLogger('AuthStore')

const isWebPlatform = (): boolean => {
  if (typeof window === 'undefined') return false
  return !isTauriRuntime()
}

interface User {
  id: string
  email: string
  name?: string
  role?: string
  banned?: boolean
  banReason?: string | null
  banExpires?: Date | string | null
  phoneNumber?: string | null
  phoneNumberVerified?: boolean
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
  isFreshLogin: boolean  // NEW: Not persisted to storage, prevents refresh race condition
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
        isFreshLogin: false,  // NEW: In-memory flag, not persisted

        login: (user, session) => {
          const now = Date.now()
          set({
            user,
            session: session || { user, expiresAt: new Date(Date.now() + SESSION_DURATION_MS) },
            isAuthenticated: true,
            isLoading: false,
            error: null,
            lastActivity: now,
            isFreshLogin: true,  // NEW: Mark as fresh login to prevent immediate refresh
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
              isFreshLogin: false,  // NEW: Reset flag on logout/reset
            })
        },

        logout: async () => {
          try {
            // Call Better Auth sign out
            await authClient.signOut()
          } catch (error) {
            log.error('Error during sign out:', error)
          } finally {
            // Use internal reset to clear state
            get().reset()
            
            // Clear app mode and server URL to show onboarding wizard
            appMode.clear()
            localStorage.removeItem('zentrio_server_url')
            
            // Clear persisted auth storage (especially legacy tokens)
            localStorage.removeItem('zentrio-auth-storage')
            
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
          // In guest mode there is no auth server – skip entirely
          if (appMode.isGuest()) {
              return false;
          }

          // Precise concurrency check: we only skip if we are already in the middle of the async call below
          // (We use the isLoading state but only if we've already started the refresh)
          if (get().isLoading && !token && get().isAuthenticated) {
              log.debug('Refresh already in progress for authenticated user, skipping duplicate call');
              return false;
          }
          
          try {
            // Capture the token BEFORE the async call to detect concurrent logins later
            const initialToken = token || get().session?.token;
            
            // Do NOT unblock the UI if we are already authenticated. 
            // This prevents video streams from destroying and recreating on window focus.
            if (!get().isAuthenticated) {
                set({ isLoading: true, error: null })
            } else {
                set({ error: null })
            }
            
            // DON'T send Authorization header when refreshing
            // Let the server use the session cookie to generate a NEW token
            // Sending the old token causes the server to return the same expired token
            log.debug(`Refreshing session... Token: ${initialToken ? `...${initialToken.slice(-6)}` : 'NONE'}`);
             
             let sessionResponse: any;
             
             try {
                // By-pass better-auth client entirely for session fetching
                // better-auth has a bug where it completely ignores fetchOptions.customFetch for session probing
                // This causes Tauri to send requests WITHOUT the Authorization header, returning 401s for valid tokens.
                const rawResponse = await apiFetch('/api/auth/get-session');
                
                if (rawResponse.ok) {
                   sessionResponse = await rawResponse.json();
                } else {
                   log.warn(`Direct fetch get-session returned ${rawResponse.status}`);
                   sessionResponse = { error: { message: `HTTP ${rawResponse.status}`, status: rawResponse.status } };
                }
             } catch (fetchErr) {
                 log.error('Direct fetch fallback failed:', fetchErr);
                 throw fetchErr;
             }
            
            // Handle both { data, error } and direct { user, session } response formats
            const data = sessionResponse?.data || sessionResponse;
            const error = sessionResponse?.error;
            
            // Prefer fresh token from server, then passed token, then fallback to existing
            const freshToken = data?.session?.token;
            const tokenToUse = freshToken || token || get().session?.token;
            
            log.debug('Session refresh response:', {
                hasUser: !!data?.user,
                hasToken: !!freshToken,
                userEmail: data?.user?.email,
                error: error
            });
            
            if (data?.user) {
              const user = data.user
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
              
              log.debug('Session refreshed, token set:', tokenToUse ? `...${tokenToUse.slice(-6)}` : null);
              return true
            } else {
              // Session expired or invalid
              
              const currentToken = get().session?.token;
              
              // RACE CONDITION GUARD:
              // Only preserve the session if the token has CHANGED while we were waiting.
              // If initialToken !== currentToken, it means a login happened in parallel.
              if (currentToken && currentToken !== initialToken) {
                 log.debug('Token changed during refresh (concurrent login detected). Keeping new session.');
                 set({ isLoading: false });
                 return true; 
              }
              
              log.warn('Refresh failed: No user returned and no concurrent login.');

              // Check if we have a local token - if so, DON'T reset
              // The server might have rejected the cookie but the local session might still work
              const localToken = get().session?.token;
              if (localToken) {
                log.debug('No user from server but local token exists - keeping user logged in');
                set({ isLoading: false });
                return true;
              }
              
              // Otherwise, the session is truly dead.
              // Force local reset so route guards stop treating the user as authenticated.
              log.debug('Refresh returned no user and no local token. Resetting local auth state.');
              get().reset()
              return false
            }
          } catch (error: any) {
            log.error('Error refreshing session:', error)
            
            // Only reset if it's explicitly an auth error (401/403)
            // For network errors (fetch failed) or server errors (500), keep the local session
            // This prevents "flickering" or logging out when the server is restarting/unreachable
            const isAuthError = error?.status === 401 || error?.status === 403 || 
                               (error?.message && (error.message.includes('401') || error.message.includes('403')));
            
            if (isAuthError) {
                // Check if we have a local token - if so, don't reset
                const localToken = get().session?.token;
                if (localToken) {
                    log.debug('Auth error but local token exists - not resetting');
                    set({ isLoading: false, error: null });
                    return true;
                }
                log.debug('Auth error detected, resetting session');
                get().reset()
            } else {
                log.debug('Non-auth error during refresh, retaining session');
                // Keep the user logged in on non-auth errors
                set({ isLoading: false });
                return true;
            }
            
            set({ error: 'Failed to refresh session' })
            return false
          } finally {
            set({ isLoading: false })
          }
        },

        checkSession: async () => {
          const { session, isAuthenticated } = get()
          
          // If we're not authenticated and have no session, no point checking
          if (!isAuthenticated && !session) {
            return false;
          }
          
          // If we have a stored session that's not expired, assume it's valid
          // The background refresh on focus can fail silently - we don't want to log users out
          // just because the refresh call had an issue
          if (session) {
            const now = Date.now()
            const sessionExpiry = new Date(session.expiresAt).getTime()
            
            // If session is still fresh (not within 5 min of expiry), consider it valid
            if (now < sessionExpiry - 5 * 60 * 1000) {
              log.debug('Local session valid, skipping refresh');
              set({ isLoading: false, lastActivity: now })
              return true
            }
            
            // Session is about to expire, try to refresh
            // But don't fail hard - if refresh fails, keep the old session
            log.debug('Session about to expire, attempting refresh...');
            const refreshResult = await get().refreshSession().catch(e => {
              log.error('Refresh failed:', e);
              return false;
            });
            
            if (refreshResult) {
              return true;
            }
            
            // Refresh failed but we still have a local session - keep user logged in
            log.debug('Refresh failed but local session exists, keeping user logged in');
            set({ isLoading: false });
            return true;
          }

          // No local session - try to get one from server
          // This handles the SSO login case where cookie exists but no local storage
          return await get().refreshSession()
        },
      }),
      {
        name: 'zentrio-auth-storage',
        version: 1,
        migrate: (persistedState: any, version: number) => {
          if (version < 1) {
            log.debug('Migrating auth storage from v0 to v1: removing web bearer tokens')
          }
          if (version < 2) {
            log.debug('Migrating auth storage from v1 to v2')
          }
          return persistedState
        },
        partialize: (state) => {
          const webPlatform = isWebPlatform()

          if (webPlatform) {
            return {
              user: state.user,
              isAuthenticated: state.isAuthenticated,
              lastActivity: state.lastActivity,
            }
          }

          return {
            user: state.user,
            session: state.session,
            isAuthenticated: state.isAuthenticated,
            lastActivity: state.lastActivity,
          }
        },
        onRehydrateStorage: () => (state) => {
          const hasSession = !!state?.session?.token;
          
          // Check if we just logged in (in-memory flag check)
          // accessing get() inside here might be tricky, so we rely on the state passed in
          const isJustLoggedIn = state?.isFreshLogin;

          log.debug('Rehydrated state:', { 
              isAuthenticated: state?.isAuthenticated,
              isFreshLogin: isJustLoggedIn,
              hasSession,
              tokenSuffix: state?.session?.token ? `...${state.session.token.slice(-6)}` : null
          });
          
          if (state && typeof state.setLoading === 'function') {
               // Unblock UI if we seem authenticated. On the web, hasSession might be false 
               // (cookies only), so we trust isAuthenticated to unblock the initial loading screen.
               if (state.isAuthenticated || hasSession) {
                   state.setLoading(false);
               }
          }
          
          // If this is a fresh login, absolutely do NOT trigger a refresh
          if (isJustLoggedIn) {
              log.debug('Fresh login detected - suppressing auto-refresh and forcing loaded state');
              if (state) {
                  state.isFreshLogin = false; // consume flag
                  state.setLoading(false); 
              }
              return;
          }

          if (state) {
              log.debug('Cold start detected - verifying session state...');

              // Use queueMicrotask to defer session check without an artificial delay.
              // The 500ms timeout was removed as it blocked the UI unnecessarily on every cold start.
              Promise.resolve().then(async () => {
                  log.debug('Executing rehydration check (background)');

                  // If we don't have local auth state, we still need to check the server
                  // because the user might have logged in via SSO or have an active cookie
                  if (!state.isAuthenticated && !hasSession && typeof state.refreshSession === 'function') {
                      await state.refreshSession();
                  } else if (typeof state.checkSession === 'function') {
                      await state.checkSession();
                  }

                  // Ensure loading state is false after check completes (e.g. for unauthenticated guests)
                  if (typeof state.setLoading === 'function') {
                      state.setLoading(false);
                  }
              });
          }
        },
      }
    )
  )
)

// Auto-session refresh hook
export const useSessionRefresh = () => {
  const { checkSession, refreshSession, isAuthenticated } = useAuthStore()

  // Check session every 5 minutes
  React.useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(() => {
      // Force periodic server sync so role/ban changes (e.g. admin promotion)
      // propagate even when the local session is far from expiry.
      refreshSession().catch((e: any) => log.error('Error:', e))
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [isAuthenticated, refreshSession])

  // Check session on window focus, but only after a meaningful gap (5 minutes).
  // Short focus round-trips (e.g. opening a file dialog, alt-tabbing briefly) must NOT
  // trigger a session check – that causes the settings page and any open modals to
  // re-render / remount.
  React.useEffect(() => {
    if (!isAuthenticated) return

    let lastFocusTime = Date.now()
    const MIN_FOCUS_GAP_MS = 5 * 60 * 1000

    const handleBlur = () => {
      lastFocusTime = Date.now()
    }

    const handleFocus = () => {
      const gap = Date.now() - lastFocusTime
      if (gap > MIN_FOCUS_GAP_MS) {
        checkSession().catch((e: any) => log.error('Error:', e))
      }
    }

    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
    }
  }, [isAuthenticated, checkSession])
}
