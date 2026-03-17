import type { Context, Next } from 'hono'
import { getConfig } from '../services/envParser'
import { logger } from '../services/logger'

const log = logger.scope('Security')
const isProductionEnv = () => (process.env.NODE_ENV || '').trim().toLowerCase() === 'production'

// Rate limiting storage
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export const corsMiddleware = (origins?: string[]) => {
  return async (c: Context, next: Next) => {
    const cfg = getConfig()
    const defaultOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'tauri://localhost',
      'http://tauri.localhost',
      'https://tauri.localhost',
      'https://localhost',
      'https://zentrio.eu',
      cfg.APP_URL,
      cfg.CLIENT_URL
    ].filter(Boolean)
    
    const allowedOrigins = origins || defaultOrigins
    const origin = c.req.header('origin')
    
    // Debug CORS in development
    if (!isProductionEnv() && origin && !allowedOrigins.includes(origin)) {
        log.debug(`Blocking origin: ${origin}. Allowed:`, allowedOrigins)
    }

    // Handle CORS headers
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Guest-Mode, X-Zentrio-Client',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    }
    
    // Set origin header if origin is allowed
    // Clean trailing slash from origin just in case
    const cleanOrigin = origin?.endsWith('/') ? origin.slice(0, -1) : origin;
    
    // Is it strictly in the allowed origins array?
    const isExactMatch = origin && allowedOrigins.includes(origin);
    const isCleanMatch = cleanOrigin && allowedOrigins.includes(cleanOrigin);
    // Tauri often sends origin as tauri://localhost or http://tauri.localhost
    const isTauriMatch = cleanOrigin && (cleanOrigin.startsWith('tauri://') || cleanOrigin.includes('tauri.localhost'));
    // Android Emulator sends requests from http://10.0.2.2 — dev only, never allow in production
    const isAndroidMatch = !isProductionEnv() && cleanOrigin && cleanOrigin.startsWith('http://10.');

    if (isExactMatch || isCleanMatch || isTauriMatch || isAndroidMatch) {
      corsHeaders['Access-Control-Allow-Origin'] = origin as string;
    } else if (!isProductionEnv() && origin) {
      // In development, be more permissive with local origins to prevent dev blocking
      if (origin.startsWith('http://localhost')) {
         corsHeaders['Access-Control-Allow-Origin'] = origin;
      }
    }
    
    // Handle preflight OPTIONS requests
    if (c.req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      })
    }
    
    await next()
    
    // Set CORS headers AFTER next() to ensure they persist on raw Response objects
    Object.entries(corsHeaders).forEach(([key, value]) => {
      c.header(key, value)
    })
  }
}

export const securityHeaders = async (c: Context, next: Next) => {
  await next()

  // Always-on minimal safety headers
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-XSS-Protection', '1; mode=block')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')

  // HSTS — only set on HTTPS (production). Prevents downgrade attacks.
  if (isProductionEnv()) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  
  // Conditional Isolation Headers - ENABLED ONLY FOR PLAYER
  // Regex to match /streaming/:profileId/player
  // We check c.req.path
  const isPlayerRoute = /^\/streaming\/[^/]+\/player/.test(c.req.path)

  if (isPlayerRoute) {
    // same-origin-allow-popups enables SharedArrayBuffer while allowing extension popups
    // (Though for max FFMPEG stability, strict 'same-origin' might be better, but we stick to allow-popups for now)
    c.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
    c.header('Cross-Origin-Embedder-Policy', 'credentialless')
    c.header('Cross-Origin-Resource-Policy', 'cross-origin')
  }

  // Avoid overriding proxy responses
  const alreadyProxied = c.res?.headers?.get('X-Zentrio-Proxy')
 
  if (alreadyProxied) {
    // Do not set global X-Frame-Options/CSP on proxied content.
    // These are managed by the proxy header manipulators.
    return
  }

  // Defaults for first-party pages - allow same origin framing
  c.header('X-Frame-Options', 'SAMEORIGIN')
  // TODO: Tighten CSP: remove 'unsafe-inline' by adopting nonces/hashes after extracting inline scripts into external files.
  // Reference: [securityHeaders()](app/src/middleware/security.ts:27)
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com https://cdn.dashjs.org https://www.gstatic.com; connect-src * data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; worker-src 'self' blob:; manifest-src 'self'; media-src 'self' https:;"
  )
}

/**
 * Extract a best-effort client IP for rate-limiting purposes.
 *
 * Security rationale: X-Forwarded-For / X-Real-IP are user-controlled headers.
 * An attacker can forge them to rotate through arbitrary IPs and bypass rate limits.
 * We mitigate this by:
 *  1. Taking only the LAST entry in X-Forwarded-For (the one appended by the nearest
 *     trusted proxy), not the first (which is what the client claims).
 *  2. Validating the extracted value looks like an IP address before trusting it.
 *  3. Falling back to 'unknown' so all unidentifiable clients share one bucket —
 *     better than giving each forged IP its own fresh quota.
 */
function extractClientIp(c: Context): string {
  const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/
  const IPV6_RE = /^[0-9a-f:]+$/i

  // Prefer X-Real-IP (set by trusted reverse proxies like Nginx)
  const realIp = (c.req.header('x-real-ip') || '').trim()
  if (realIp && (IPV4_RE.test(realIp) || IPV6_RE.test(realIp))) {
    return realIp
  }

  // Use the LAST entry of X-Forwarded-For to get the proxy-appended address
  // rather than the client-claimed first entry.
  const xff = c.req.header('x-forwarded-for') || ''
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean)
    // Take the rightmost entry (appended by the outermost trusted proxy)
    const candidate = parts[parts.length - 1] || ''
    if (candidate && (IPV4_RE.test(candidate) || IPV6_RE.test(candidate))) {
      return candidate
    }
  }

  return 'unknown'
}

export const rateLimiter = (options: { windowMs: number; limit: number }) => {
  return async (c: Context, next: Next) => {
    const { windowMs, limit } = options

    // Disable rate limiting when limit is 0 or negative, or window is non-positive.
    if (!limit || limit <= 0 || !windowMs || windowMs <= 0) {
      return await next()
    }

    const ip = extractClientIp(c)
    const now = Date.now()

    if (!rateLimitMap.has(ip)) {
      rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    } else {
      const data = rateLimitMap.get(ip)!
      if (now > data.resetTime) {
        data.count = 1
        data.resetTime = now + windowMs
      } else {
        data.count++
        if (data.count > limit) {
          return c.json({ error: 'Too many requests' }, 429)
        }
      }
    }

    await next()
  }
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now()
  const entries = Array.from(rateLimitMap.entries())
  for (const [ip, data] of entries) {
    if (now > data.resetTime) {
      rateLimitMap.delete(ip)
    }
  }
}, 5 * 60 * 1000) // Clean up every 5 minutes

/**
 * Reject requests whose Content-Length exceeds maxBytes.
 * Prevents trivial memory-exhaustion DoS on any endpoint that reads a body.
 * Note: clients can omit Content-Length (chunked encoding), so this is a
 * best-effort guard rather than a hard guarantee — it catches the common case.
 */
export const bodyLimit = (maxBytes: number) => {
  return async (c: Context, next: Next) => {
    const contentLength = c.req.header('content-length')
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      return c.json({ error: 'Request body too large' }, 413)
    }
    await next()
  }
}
