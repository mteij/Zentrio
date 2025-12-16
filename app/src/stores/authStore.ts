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
  refreshSession: () => Promise<boolean>
  checkSession: () => Promise<boolean>
}

export const useAuthStore = create<AuthState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        lastActivity: Date.now(),

        login: (user, session) => {
          const now = Date.now()
          set({
            user,
            session: session || { user, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }, // Default 24h
            isAuthenticated: true,
            error: null,
            lastActivity: now,
          })
        },

        logout: async () => {
          try {
            // Call Better Auth sign out
            await authClient.signOut()
          } catch (error) {
            console.error('Error during sign out:', error)
          } finally {
            set({
              user: null,
              session: null,
              isAuthenticated: false,
              error: null,
              lastActivity: Date.now(),
            })
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

        refreshSession: async () => {
          try {
            set({ isLoading: true, error: null })
            const session = await authClient.getSession()
            
            if (session?.data?.user) {
              const user = session.data.user
              // Create a proper session object with expiresAt
              const sessionData = {
                user,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Default 24h from now
              }
              get().login(user, sessionData)
              return true
            } else {
              // Session expired or invalid
              await get().logout()
              return false
            }
          } catch (error) {
            console.error('Error refreshing session:', error)
            set({ error: 'Failed to refresh session' })
            await get().logout()
            return false
          } finally {
            set({ isLoading: false })
          }
        },

        checkSession: async () => {
          const { session, lastActivity } = get()
          
          // Check if session exists and hasn't expired
          if (!session) {
            return false
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
          // Check session validity on rehydration
          if (state?.isAuthenticated) {
            state.checkSession().catch(console.error)
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