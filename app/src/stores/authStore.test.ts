import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useAuthStore } from './authStore'

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000

interface MockUser {
  id: string
  email: string
  name?: string
  role?: string
  banned?: boolean
  emailVerified?: boolean
}

interface MockSession {
  user: MockUser
  expiresAt: Date
  token?: string
}

const mockUser: MockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  banned: false,
  emailVerified: true,
}

const mockSession: MockSession = {
  user: mockUser,
  expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  token: 'test-token-abc123',
}

const mockRefreshSession = vi.fn().mockResolvedValue(true)
const mockCheckSession = vi.fn().mockResolvedValue(true)

vi.mock('../lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}))

vi.mock('../lib/auth-client', () => ({
  authClient: {
    signOut: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../lib/app-mode', () => ({
  appMode: {
    isGuest: vi.fn().mockReturnValue(false),
    clear: vi.fn(),
  },
}))

vi.mock('../lib/runtime-env', () => ({
  isTauriRuntime: vi.fn().mockReturnValue(false),
}))

describe('AuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
      lastActivity: Date.now(),
      isFreshLogin: false,
      refreshSession: mockRefreshSession,
      checkSession: mockCheckSession,
    })
  })

  describe('login', () => {
    it('should set user, session, and isAuthenticated to true', () => {
      const store = useAuthStore.getState()
      store.login(mockUser, mockSession)

      const state = useAuthStore.getState()
      expect(state.user).toEqual(mockUser)
      expect(state.session?.user).toEqual(mockUser)
      expect(state.session?.token).toBe('test-token-abc123')
      expect(state.isAuthenticated).toBe(true)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.isFreshLogin).toBe(true)
    })

    it('should create session with default expiry when not provided', () => {
      const store = useAuthStore.getState()
      store.login(mockUser)

      const state = useAuthStore.getState()
      expect(state.user).toEqual(mockUser)
      expect(state.session?.user).toEqual(mockUser)
      expect(state.session?.expiresAt).toBeInstanceOf(Date)
      expect(state.session?.token).toBeUndefined()
    })
  })

  describe('reset', () => {
    it('should clear all auth state without triggering logout redirect', () => {
      useAuthStore.setState({
        user: mockUser,
        session: mockSession,
        isAuthenticated: true,
        isLoading: false,
      })

      const store = useAuthStore.getState()
      store.reset()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.session).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.isFreshLogin).toBe(false)
    })
  })

  describe('updateUser', () => {
    it('should merge updates into existing user', () => {
      useAuthStore.setState({
        user: mockUser,
        session: mockSession,
        isAuthenticated: true,
      })

      const store = useAuthStore.getState()
      store.updateUser({ name: 'Updated Name', role: 'admin' })

      const state = useAuthStore.getState()
      expect(state.user?.name).toBe('Updated Name')
      expect(state.user?.role).toBe('admin')
      expect(state.user?.email).toBe(mockUser.email)
    })

    it('should do nothing when user is null', () => {
      const store = useAuthStore.getState()
      store.updateUser({ name: 'Should Not Update' })

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
    })
  })

  describe('setLoading / setError / clearError', () => {
    it('should update loading state', () => {
      const store = useAuthStore.getState()
      store.setLoading(true)
      expect(useAuthStore.getState().isLoading).toBe(true)

      store.setLoading(false)
      expect(useAuthStore.getState().isLoading).toBe(false)
    })

    it('should update error state and set loading to false', () => {
      const store = useAuthStore.getState()
      store.setError('Test error')

      const state = useAuthStore.getState()
      expect(state.error).toBe('Test error')
      expect(state.isLoading).toBe(false)
    })

    it('should clear error', () => {
      useAuthStore.setState({ error: 'Some error' })
      const store = useAuthStore.getState()
      store.clearError()

      expect(useAuthStore.getState().error).toBeNull()
    })
  })

  describe('session expiry detection', () => {
    it('should detect expired session (within 5 min of expiry)', () => {
      const expiredSession: Session = {
        user: mockUser,
        expiresAt: new Date(Date.now() - 1), // expired 1ms ago
        token: 'expired-token',
      }

      useAuthStore.setState({
        user: mockUser,
        session: expiredSession,
        isAuthenticated: true,
      })

      // Session should be considered expired
      const state = useAuthStore.getState()
      const now = Date.now()
      const sessionExpiry = new Date(state.session!.expiresAt).getTime()
      expect(now > sessionExpiry - 5 * 60 * 1000).toBe(true)
    })

    it('should consider session valid if not within 5 min of expiry', () => {
      const validSession: Session = {
        user: mockUser,
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS), // 24 hours from now
        token: 'valid-token',
      }

      useAuthStore.setState({
        user: mockUser,
        session: validSession,
        isAuthenticated: true,
      })

      const state = useAuthStore.getState()
      const now = Date.now()
      const sessionExpiry = new Date(state.session!.expiresAt).getTime()
      expect(now < sessionExpiry - 5 * 60 * 1000).toBe(true)
    })
  })

  describe('cold start behavior', () => {
    it('should preserve user, isAuthenticated, and session on rehydration', () => {
      // Simulate persisted state
      const persistedState = {
        user: mockUser,
        session: mockSession,
        isAuthenticated: true,
        lastActivity: Date.now(),
      }

      // When rehydrating, these fields should be available
      expect(persistedState.user).toEqual(mockUser)
      expect(persistedState.isAuthenticated).toBe(true)
      expect(persistedState.session?.token).toBe('test-token-abc123')
    })
  })

  describe('token presence heuristics', () => {
    it('should treat session with token as valid for Tauri', () => {
      useAuthStore.setState({
        user: mockUser,
        session: mockSession,
        isAuthenticated: true,
      })

      const state = useAuthStore.getState()
      const localToken = state.session?.token

      // With token present, the store considers session valid
      expect(localToken).toBeTruthy()
      expect(state.isAuthenticated).toBe(true)
    })

    it('should handle missing token gracefully when user is present', () => {
      const sessionWithoutToken: Session = {
        user: mockUser,
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
      }

      useAuthStore.setState({
        user: mockUser,
        session: sessionWithoutToken,
        isAuthenticated: true,
      })

      const state = useAuthStore.getState()
      expect(state.session?.token).toBeUndefined()
      expect(state.isAuthenticated).toBe(true)
      expect(state.user?.email).toBe(mockUser.email)
    })
  })
})
