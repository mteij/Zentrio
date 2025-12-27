// Trakt API Client
// Reference: https://trakt.docs.apiary.io/

import { getConfig } from '../envParser'
import type {
  DeviceCodeResponse,
  TokenResponse,
  TraktHistoryItem,
  TraktMovieRecommendation,
  TraktShowRecommendation,
  TraktUser,
  TraktSyncRequest,
  TraktSyncResponse
} from './types'

const TRAKT_API_BASE = 'https://api.trakt.tv'
const TRAKT_API_VERSION = '2'

class TraktClient {
  private getCredentials() {
    const cfg = getConfig()
    return {
      clientId: cfg.TRAKT_CLIENT_ID,
      clientSecret: cfg.TRAKT_CLIENT_SECRET
    }
  }

  private getBaseHeaders(): Record<string, string> {
    const { clientId } = this.getCredentials()
    return {
      'Content-Type': 'application/json',
      'trakt-api-version': TRAKT_API_VERSION,
      'trakt-api-key': clientId || ''
    }
  }

  private getAuthHeaders(accessToken: string): Record<string, string> {
    return {
      ...this.getBaseHeaders(),
      'Authorization': `Bearer ${accessToken}`
    }
  }

  // ============================================================================
  // Configuration Check
  // ============================================================================

  isConfigured(): boolean {
    const { clientId, clientSecret } = this.getCredentials()
    return !!(clientId && clientSecret)
  }

  // ============================================================================
  // OAuth Redirect Flow (for browser)
  // ============================================================================

  getAuthUrl(redirectUri: string, state: string): string {
    const { clientId } = this.getCredentials()
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId || '',
      redirect_uri: redirectUri,
      state
    })
    return `https://trakt.tv/oauth/authorize?${params.toString()}`
  }

  async exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
    const { clientId, clientSecret } = this.getCredentials()
    
    const response = await fetch(`${TRAKT_API_BASE}/oauth/token`, {
      method: 'POST',
      headers: this.getBaseHeaders(),
      body: JSON.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error_description || `Token exchange failed: ${response.status}`)
    }

    return response.json()
  }

  // ============================================================================
  // Device Code Flow (for Tauri/limited input devices)
  // ============================================================================

  async getDeviceCode(): Promise<DeviceCodeResponse> {
    const { clientId } = this.getCredentials()

    const response = await fetch(`${TRAKT_API_BASE}/oauth/device/code`, {
      method: 'POST',
      headers: this.getBaseHeaders(),
      body: JSON.stringify({
        client_id: clientId
      })
    })

    if (!response.ok) {
      throw new Error(`Failed to get device code: ${response.status}`)
    }

    return response.json()
  }

  async pollForToken(deviceCode: string): Promise<TokenResponse | 'pending' | 'expired'> {
    const { clientId, clientSecret } = this.getCredentials()

    const response = await fetch(`${TRAKT_API_BASE}/oauth/device/token`, {
      method: 'POST',
      headers: this.getBaseHeaders(),
      body: JSON.stringify({
        code: deviceCode,
        client_id: clientId,
        client_secret: clientSecret
      })
    })

    // Handle different response codes
    if (response.status === 200) {
      return response.json()
    } else if (response.status === 400) {
      // Authorization pending - user hasn't authorized yet
      return 'pending'
    } else if (response.status === 404) {
      // Invalid device code
      throw new Error('Invalid device code')
    } else if (response.status === 409) {
      // Code already approved - should have gotten 200
      throw new Error('Code already approved')
    } else if (response.status === 410) {
      // Tokens expired
      return 'expired'
    } else if (response.status === 418) {
      // User denied the code
      throw new Error('User denied authorization')
    } else if (response.status === 429) {
      // Polling too fast
      throw new Error('Polling too fast, slow down')
    }

    throw new Error(`Unexpected response: ${response.status}`)
  }

  // ============================================================================
  // Token Management
  // ============================================================================

  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const { clientId, clientSecret } = this.getCredentials()

    const response = await fetch(`${TRAKT_API_BASE}/oauth/token`, {
      method: 'POST',
      headers: this.getBaseHeaders(),
      body: JSON.stringify({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token'
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error_description || `Token refresh failed: ${response.status}`)
    }

    return response.json()
  }

  async revokeToken(accessToken: string): Promise<void> {
    const { clientId, clientSecret } = this.getCredentials()

    await fetch(`${TRAKT_API_BASE}/oauth/revoke`, {
      method: 'POST',
      headers: this.getBaseHeaders(),
      body: JSON.stringify({
        token: accessToken,
        client_id: clientId,
        client_secret: clientSecret
      })
    })
    // Ignore response - best effort revocation
  }

  // ============================================================================
  // User API
  // ============================================================================

  async getUser(accessToken: string): Promise<TraktUser> {
    const response = await fetch(`${TRAKT_API_BASE}/users/me`, {
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok) {
      throw new Error(`Failed to get user: ${response.status}`)
    }

    return response.json()
  }

  // ============================================================================
  // History API
  // ============================================================================

  async getWatchedHistory(
    accessToken: string,
    type?: 'movies' | 'shows' | 'episodes',
    startAt?: Date,
    limit: number = 100
  ): Promise<TraktHistoryItem[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      page: '1'
    })

    if (startAt) {
      params.set('start_at', startAt.toISOString())
    }

    const typePath = type ? `/${type}` : ''
    const response = await fetch(
      `${TRAKT_API_BASE}/sync/history${typePath}?${params.toString()}`,
      { headers: this.getAuthHeaders(accessToken) }
    )

    if (!response.ok) {
      throw new Error(`Failed to get history: ${response.status}`)
    }

    return response.json()
  }

  async addToHistory(accessToken: string, items: TraktSyncRequest): Promise<TraktSyncResponse> {
    const response = await fetch(`${TRAKT_API_BASE}/sync/history`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify(items)
    })

    if (!response.ok) {
      throw new Error(`Failed to add to history: ${response.status}`)
    }

    return response.json()
  }

  async removeFromHistory(accessToken: string, items: TraktSyncRequest): Promise<TraktSyncResponse> {
    const response = await fetch(`${TRAKT_API_BASE}/sync/history/remove`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify(items)
    })

    if (!response.ok) {
      throw new Error(`Failed to remove from history: ${response.status}`)
    }

    return response.json()
  }

  // ============================================================================
  // Recommendations API
  // ============================================================================

  async getMovieRecommendations(
    accessToken: string,
    limit: number = 20
  ): Promise<TraktMovieRecommendation[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ignore_collected: 'true'
    })

    const response = await fetch(
      `${TRAKT_API_BASE}/recommendations/movies?${params.toString()}`,
      { headers: this.getAuthHeaders(accessToken) }
    )

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized - token may be expired')
      }
      throw new Error(`Failed to get movie recommendations: ${response.status}`)
    }

    // The API returns movies directly, not wrapped in { movie: ... }
    const movies = await response.json()
    return movies.map((movie: any) => ({ movie }))
  }

  async getShowRecommendations(
    accessToken: string,
    limit: number = 20
  ): Promise<TraktShowRecommendation[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ignore_collected: 'true'
    })

    const response = await fetch(
      `${TRAKT_API_BASE}/recommendations/shows?${params.toString()}`,
      { headers: this.getAuthHeaders(accessToken) }
    )

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized - token may be expired')
      }
      throw new Error(`Failed to get show recommendations: ${response.status}`)
    }

    // The API returns shows directly, not wrapped in { show: ... }
    const shows = await response.json()
    return shows.map((show: any) => ({ show }))
  }

  // ============================================================================
  // Scrobble API (Real-time playback tracking)
  // ============================================================================

  /**
   * Start scrobbling - call when playback starts
   * @param accessToken User's access token
   * @param item Movie or episode being watched
   * @param progress Progress percentage (0-100)
   */
  async scrobbleStart(
    accessToken: string,
    item: any,
    progress: number
  ): Promise<{ id: number; action: string }> {
    const response = await fetch(`${TRAKT_API_BASE}/scrobble/start`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify({
        ...item,
        progress: Math.round(progress)
      })
    })

    if (!response.ok) {
      throw new Error(`Scrobble start failed: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Pause scrobbling - call when playback is paused
   */
  async scrobblePause(
    accessToken: string,
    item: any,
    progress: number
  ): Promise<{ id: number; action: string }> {
    const response = await fetch(`${TRAKT_API_BASE}/scrobble/pause`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify({
        ...item,
        progress: Math.round(progress)
      })
    })

    if (!response.ok) {
      throw new Error(`Scrobble pause failed: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Stop scrobbling - call when playback stops
   * If progress >= 80%, Trakt will automatically mark as watched
   */
  async scrobbleStop(
    accessToken: string,
    item: any,
    progress: number
  ): Promise<{ id: number; action: string }> {
    const response = await fetch(`${TRAKT_API_BASE}/scrobble/stop`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify({
        ...item,
        progress: Math.round(progress)
      })
    })

    if (!response.ok) {
      throw new Error(`Scrobble stop failed: ${response.status}`)
    }

    return response.json()
  }

  // ============================================================================
  // Checkin API (Social check-in feature)
  // ============================================================================

  /**
   * Check in to a movie or episode
   * Only one active check-in allowed at a time
   * @param accessToken User's access token
   * @param item Movie or episode to check into
   * @param message Optional sharing message
   */
  async checkin(
    accessToken: string,
    item: any,
    message?: string
  ): Promise<{ id: number; watched_at: string }> {
    const body: any = { ...item }
    if (message) {
      body.sharing = { text: message }
    }

    const response = await fetch(`${TRAKT_API_BASE}/checkin`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify(body)
    })

    if (response.status === 409) {
      // Already checked in - need to delete first
      throw new Error('Already checked in. Cancel current check-in first.')
    }

    if (!response.ok) {
      throw new Error(`Check-in failed: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Cancel/delete active check-in
   */
  async cancelCheckin(accessToken: string): Promise<void> {
    const response = await fetch(`${TRAKT_API_BASE}/checkin`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(accessToken)
    })

    if (!response.ok && response.status !== 204) {
      throw new Error(`Cancel check-in failed: ${response.status}`)
    }
  }
}

export const traktClient = new TraktClient()
