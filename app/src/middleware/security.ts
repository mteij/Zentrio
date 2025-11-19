import type { Context, Next } from 'hono'

// Rate limiting storage
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export const corsMiddleware = (origins: string[] = ['http://localhost:3000', 'http://localhost:5173']) => {
  return async (c: Context, next: Next) => {
    const origin = c.req.header('origin')
    
    if (origin && origins.includes(origin)) {
      c.header('Access-Control-Allow-Origin', origin)
    }
    
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    c.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT, DELETE')
    c.header('Access-Control-Allow-Credentials', 'true')
    c.header('Vary', 'Origin')
    
    if (c.req.method === 'OPTIONS') {
      return new Response('', { status: 204 })
    }
    
    await next()
  }
}

export const securityHeaders = async (c: Context, next: Next) => {
  await next()

  // Always-on minimal safety headers
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-XSS-Protection', '1; mode=block')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Avoid overriding proxy responses (Stremio API/local bundle)
  const path = c.req.path || ''
  const isStremioPath = path.startsWith('/stremio')
  const alreadyProxied = c.res?.headers?.get('X-Zentrio-Proxy')
 
  if (isStremioPath || alreadyProxied) {
    // Do not set global X-Frame-Options/CSP on proxied content.
    // These are managed by the proxy header manipulators.
    return
  }

  // Defaults for first-party pages
  c.header('X-Frame-Options', 'DENY')
  // TODO: Tighten CSP: remove 'unsafe-inline' by adopting nonces/hashes after extracting inline scripts into external files.
  // Reference: [securityHeaders()](app/src/middleware/security.ts:27)
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://code.iconify.design https://unpkg.com; connect-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://code.iconify.design https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; worker-src 'self'; manifest-src 'self';"
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
