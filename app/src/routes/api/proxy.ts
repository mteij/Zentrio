import { Hono } from 'hono'
import { logger } from '../../services/logger'

const log = logger.scope('AddonProxy')
const proxy = new Hono()

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fe80:/i,
]

function isAllowedUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr)
    if (!['https:', 'http:'].includes(parsed.protocol)) return false
    const host = parsed.hostname
    if (PRIVATE_IP_PATTERNS.some(p => p.test(host))) return false
    return true
  } catch {
    return false
  }
}

// GET /api/addon-proxy?url=<encoded-addon-url>
// Thin CORS proxy so web browsers can reach external addon URLs.
// Tauri apps bypass this entirely via @tauri-apps/plugin-http.
proxy.get('/', async (c) => {
  const targetUrl = c.req.query('url')
  if (!targetUrl) return c.json({ error: 'Missing url parameter' }, 400)

  let decoded: string
  try {
    decoded = decodeURIComponent(targetUrl)
  } catch {
    return c.json({ error: 'Invalid url encoding' }, 400)
  }

  if (!isAllowedUrl(decoded)) return c.json({ error: 'URL not allowed' }, 403)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    const res = await fetch(decoded, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Zentrio/1.0' },
    })
    clearTimeout(timeout)

    const body = await res.arrayBuffer()
    return new Response(body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'application/json',
        'Cache-Control': 'public, max-age=60',
        'Access-Control-Allow-Origin': '*',
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
