import { createMiddleware } from 'hono/factory'
import { auth } from '../services/auth'
import { userDb } from '../services/database'

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
 * - profileId=guest query parameter
 * - guestMode=true query parameter
 * - X-Guest-Mode: true header
 * 
 * In guest mode, the middleware sets the guest user and a 'guestMode' flag.
 * For connected mode (normal profileId), authentication is still required.
 */
export const optionalSessionMiddleware = createMiddleware(async (c, next) => {
  const { profileId, guestMode: guestModeParam } = c.req.query()
  const guestModeHeader = c.req.header('X-Guest-Mode')
  
  // Detect guest mode via multiple methods
  const isGuestMode = 
    profileId === 'guest' || 
    guestModeParam === 'true' || 
    guestModeHeader === 'true'
  
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