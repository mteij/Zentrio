import type { Context, Next } from 'hono'
import { getConfig } from '../services/envParser'

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
      cfg.APP_URL,
      cfg.CLIENT_URL
    ].filter(Boolean)
    
    const allowedOrigins = origins || defaultOrigins
    const origin = c.req.header('origin')
    
    // Debug CORS in development
    if (process.env.NODE_ENV !== 'production' && origin && !allowedOrigins.includes(origin)) {
        console.log(`[CORS] Blocking origin: ${origin}. Allowed:`, allowedOrigins)
    }

    // Handle CORS headers
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Guest-Mode',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    }
    
    // Set origin header if origin is allowed
    // Clean trailing slash from origin just in case
    const cleanOrigin = origin?.endsWith('/') ? origin.slice(0, -1) : origin;
    
    if (origin && (allowedOrigins.includes(origin) || (cleanOrigin && allowedOrigins.includes(cleanOrigin)))) {
      corsHeaders['Access-Control-Allow-Origin'] = origin
    }
    
    // Handle preflight OPTIONS requests
    if (c.req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      })
    }
    
    // Set CORS headers for all other requests
    Object.entries(corsHeaders).forEach(([key, value]) => {
      c.header(key, value)
    })
    
    await next()
  }
}

export const securityHeaders = async (c: Context, next: Next) => {
  await next()

  // Always-on minimal safety headers
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-XSS-Protection', '1; mode=block')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  
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

export const rateLimiter = (options: { windowMs: number; limit: number }) => {
  return async (c: Context, next: Next) => {
    const { windowMs, limit } = options

    // Disable rate limiting when limit is 0 or negative, or window is non-positive.
    if (!limit || limit <= 0 || !windowMs || windowMs <= 0) {
      return await next()
    }

    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
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
