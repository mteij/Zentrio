import { Hono } from 'hono'
import { auth } from '../../services/auth'
import { logger } from '../../services/logger'

const log = logger.scope('AddonProxy')
const proxy = new Hono()

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  // 0.0.0.0/8 — on Linux, 0.x.x.x routes to loopback
  /^0\./,
  /^::1$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  // Link-local (includes cloud metadata 169.254.169.254)
  /^169\.254\./,
  // IPv6 unique-local and link-local
  /^fc00:/i,
  /^fe80:/i,
  // IPv6-mapped IPv4 loopback/private (::ffff:127.x, ::ffff:10.x, etc.)
  /^::ffff:(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.)/i,
  // IPv6 loopback written as mapped
  /^0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:ffff:7f/i,
]

function isAllowedUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr)
    if (!['https:', 'http:'].includes(parsed.protocol)) return false
    const host = parsed.hostname
    // Reject empty or obviously non-public hosts
    if (!host || host === '') return false
    if (PRIVATE_IP_PATTERNS.some(p => p.test(host))) return false
    // Reject bare numeric IPs that look like decimal-encoded addresses
    // (e.g. 2130706433 == 127.0.0.1). URL.hostname normalises these on
    // some runtimes, so the regex above already catches them, but an extra
    // guard doesn't hurt.
    if (/^\d+$/.test(host)) return false
    return true
  } catch {
    return false
  }
}

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
