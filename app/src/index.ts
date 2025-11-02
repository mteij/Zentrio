import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { corsMiddleware, securityHeaders, rateLimiter } from './middleware/security'
import { join, extname } from 'path'
import { initEnv, getConfig } from './services/envParser'

// Import route modules
import viewRoutes from './routes/views'
import sessionRoutes from './routes/session'
import stremioRoutes from './routes/stremio'

// Import API route modules
import apiRoutes from './routes/api/index'

// Initialize environment variables before starting the app
initEnv()

// Create app instance
const app = new Hono()

// Load runtime config
const cfg = getConfig()
const { PORT, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_LIMIT, DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY, PROXY_LOGS } = cfg

// Console helpers for a fancy startup display
const color = (code: string, text: string) => `\x1b[${code}m${text}\x1b[0m`
const ok = (text: string) => console.log(`${color('32', '✔')} ${text}`)
const fail = (text: string) => console.log(`${color('31', '✖')} ${text}`)
const info = (text: string) => console.log(color('36', `ℹ ${text}`))
const warn = (text: string) => console.log(color('33', `⚠ ${text}`))

const banner = color('1;31', ` _____          _        _
|__  /___ _ __ | |_ _ __(_) ___
  / // _ \\ '_ \\| __| '__| |/ _ \\
 / /|  __/ | | | |_| |  | | (_) |
/____\\___|_| |_|\\__|_|  |_|\\___/`)

console.log(banner)
info('Starting Zentrio — performing startup checks...')

// Basic checks & status output
try {
  ok(`Environment loaded (PORT=${PORT})`)
} catch (e) {
  fail('Failed to read environment configuration')
}

if (!AUTH_SECRET || AUTH_SECRET === 'super-secret-key-change-in-production') {
  fail('AUTH_SECRET is not configured or uses the default.')
} else {
  ok('AUTH_SECRET loaded')
}

if (!ENCRYPTION_KEY || ENCRYPTION_KEY === 'super-secret-key-change-in-production') {
  fail('ENCRYPTION_KEY is not configured or uses the default.')
} else {
  ok('ENCRYPTION_KEY loaded')
}

if (DATABASE_URL && DATABASE_URL.includes('sqlite')) {
  ok(`Database: using sqlite at ${DATABASE_URL}`)
  ok('Database configured')
} else if (DATABASE_URL) {
  ok(`Database configured: ${DATABASE_URL}`)
} else {
  fail('DATABASE_URL not configured')
}

if (!RATE_LIMIT_LIMIT || RATE_LIMIT_LIMIT <= 0 || !RATE_LIMIT_WINDOW_MS || RATE_LIMIT_WINDOW_MS <= 0) {
  info('Rate limiter: disabled')
} else {
  ok(`Rate limiter: ${RATE_LIMIT_LIMIT} requests / ${RATE_LIMIT_WINDOW_MS}ms`)
}

info('Preparing middleware and routes...')

// Basic Middleware
app.use('*', corsMiddleware())
if (PROXY_LOGS) {
  app.use('*', logger())
}
app.use('*', securityHeaders)
app.use('*', rateLimiter({ windowMs: RATE_LIMIT_WINDOW_MS, limit: RATE_LIMIT_LIMIT }))

// Service Worker explicit route (headers)
app.get('/static/sw.js', async (c) => {
  try {
    const filePath = join(process.cwd(), 'src', 'static', 'sw.js')
    const file = Bun.file(filePath)
    const buf = await file.arrayBuffer()
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Service-Worker-Allowed': '/'
      }
    })
  } catch {
    return new Response('Not Found', { status: 404 })
  }
})

// Static file serving (explicit, to avoid path mismatches)
app.get('/static/*', async (c) => {
  const reqPath = c.req.path.replace(/^\/static\//, '')
  const filePath = join(process.cwd(), 'src', 'static', reqPath)
  try {
    const file = Bun.file(filePath)
    const buf = await file.arrayBuffer()
    const typeMap: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.webmanifest': 'application/manifest+json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
    }
    const ext = extname(filePath).toLowerCase()
    const contentType = typeMap[ext] || 'application/octet-stream'
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return new Response('Not Found', { status: 404 })
  }
})

// Favicon at root for browser defaults
app.get('/favicon.ico', async (c) => {
  try {
    const filePath = join(process.cwd(), 'src', 'static', 'logo', 'favicon', 'favicon.ico')
    const file = Bun.file(filePath)
    const buf = await file.arrayBuffer()
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'image/x-icon',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return new Response('Not Found', { status: 404 })
  }
})

// Mount proxy middleware for proxy routes
// Mount route modules
app.route('/', viewRoutes)              // JSX-rendered pages (converted from HTML)
app.route('/api', apiRoutes)            // API routes, including auth, profiles, user, avatar, health, stream
app.route('/session', sessionRoutes)
app.route('/stremio', stremioRoutes)

export default app
