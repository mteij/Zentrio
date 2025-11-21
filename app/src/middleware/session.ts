import { createMiddleware } from 'hono/factory'
import { auth } from '../services/auth'

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