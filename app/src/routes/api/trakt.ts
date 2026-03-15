// Trakt API Routes
// Handles authentication flows, sync operations, and recommendations

import { randomBytes } from 'crypto'
import { optionalSessionMiddleware } from '../../middleware/session'
import { addonManager } from '../../services/addons/addon-manager'
import { profileDb, profileProxySettingsDb, traktAccountDb, traktSyncStateDb, type User } from '../../services/database'
import { getConfig } from '../../services/envParser'
import { logger } from '../../services/logger'
import { AGE_RATINGS, toStandardAgeRating, type AgeRating } from '../../services/tmdb/age-ratings'
import { traktClient, traktSyncService } from '../../services/trakt'
import { err, ok } from '../../utils/api'
import { createTaggedOpenAPIApp } from './openapi-route'

const log = logger.scope('API:Trakt')

const trakt = createTaggedOpenAPIApp<{
  Variables: {
    user: User | null
    guestMode: boolean
    session: any
  }
}>('Trakt')

// Store pending device codes in memory (with expiry)
const pendingDeviceCodes = new Map<string, {
  deviceCode: string
  userCode: string
  verificationUrl: string
  expiresAt: number
  interval: number
  profileId: number
  userId: string
}>()

// Store pending OAuth states in memory (with expiry) for CSRF/IDOR protection
const pendingOAuthStates = new Map<string, {
  profileId: number
  userId: string
  redirectUri: string
  expiresAt: number
}>()

// Cleanup expired codes and states periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of pendingDeviceCodes) {
    if (value.expiresAt < now) {
      pendingDeviceCodes.delete(key)
    }
  }
  for (const [key, value] of pendingOAuthStates) {
    if (value.expiresAt < now) {
      pendingOAuthStates.delete(key)
    }
  }
}, 60000)

/**
 * Verify that the authenticated user owns the given profileId.
 */
function userOwnsProfile(userId: string, profileId: number): boolean {
  const profile = profileDb.findById(profileId)
  return profile?.user_id === userId
}

// ============================================================================
// Public routes (check if Trakt is configured)
// ============================================================================

// [GET /available] Check if Trakt integration is available
trakt.get('/available', (c) => {
  return ok(c, { available: traktClient.isConfigured() })
})

// ============================================================================
// Protected routes
// ============================================================================
trakt.use('*', optionalSessionMiddleware)

// [GET /status] Get Trakt connection status for a profile
trakt.get('/status', async (c) => {
  try {
    const isGuestMode = c.get('guestMode')
    if (isGuestMode) {
      return ok(c, {
        connected: false,
        available: false
      })
    }

    const { profileId } = c.req.query()
    if (!profileId) {
      return err(c, 400, 'INVALID_INPUT', 'profileId required')
    }

    const pId = parseInt(profileId)
    const account = traktAccountDb.getByProfileId(pId)
    const syncState = traktSyncStateDb.getByProfileId(pId)
    const configured = traktClient.isConfigured()

    if (!account || !configured) {
      return ok(c, {
        connected: false,
        available: configured
      })
    }

    return ok(c, {
      connected: true,
      available: configured,
      username: account.trakt_username,
      userId: account.trakt_user_id,
      syncEnabled: syncState?.sync_enabled ?? true,
      pushToTrakt: syncState?.push_to_trakt ?? true,
      lastHistorySync: syncState?.last_history_sync,
      lastPushSync: syncState?.last_push_sync
    })
  } catch (e) {
    log.error('Status check failed:', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to get status')
  }
})

// ============================================================================
// OAuth Redirect Flow
// ============================================================================

// [GET /auth-url] Get OAuth authorization URL
trakt.get('/auth-url', async (c) => {
  try {
    if (c.get('guestMode')) {
      return err(c, 403, 'GUEST_MODE_DISABLED', 'Trakt integration is disabled in guest mode')
    }

    const sessionUser = c.get('user')
    if (!sessionUser) {
      return err(c, 401, 'UNAUTHORIZED', 'Authentication required')
    }

    if (!traktClient.isConfigured()) {
      return err(c, 400, 'NOT_CONFIGURED', 'Trakt integration is not configured')
    }

    const { profileId, isTauri } = c.req.query()
    if (!profileId) {
      return err(c, 400, 'INVALID_INPUT', 'profileId required')
    }

    const pId = parseInt(profileId)
    if (isNaN(pId) || !userOwnsProfile(sessionUser.id, pId)) {
      return err(c, 403, 'FORBIDDEN', 'Access denied')
    }

    const cfg = getConfig()

    // Generate a state token and store it server-side (prevents IDOR/CSRF on callback)
    const stateToken = randomBytes(16).toString('hex')
    const state = `${profileId}:${stateToken}`

    // Determine redirect URI based on context
    const redirectUri = isTauri === 'true'
      ? 'zentrio://trakt/callback'
      : `${cfg.APP_URL}/api/trakt/callback`

    // Store state server-side so /callback can validate it
    pendingOAuthStates.set(stateToken, {
      profileId: pId,
      userId: sessionUser.id,
      redirectUri,
      expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
    })

    const authUrl = traktClient.getAuthUrl(redirectUri, state)

    return ok(c, { authUrl, state })
  } catch (e) {
    log.error('Auth URL generation failed:', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to generate auth URL')
  }
})

// [GET /callback] Handle OAuth callback (web flow)
trakt.get('/callback', async (c) => {
  try {
    const { code, state, error } = c.req.query()

    if (error) {
      // User denied or error occurred
      return c.redirect('/settings?trakt_error=' + encodeURIComponent(error))
    }

    if (!code || !state) {
      return c.redirect('/settings?trakt_error=missing_params')
    }

    // Validate state token server-side to prevent IDOR/CSRF
    const stateToken = state.split(':')[1]
    if (!stateToken) {
      return c.redirect('/settings?trakt_error=invalid_state')
    }

    const pendingState = pendingOAuthStates.get(stateToken)
    if (!pendingState) {
      return c.redirect('/settings?trakt_error=invalid_state')
    }

    // One-time use
    pendingOAuthStates.delete(stateToken)

    if (Date.now() > pendingState.expiresAt) {
      return c.redirect('/settings?trakt_error=state_expired')
    }

    // Use profileId from server-stored state, not from user-controlled URL
    const profileId = pendingState.profileId
    const redirectUri = pendingState.redirectUri

    // Exchange code for tokens
    const tokens = await traktClient.exchangeCode(code, redirectUri)
    
    // Get user info
    const user = await traktClient.getUser(tokens.access_token)
    
    // Calculate expiry time
    const expiresAt = new Date((tokens.created_at + tokens.expires_in) * 1000)

    // Save to database
    traktAccountDb.upsert(profileId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      trakt_user_id: user.ids.slug,
      trakt_username: user.username
    })

    // Initialize sync state with defaults
    traktSyncStateDb.getOrCreate(profileId)

    // Trigger initial sync in background
    traktSyncService.sync(profileId).catch(e => {
      log.error('Initial sync failed:', e)
    })

    return c.redirect('/settings?trakt_connected=true')
  } catch (e) {
    log.error('Callback failed:', e)
    return c.redirect('/settings?trakt_error=' + encodeURIComponent('auth_failed'))
  }
})

// [POST /exchange-code] Exchange auth code for tokens (SPA/Tauri flow)
trakt.post('/exchange-code', async (c) => {
  try {
    if (c.get('guestMode')) {
      return err(c, 403, 'GUEST_MODE_DISABLED', 'Trakt integration is disabled in guest mode')
    }

    const sessionUser = c.get('user')
    if (!sessionUser) {
      return err(c, 401, 'UNAUTHORIZED', 'Authentication required')
    }

    const body = await c.req.json()
    const { code, state } = body

    if (!code || !state) {
      return err(c, 400, 'INVALID_INPUT', 'code and state required')
    }

    // Validate state token server-side
    const stateToken = state.split(':')[1]
    if (!stateToken) {
      return err(c, 400, 'INVALID_INPUT', 'Invalid state parameter')
    }

    const pendingState = pendingOAuthStates.get(stateToken)
    if (!pendingState) {
      return err(c, 400, 'INVALID_STATE', 'State token not found or expired')
    }

    // One-time use
    pendingOAuthStates.delete(stateToken)

    if (Date.now() > pendingState.expiresAt) {
      return err(c, 400, 'STATE_EXPIRED', 'State token has expired')
    }

    // Verify authenticated user matches state owner
    if (sessionUser.id !== pendingState.userId) {
      return err(c, 403, 'FORBIDDEN', 'Session mismatch')
    }

    const profileId = pendingState.profileId
    const redirectUri = pendingState.redirectUri

    // Exchange code for tokens
    const tokens = await traktClient.exchangeCode(code, redirectUri)

    // Get user info
    const user = await traktClient.getUser(tokens.access_token)

    // Calculate expiry time
    const expiresAt = new Date((tokens.created_at + tokens.expires_in) * 1000)

    // Save to database
    traktAccountDb.upsert(profileId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      trakt_user_id: user.ids.slug,
      trakt_username: user.username
    })

    // Initialize sync state
    traktSyncStateDb.getOrCreate(profileId)

    // Trigger initial sync in background
    traktSyncService.sync(profileId).catch(e => {
      log.error('Initial sync failed:', e)
    })

    return ok(c, {
      connected: true,
      username: user.username,
      userId: user.ids.slug
    })
  } catch (e) {
    log.error('Code exchange failed:', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to exchange code')
  }
})

// ============================================================================
// Device Code Flow
// ============================================================================

// [POST /device-code] Generate device code for user to enter at trakt.tv/activate
trakt.post('/device-code', async (c) => {
  try {
    if (c.get('guestMode')) {
      return err(c, 403, 'GUEST_MODE_DISABLED', 'Trakt integration is disabled in guest mode')
    }

    const sessionUser = c.get('user')
    if (!sessionUser) {
      return err(c, 401, 'UNAUTHORIZED', 'Authentication required')
    }

    if (!traktClient.isConfigured()) {
      return err(c, 400, 'NOT_CONFIGURED', 'Trakt integration is not configured')
    }

    const body = await c.req.json()
    const { profileId } = body

    if (!profileId) {
      return err(c, 400, 'INVALID_INPUT', 'profileId required')
    }

    const pId = parseInt(profileId)
    if (isNaN(pId) || !userOwnsProfile(sessionUser.id, pId)) {
      return err(c, 403, 'FORBIDDEN', 'Access denied')
    }

    const response = await traktClient.getDeviceCode()

    // Store the device code for polling
    const pollToken = randomBytes(16).toString('hex')
    pendingDeviceCodes.set(pollToken, {
      deviceCode: response.device_code,
      userCode: response.user_code,
      verificationUrl: response.verification_url,
      expiresAt: Date.now() + (response.expires_in * 1000),
      interval: response.interval,
      profileId: pId,
      userId: sessionUser.id,
    })

    return ok(c, {
      pollToken,
      userCode: response.user_code,
      verificationUrl: response.verification_url,
      expiresIn: response.expires_in,
      interval: response.interval
    })
  } catch (e) {
    log.error('Device code generation failed:', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to generate device code')
  }
})

// [GET /poll-token] Poll for device authorization
trakt.get('/poll-token', async (c) => {
  try {
    if (c.get('guestMode')) {
      return err(c, 403, 'GUEST_MODE_DISABLED', 'Trakt integration is disabled in guest mode')
    }

    const sessionUser = c.get('user')
    if (!sessionUser) {
      return err(c, 401, 'UNAUTHORIZED', 'Authentication required')
    }

    const { pollToken } = c.req.query()

    if (!pollToken) {
      return err(c, 400, 'INVALID_INPUT', 'pollToken required')
    }

    const pending = pendingDeviceCodes.get(pollToken)
    if (!pending) {
      return err(c, 404, 'NOT_FOUND', 'Poll token not found or expired')
    }

    // Verify the polling user is the one who initiated the device code
    if (sessionUser.id !== pending.userId) {
      return err(c, 403, 'FORBIDDEN', 'Access denied')
    }

    // Check if expired
    if (Date.now() > pending.expiresAt) {
      pendingDeviceCodes.delete(pollToken)
      return ok(c, { status: 'expired' })
    }

    // Poll Trakt for authorization
    const result = await traktClient.pollForToken(pending.deviceCode)

    if (result === 'pending') {
      return ok(c, { status: 'pending' })
    }

    if (result === 'expired') {
      pendingDeviceCodes.delete(pollToken)
      return ok(c, { status: 'expired' })
    }

    // Success! Save tokens
    const user = await traktClient.getUser(result.access_token)
    const expiresAt = new Date((result.created_at + result.expires_in) * 1000)

    traktAccountDb.upsert(pending.profileId, {
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_at: expiresAt,
      trakt_user_id: user.ids.slug,
      trakt_username: user.username
    })

    // Initialize sync state
    traktSyncStateDb.getOrCreate(pending.profileId)

    // Cleanup
    pendingDeviceCodes.delete(pollToken)

    // Trigger initial sync in background
    traktSyncService.sync(pending.profileId).catch(e => {
      log.error('Initial sync failed:', e)
    })

    return ok(c, {
      status: 'authorized',
      username: user.username,
      userId: user.ids.slug
    })
  } catch (e: any) {
    log.error('Poll failed:', e)
    
    // Handle specific errors
    if (e.message?.includes('denied')) {
      return ok(c, { status: 'denied' })
    }
    
    return err(c, 500, 'SERVER_ERROR', 'Failed to poll for authorization')
  }
})

// ============================================================================
// Account Management
// ============================================================================

// [POST /disconnect] Disconnect Trakt from profile
trakt.post('/disconnect', async (c) => {
  try {
    if (c.get('guestMode')) {
      return err(c, 403, 'GUEST_MODE_DISABLED', 'Trakt integration is disabled in guest mode')
    }

    const sessionUser = c.get('user')
    if (!sessionUser) {
      return err(c, 401, 'UNAUTHORIZED', 'Authentication required')
    }

    const body = await c.req.json()
    const { profileId } = body

    if (!profileId) {
      return err(c, 400, 'INVALID_INPUT', 'profileId required')
    }

    const pId = parseInt(profileId)
    if (isNaN(pId) || !userOwnsProfile(sessionUser.id, pId)) {
      return err(c, 403, 'FORBIDDEN', 'Access denied')
    }
    const account = traktAccountDb.getByProfileId(pId)

    if (account) {
      // Revoke token (best effort)
      try {
        await traktClient.revokeToken(account.access_token)
      } catch (_e) {
        // Ignore revocation errors
      }

      // Delete from database
      traktAccountDb.delete(pId)
    }

    return ok(c, { disconnected: true })
  } catch (e) {
    log.error('Disconnect failed:', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to disconnect')
  }
})

// ============================================================================
// Sync Operations
// ============================================================================

// [POST /sync] Trigger manual sync
trakt.post('/sync', async (c) => {
  try {
    if (c.get('guestMode')) {
      return err(c, 403, 'GUEST_MODE_DISABLED', 'Trakt integration is disabled in guest mode')
    }

    const sessionUser = c.get('user')
    if (!sessionUser) {
      return err(c, 401, 'UNAUTHORIZED', 'Authentication required')
    }

    const body = await c.req.json()
    const { profileId } = body

    if (!profileId) {
      return err(c, 400, 'INVALID_INPUT', 'profileId required')
    }

    const pId = parseInt(profileId)
    if (isNaN(pId) || !userOwnsProfile(sessionUser.id, pId)) {
      return err(c, 403, 'FORBIDDEN', 'Access denied')
    }

    const result = await traktSyncService.sync(pId)
    
    if (!result.success) {
      return err(c, 500, 'SYNC_FAILED', result.error || 'Sync failed')
    }

    return ok(c, {
      pulled: result.pulled,
      pushed: result.pushed
    })
  } catch (e) {
    log.error('Manual sync failed:', e)
    return err(c, 500, 'SERVER_ERROR', 'Sync failed')
  }
})

// [PUT /sync-settings] Update sync settings
trakt.put('/sync-settings', async (c) => {
  try {
    if (c.get('guestMode')) {
      return err(c, 403, 'GUEST_MODE_DISABLED', 'Trakt integration is disabled in guest mode')
    }

    const sessionUser = c.get('user')
    if (!sessionUser) {
      return err(c, 401, 'UNAUTHORIZED', 'Authentication required')
    }

    const body = await c.req.json()
    const { profileId, syncEnabled, pushToTrakt } = body

    if (!profileId) {
      return err(c, 400, 'INVALID_INPUT', 'profileId required')
    }

    const pId = parseInt(profileId)
    if (isNaN(pId) || !userOwnsProfile(sessionUser.id, pId)) {
      return err(c, 403, 'FORBIDDEN', 'Access denied')
    }

    traktSyncStateDb.updateSettings(pId, {
      sync_enabled: syncEnabled,
      push_to_trakt: pushToTrakt
    })

    return ok(c, { updated: true })
  } catch (e) {
    log.error('Settings update failed:', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to update settings')
  }
})

// ============================================================================
// Recommendations
// ============================================================================

// [GET /recommendations] Get personalized recommendations
trakt.get('/recommendations', async (c) => {
  try {
    if (c.get('guestMode')) {
      return ok(c, { items: [], connected: false, available: false })
    }

    const { profileId, type = 'movies', limit = '20' } = c.req.query()

    if (!traktClient.isConfigured()) {
      return ok(c, { items: [], connected: false, available: false })
    }

    if (!profileId) {
      return err(c, 400, 'INVALID_INPUT', 'profileId required')
    }

    const pId = parseInt(profileId)
    const account = traktAccountDb.getByProfileId(pId)

    if (!account) {
      return ok(c, { items: [], connected: false })
    }

    // Get parental settings for age rating filtering
    const proxySettings = profileProxySettingsDb.findByProfileId(pId);
    const ageMap: Record<number, AgeRating> = {
      0: 'AL',
      6: '6',
      9: '9',
      12: '12',
      16: '16',
      18: '18'
    };
    const parentalSettings = {
      enabled: proxySettings?.nsfw_filter_enabled ?? false,
      ratingLimit: proxySettings?.nsfw_age_rating ? (ageMap[proxySettings.nsfw_age_rating] || '18' as AgeRating) : '18' as AgeRating
    };

    // Check if token needs refresh
    let accessToken = account.access_token
    if (traktAccountDb.isTokenExpired(pId)) {
      try {
        const newTokens = await traktClient.refreshAccessToken(account.refresh_token)
        const expiresAt = new Date((newTokens.created_at + newTokens.expires_in) * 1000)
        traktAccountDb.updateTokens(pId, newTokens.access_token, newTokens.refresh_token, expiresAt)
        accessToken = newTokens.access_token
      } catch (e) {
        log.error('Token refresh failed:', e)
        return ok(c, { items: [], connected: false, error: 'token_expired' })
      }
    }

    // Fetch more items initially to account for filtering - aim for 50 to ensure we get 10+ filtered items
    const limitNum = Math.min(parseInt(limit) || 50, 100)

    let items: any[] = []
    
    if (type === 'movies') {
      const recs = await traktClient.getMovieRecommendations(accessToken, limitNum)
      items = recs.map(rec => ({
        id: rec.movie.ids.imdb || `tmdb:${rec.movie.ids.tmdb}`,
        type: 'movie',
        name: rec.movie.title,
        year: rec.movie.year,
        imdb_id: rec.movie.ids.imdb,
        tmdb_id: rec.movie.ids.tmdb
      }))
    } else if (type === 'shows') {
      const recs = await traktClient.getShowRecommendations(accessToken, limitNum)
      items = recs.map(rec => ({
        id: rec.show.ids.imdb || `tmdb:${rec.show.ids.tmdb}`,
        type: 'series',
        name: rec.show.title,
        year: rec.show.year,
        imdb_id: rec.show.ids.imdb,
        tmdb_id: rec.show.ids.tmdb
      }))
    }

    // Hydrate items with metadata from addons (posters, ratings, etc.)
    const hydratedItems = await Promise.all(items.map(async (item) => {
        try {
            const meta = await addonManager.getMeta(item.type, item.id, pId)
            if (meta) {
                return {
                    ...item,
                    poster: meta.poster,
                    background: meta.background,
                    logo: meta.logo,
                    description: meta.description,
                    imdbRating: meta.imdbRating,
                    genres: meta.genres,
                    runtime: meta.runtime,
                    ageRating: meta.ageRating
                }
            }
        } catch (e) {
            log.error(`Failed to hydrate item ${item.id}:`, e)
            // ignore error, return basic item
        }
        return item
    }))

    // Apply age rating filtering if parental controls are enabled
    let filteredItems = hydratedItems;
    if (parentalSettings.enabled) {
      const ratings = AGE_RATINGS;
      const limitIndex = ratings.indexOf(parentalSettings.ratingLimit);
      
      filteredItems = hydratedItems.filter((item: any) => {
        const cert = item.ageRating || item.certification;
        if (cert) {
          const ageRating = toStandardAgeRating(cert);
          if (ageRating) {
            const itemRatingIndex = ratings.indexOf(ageRating);
            return itemRatingIndex <= limitIndex;
          }
        }
        // If no cert found, strict mode: hide content
        return false;
      });
    }

    return ok(c, { items: filteredItems, connected: true })
  } catch (e) {
    log.error('Recommendations failed:', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to get recommendations')
  }
})

// ============================================================================
// Scrobble API (Real-time playback tracking)
// ============================================================================

// Helper to get valid access token for a profile
async function getAccessToken(profileId: number): Promise<string | null> {
  const account = traktAccountDb.getByProfileId(profileId)
  if (!account) return null

  if (traktAccountDb.isTokenExpired(profileId)) {
    try {
      const newTokens = await traktClient.refreshAccessToken(account.refresh_token)
      const expiresAt = new Date((newTokens.created_at + newTokens.expires_in) * 1000)
      traktAccountDb.updateTokens(profileId, newTokens.access_token, newTokens.refresh_token, expiresAt)
      return newTokens.access_token
    } catch (e) {
      log.error('Token refresh failed:', e)
      return null
    }
  }
  return account.access_token
}

// Build scrobble item from request params
function buildScrobbleItem(body: any) {
  const { metaType, imdbId, tmdbId, season, episode, showImdbId, showTmdbId } = body
  
  if (metaType === 'movie') {
    return {
      movie: {
        ids: {
          ...(imdbId && { imdb: imdbId }),
          ...(tmdbId && { tmdb: tmdbId })
        }
      }
    }
  } else {
    // Episode
    return {
      episode: {
        season: season || 1,
        number: episode || 1
      },
      show: {
        ids: {
          ...(showImdbId && { imdb: showImdbId }),
          ...(showTmdbId && { tmdb: showTmdbId }),
          ...(imdbId && { imdb: imdbId }), // Fallback
          ...(tmdbId && { tmdb: tmdbId })  // Fallback
        }
      }
    }
  }
}

// [POST /scrobble/start] Start scrobbling (playback started)
trakt.post('/scrobble/start', async (c) => {
  try {
    const body = await c.req.json()
    const { profileId, progress = 0 } = body

    if (!profileId) {
      return err(c, 400, 'INVALID_INPUT', 'profileId required')
    }

    const accessToken = await getAccessToken(parseInt(profileId))
    if (!accessToken) {
      return ok(c, { success: false, error: 'not_connected' })
    }

    const item = buildScrobbleItem(body)
    const result = await traktClient.scrobbleStart(accessToken, item, progress)
    
    return ok(c, { success: true, action: result.action })
  } catch (e) {
    log.error('Scrobble start failed:', e)
    return ok(c, { success: false, error: 'scrobble_failed' })
  }
})

// [POST /scrobble/pause] Pause scrobbling (playback paused)
trakt.post('/scrobble/pause', async (c) => {
  try {
    const body = await c.req.json()
    const { profileId, progress = 0 } = body

    if (!profileId) {
      return err(c, 400, 'INVALID_INPUT', 'profileId required')
    }

    const accessToken = await getAccessToken(parseInt(profileId))
    if (!accessToken) {
      return ok(c, { success: false, error: 'not_connected' })
    }

    const item = buildScrobbleItem(body)
    const result = await traktClient.scrobblePause(accessToken, item, progress)
    
    return ok(c, { success: true, action: result.action })
  } catch (e) {
    log.error('Scrobble pause failed:', e)
    return ok(c, { success: false, error: 'scrobble_failed' })
  }
})

// [POST /scrobble/stop] Stop scrobbling (playback stopped/ended)
trakt.post('/scrobble/stop', async (c) => {
  try {
    const body = await c.req.json()
    const { profileId, progress = 0 } = body

    if (!profileId) {
      return err(c, 400, 'INVALID_INPUT', 'profileId required')
    }

    const accessToken = await getAccessToken(parseInt(profileId))
    if (!accessToken) {
      return ok(c, { success: false, error: 'not_connected' })
    }

    const item = buildScrobbleItem(body)
    const result = await traktClient.scrobbleStop(accessToken, item, progress)
    
    return ok(c, { success: true, action: result.action })
  } catch (e) {
    log.error('Scrobble stop failed:', e)
    return ok(c, { success: false, error: 'scrobble_failed' })
  }
})

// ============================================================================
// Checkin API (Social check-in)
// ============================================================================

// [POST /checkin] Check in to a movie or episode
trakt.post('/checkin', async (c) => {
  try {
    const body = await c.req.json()
    const { profileId, message } = body

    if (!profileId) {
      return err(c, 400, 'INVALID_INPUT', 'profileId required')
    }

    const accessToken = await getAccessToken(parseInt(profileId))
    if (!accessToken) {
      return ok(c, { success: false, error: 'not_connected' })
    }

    const item = buildScrobbleItem(body)
    const result = await traktClient.checkin(accessToken, item, message)
    
    return ok(c, { success: true, id: result.id, watchedAt: result.watched_at })
  } catch (e: any) {
    log.error('Checkin failed:', e)
    if (e.message?.includes('Already checked in')) {
      return ok(c, { success: false, error: 'already_checked_in' })
    }
    return ok(c, { success: false, error: 'checkin_failed' })
  }
})

// [DELETE /checkin] Cancel active check-in
trakt.delete('/checkin', async (c) => {
  try {
    const { profileId } = c.req.query()

    if (!profileId) {
      return err(c, 400, 'INVALID_INPUT', 'profileId required')
    }

    const accessToken = await getAccessToken(parseInt(profileId))
    if (!accessToken) {
      return ok(c, { success: false, error: 'not_connected' })
    }

    await traktClient.cancelCheckin(accessToken)
    
    return ok(c, { success: true })
  } catch (e) {
    log.error('Cancel checkin failed:', e)
    return ok(c, { success: false, error: 'cancel_failed' })
  }
})

export default trakt
