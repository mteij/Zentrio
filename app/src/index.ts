import { Hono } from 'hono'
import { logger as honoLogger } from 'hono/logger'
import { corsMiddleware, securityHeaders, rateLimiter } from './middleware/security'
import { join, extname } from 'path'
import { initEnv, getConfig } from './services/envParser'
import { logger } from './services/logger'

// Import route modules
import viewRoutes from './routes/views'

// Import API route modules
import apiRoutes from './routes/api/index'
import { initImdbService } from './services/imdb'
import { syncService } from './services/sync'

// Initialize environment variables before starting the app
initEnv()

// Create app instance
const app = new Hono()

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

// Initialize IMDb service
initImdbService()

// Initialize Sync Service
syncService.startBackgroundSync();

// Basic Middleware
app.use('*', corsMiddleware())
if (PROXY_LOGS) {
  app.use('*', honoLogger())
}
app.use('*', securityHeaders)
app.use('*', rateLimiter({ windowMs: RATE_LIMIT_WINDOW_MS, limit: RATE_LIMIT_LIMIT }))



// Serve bundled assets (JS/CSS) from Vite build
app.get('/assets/*', async (c) => {
  const reqPath = c.req.path.replace(/^\/assets\//, '')
  // @ts-ignore
  const filePath = join(import.meta.dir, 'assets', reqPath)
  try {
    // @ts-ignore
    const file = Bun.file(filePath)
    const typeMap: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    }
    const ext = extname(filePath).toLowerCase()
    const contentType = typeMap[ext] || 'application/octet-stream'

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable', // Long cache for hashed assets
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Accept-Ranges': 'bytes',
    }

    return new Response(file, { headers })
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
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Accept-Ranges': 'bytes',
    }

    return new Response(file, { headers })
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
    return new Response(file, {
      headers: {
        'Content-Type': 'image/x-icon',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return new Response('Not Found', { status: 404 })
  }
})

// Mount route modules
app.route('/api', apiRoutes)            // API routes, including auth, profiles, user, avatar, health, stream
app.route('/', viewRoutes)              // View routes (redirects, etc.)

// Explicit Root Handler to prevent fallthrough issues
app.get('/', async (c) => {
  try {
    // Try to serve index.html from dist (production) or src (dev fallthrough)
    // using process.cwd() for reliability in Docker
    const distPath = join(process.cwd(), 'dist', 'index.html')
    // @ts-ignore
    const distFile = Bun.file(distPath)
    
    if (await distFile.exists()) {
       return new Response(distFile, {
        headers: { 'Content-Type': 'text/html' }
      })
    }
    
    // Dev fallback: usually handled by Vite, but if we are here:
    // @ts-ignore
    const srcPath = join(import.meta.dir, '..', 'index.html') // In dev, meta.dir is src/
    // @ts-ignore
    const srcFile = Bun.file(srcPath)
     if (await srcFile.exists()) {
       return new Response(srcFile, {
        headers: { 'Content-Type': 'text/html' }
      })
    }
    
    return c.text('Zentrio Server Running. SPA not found (build required?)', 200)
  } catch (e) {
    logger.error(`[Root] Error serving index: ${e}`)
    return c.text('Error serving App', 500)
  }
})

// SPA Fallback for all other routes
app.get('*', async (c) => {
  // Ignore API requests
  if (c.req.path.startsWith('/api')) {
    return c.json({ error: 'Not Found' }, 404)
  }

  try {
    // Check for production build first using CWD
    const distPath = join(process.cwd(), 'dist', 'index.html')
    // @ts-ignore
    const indexFile = Bun.file(distPath)
    
    if (await indexFile.exists()) {
      return new Response(indexFile, {
        headers: { 'Content-Type': 'text/html' }
      })
    }
    
    // In development (src/index.ts is running), import.meta.dir is .../src
    // So look for .../index.html? No, Vite keeps it in root.
    
    // @ts-ignore
    const devPath = join(process.cwd(), 'index.html') // Root level index.html
    // @ts-ignore
    const devFile = Bun.file(devPath)
    if (await devFile.exists()) {
       return new Response(devFile, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    logger.warn(`[SPA Fallback] index.html not found at ${distPath} or ${devPath}`)
    
    return c.text('SPA build not found. For development, use "npm run dev". For production, run "npm run build".', 404)
  } catch (e) {
    logger.error(`[SPA Fallback] Error: ${e}`)
    return c.text('Error serving SPA', 500)
  }
})

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
  idleTimeout: 60 // Increase timeout to 60s to allow for slow addon responses
}
