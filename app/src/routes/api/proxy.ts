import { Hono } from 'hono'
import { auth } from '../../services/auth'
import { logger } from '../../services/logger'
import { isSafeExternalUrl } from '../../lib/ssrf'

const log = logger.scope('AddonProxy')
const proxy = new Hono()

const MAX_PROXY_SIZE = 10 * 1024 * 1024 // 10 MB

// GET /api/addon-proxy?url=<encoded-addon-url>
// Temporary hosted compatibility bridge so web browsers can reach external
// addon URLs when direct fetch is blocked by CORS. Tauri apps bypass this
// entirely via @tauri-apps/plugin-http.
// Requires an authenticated session to prevent the server from being used
// as an open proxy by unauthenticated third parties.
proxy.get('/', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session?.user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  const targetUrl = c.req.query('url')
  if (!targetUrl) return c.json({ error: 'Missing url parameter' }, 400)

  let decoded: string
  try {
    decoded = decodeURIComponent(targetUrl)
  } catch {
    return c.json({ error: 'Invalid url encoding' }, 400)
  }

  if (!isSafeExternalUrl(decoded)) return c.json({ error: 'URL not allowed' }, 403)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(decoded, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Zentrio/1.0' },
    })
    clearTimeout(timeout)

    const contentLength = parseInt(res.headers.get('content-length') || '0', 10)
    if (contentLength > MAX_PROXY_SIZE) {
      return c.json({ error: 'Response too large' }, 413)
    }

    let body: ArrayBuffer
    try {
      const buf = await res.arrayBuffer()
      if (buf.byteLength > MAX_PROXY_SIZE) {
        return c.json({ error: 'Response too large' }, 413)
      }
      body = buf
    } catch {
      return c.json({ error: 'Failed to read response' }, 502)
    }

    return new Response(body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      log.warn('Addon proxy timeout:', decoded)
      return c.json({ error: 'Upstream timeout' }, 504)
    }
    log.error('Addon proxy error:', e)
    return c.json({ error: 'Proxy request failed' }, 502)
  }
})

export { proxy as addonProxyRouter }