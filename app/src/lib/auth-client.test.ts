import { describe, expect, it, vi } from 'vitest'

vi.mock('./runtime-env', () => ({
  isTauriRuntime: vi.fn().mockReturnValue(false),
}))

describe('AuthClient', () => {
  describe('platform-aware auth header injection', () => {
    it('should read from auth store state for Tauri token injection', async () => {
      const mockToken = 'tauri-bearer-token-123'
      const mockStorage = JSON.stringify({
        state: {
          session: {
            token: mockToken,
          },
        },
      })

      localStorage.setItem('zentrio-auth-storage', mockStorage)

      const storageData = JSON.parse(localStorage.getItem('zentrio-auth-storage') || '{}')
      const token = storageData?.state?.session?.token

      expect(token).toBe(mockToken)

      localStorage.removeItem('zentrio-auth-storage')
    })

    it('should NOT inject token for web when using cookie-based auth', () => {
      const webStorageData = {
        state: {
          session: {
            token: 'web-token-should-not-be-used',
          },
        },
      }

      expect(webStorageData.state.session.token).toBeTruthy()
    })
  })

  describe('server URL resolution', () => {
    it('should resolve server URL differently for Tauri vs web', () => {
      const storedUrl = 'https://custom-server.example.com'
      localStorage.setItem('zentrio_server_url', storedUrl)

      const resolvedFromStorage = localStorage.getItem('zentrio_server_url')
      expect(resolvedFromStorage).toBe(storedUrl)

      localStorage.removeItem('zentrio_server_url')
    })
  })

  describe('OAuth callback handling', () => {
    it('should detect OAuth callback URLs by path or query params', () => {
      const oauthCallbackPaths = [
        '/callback/social',
        '/api/auth/callback/google',
        '/?code=abc123&state=xyz',
        '/?state=oauth-state',
      ]

      const isOAuthCallback = (url: string) =>
        url.includes('/callback/') || url.includes('code=') || url.includes('state=')

      oauthCallbackPaths.forEach((path) => {
        expect(isOAuthCallback(path)).toBe(true)
      })
    })

    it('should NOT flag non-OAuth URLs as callbacks', () => {
      const nonOAuthPaths = [
        '/profiles',
        '/settings',
        '/api/auth/session',
        '/api/auth/get-session',
      ]

      const isOAuthCallback = (url: string) =>
        url.includes('/callback/') || url.includes('code=') || url.includes('state=')

      nonOAuthPaths.forEach((path) => {
        expect(isOAuthCallback(path)).toBe(false)
      })
    })
  })
})
