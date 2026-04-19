import { createMiddleware } from 'hono/factory'
import { auth } from '../services/auth'
import { userDb } from '../services/database'
import { isLocalGatewayHost } from '../lib/ssrf'

/**
 * Strict session middleware - requires authentication for all requests.
 * Use this for endpoints that should never be accessible in guest mode.
 */
export const sessionMiddleware = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  })

  if (!session) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401)
  }

  c.set('user', session.user)
  c.set('session', session.session)

  await next()
})

/**
 * Optional session middleware - allows guest mode requests to proceed without authentication.
 *
 * Guest mode is detected via:
 * - profileId=guest query parameter (Tauri app passes this when browsing as guest)
 * - X-Guest-Mode: true header (set by the Tauri app's safeFetch)
 *
 * NOTE: The guestMode=true query parameter has been removed to reduce the attack surface.
 * Only profileId=guest and the X-Guest-Mode header are accepted, both of which require
 * deliberate action by the caller.  Any route that must never be accessible without a
 * real session should use sessionMiddleware instead of this middleware.
 *
 * In guest mode, the middleware sets the guest user and a 'guestMode' flag.
 * For connected mode (normal profileId), authentication is still required.
 */
export const optionalSessionMiddleware = createMiddleware(async (c, next) => {
  const { profileId } = c.req.query()
  const guestModeHeader = c.req.header('X-Guest-Mode')
  const hostHeader = c.req.header('host')

  // Detect guest mode: explicit guest profile ID or dedicated header only.
  // Guest mode MUST originate from a local gateway host (e.g. Tauri sidecar).
  const isGuestMode =
    (profileId === 'guest' || guestModeHeader === 'true') &&
    isLocalGatewayHost(hostHeader)
  
  // Guest mode: use guest user without authentication
  if (isGuestMode) {
    const guestUser = userDb.getOrCreateGuestUser()
    c.set('guestMode', true)
    c.set('user', guestUser)
    c.set('session', null)
    await next()
    return
  }
  
  // Connected mode: require authentication
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  })

  if (!session) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401)
  }

  c.set('guestMode', false)
  c.set('user', session.user)
  c.set('session', session.session)

  await next()
})