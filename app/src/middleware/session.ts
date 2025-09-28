import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { sessionDb, userDb } from '../services/database'

export const sessionMiddleware = createMiddleware(async (c, next) => {
  const sessionId = getCookie(c, 'sessionId')
  if (!sessionId) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401)
  }

  const session = sessionDb.findByToken(sessionId)
  if (!session) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401)
  }

  const user = userDb.findById(session.user_id)
  if (!user) {
    return c.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, 401)
  }

  c.set('user', user)
  await next()
})