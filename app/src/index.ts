import { Hono } from 'hono'
import { logger as honoLogger } from 'hono/logger'
import { corsMiddleware, securityHeaders, rateLimiter } from './middleware/security'
import { join, extname } from 'path'
import { initEnv, getConfig } from './services/envParser'
import { logger } from './services/logger'

// Import route modules
import viewRoutes from './routes/views'
import sessionRoutes from './routes/session'
import stremioRoutes from './routes/stremio'

// Import API route modules
import apiRoutes from './routes/api/index'

// Initialize environment variables before starting the app
initEnv()

// Create app instance
import { renderer } from './renderer'
const app = new Hono()

// Apply renderer only to view routes, not API or static
app.get('*', renderer)

// Load runtime config
const cfg = getConfig()
const { PORT, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_LIMIT, DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY, PROXY_LOGS } = cfg

const banner = logger.colors.bold + logger.colors.error + `
 _____          _        _
|__  /___ _ __ | |_ _ __(_) ___
  / // _ \\ '_ \\| __| '__| |/ _ \\
 / /|  __/ | | | |_| |  | | (_) |
/____\\___|_| |_|\\__|_|  |_|\\___/` + logger.colors.reset

logger.raw(banner)

// Get version from package.json
let version = 'unknown'
try {
  // @ts-ignore
  const pkgPath = join(import.meta.dir, '..', 'package.json')
  // @ts-ignore
  const pkg = await Bun.file(pkgPath).json()
  version = pkg.version || 'unknown'
} catch {}

logger.info(`Starting Zentrio v${version} — performing startup checks...`)

// Basic checks & status output
try {
  logger.success(`Environment loaded (PORT=${PORT})`)
} catch (e) {
  logger.error('Failed to read environment configuration')
}

if (!AUTH_SECRET || AUTH_SECRET === 'super-secret-key-change-in-production') {
  logger.error('AUTH_SECRET is not configured or uses the default.')
} else {
  logger.success('AUTH_SECRET loaded')
}

if (!ENCRYPTION_KEY || ENCRYPTION_KEY === 'super-secret-key-change-in-production') {
  logger.error('ENCRYPTION_KEY is not configured or uses the default.')
} else {
  logger.success('ENCRYPTION_KEY loaded')
}

if (DATABASE_URL && DATABASE_URL.includes('sqlite')) {
  logger.success(`Database: using sqlite at ${DATABASE_URL}`)
  logger.success('Database configured')
} else if (DATABASE_URL) {
  logger.success(`Database configured: ${DATABASE_URL}`)
} else {
  logger.error('DATABASE_URL not configured')
}

if (!RATE_LIMIT_LIMIT || RATE_LIMIT_LIMIT <= 0 || !RATE_LIMIT_WINDOW_MS || RATE_LIMIT_WINDOW_MS <= 0) {
  logger.info('Rate limiter: disabled')
} else {
  logger.success(`Rate limiter: ${RATE_LIMIT_LIMIT} requests / ${RATE_LIMIT_WINDOW_MS}ms`)
}

logger.info('Preparing middleware and routes...')

// Basic Middleware
app.use('*', corsMiddleware())
if (PROXY_LOGS) {
  app.use('*', honoLogger())
}
app.use('*', securityHeaders)
app.use('*', rateLimiter({ windowMs: RATE_LIMIT_WINDOW_MS, limit: RATE_LIMIT_LIMIT }))

// Service Worker explicit route (headers + version injection)
app.get('/static/sw.js', async (c) => {
  try {
    // @ts-ignore
    const swPath = join(import.meta.dir, 'static', 'sw.js')
    // @ts-ignore
    const swFile = Bun.file(swPath)
    let swText = await swFile.text()

    // Read app version from package.json and inject into SW (%%APP_VERSION%%)
    let version = '0.0.0'
    try {
      // @ts-ignore
      const pkgPath = join(import.meta.dir, '..', 'package.json')
      // @ts-ignore
      const pkg = await Bun.file(pkgPath).json()
      version = (pkg && pkg.version) ? String(pkg.version) : version
    } catch {}

    swText = swText.replace(/%%APP_VERSION%%/g, version)

    return new Response(swText, {
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Service-Worker-Allowed': '/',
        'Cross-Origin-Embedder-Policy': 'credentialless',
        'Cross-Origin-Opener-Policy': 'same-origin',
      }
    })
  } catch {
    return new Response('Not Found', { status: 404 })
  }
})

// Static file serving (explicit, to avoid path mismatches)
app.get('/static/*', async (c) => {
  const reqPath = c.req.path.replace(/^\/static\//, '')
  // @ts-ignore
  const filePath = join(import.meta.dir, 'static', reqPath)
  try {
    // @ts-ignore
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
      '.wasm': 'application/wasm',
    }
    const ext = extname(filePath).toLowerCase()
    const contentType = typeMap[ext] || 'application/octet-stream'

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }

    // Relax CSP for download worker to allow connecting to arbitrary stream URLs
    if (reqPath.includes('download-worker.js')) {
      headers['Content-Security-Policy'] = "connect-src * data: blob:;"
      headers['Cache-Control'] = 'no-cache'
    }

    return new Response(new Uint8Array(buf), { headers })
  } catch {
    return new Response('Not Found', { status: 404 })
  }
})

// Favicon at root for browser defaults
app.get('/favicon.ico', async (c) => {
  try {
    // @ts-ignore
    const filePath = join(import.meta.dir, 'static', 'logo', 'favicon', 'favicon.ico')
    // @ts-ignore
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
