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
import { db } from './services/database'

// Initialize environment variables before starting the app
initEnv()

// Create app instance
const app = new Hono()

// Load runtime config
const cfg = getConfig()
const { PORT, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_LIMIT, DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY, PROXY_LOGS } = cfg

// ─── Version ──────────────────────────────────────────────────────────
let version = 'unknown'
try {
  // @ts-ignore
  const pkgPath = join(import.meta.dir, '..', 'package.json')
  // @ts-ignore
  const pkg = await Bun.file(pkgPath).json()
  version = pkg.version || 'unknown'
} catch {}

// ─── Startup Display ──────────────────────────────────────────────────
const c = logger.colors
const nodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase()
const isDev = nodeEnv !== 'production'
const mode = isDev ? `${c.yellow}development${c.reset}` : `${c.green}production${c.reset}`

// Gather status checks
const checks = {
  authSecret: AUTH_SECRET && AUTH_SECRET !== 'super-secret-key-change-in-production',
  encryptionKey: ENCRYPTION_KEY && ENCRYPTION_KEY !== 'super-secret-key-change-in-production',
  database: !!DATABASE_URL,
  rateLimiter: RATE_LIMIT_LIMIT > 0 && RATE_LIMIT_WINDOW_MS > 0,
}

const ok = (label: string) => `${c.green}✔${c.reset} ${label}`
const fail = (label: string) => `${c.red}✖${c.reset} ${label}`
const dim = (text: string) => `${c.dim}${text}${c.reset}`
const val = (text: string) => `${c.cyan}${text}${c.reset}`

// Database summary
let dbSummary = `${c.red}not configured${c.reset}`
if (DATABASE_URL) {
  if (DATABASE_URL.includes('sqlite')) {
    const dbFile = DATABASE_URL.replace(/^.*[/\\]/, '')
    dbSummary = `SQLite ${dim('→')} ${val(dbFile)}`
  } else {
    dbSummary = val(DATABASE_URL.replace(/:[^:]*@/, ':***@').substring(0, 40))
  }
}

// Rate limiter summary
const rateSummary = checks.rateLimiter
  ? `${val(String(RATE_LIMIT_LIMIT))} req / ${val(String(RATE_LIMIT_WINDOW_MS / 1000))}s`
  : `${c.dim}disabled${c.reset}`

// Banner
logger.raw('')
logger.raw(`${c.bold}${c.cyan}  ╔══════════════════════════════════════════════╗${c.reset}`)
logger.raw(`${c.bold}${c.cyan}  ║${c.reset}                                              ${c.bold}${c.cyan}║${c.reset}`)
logger.raw(`${c.bold}${c.cyan}  ║${c.reset}   ${c.bold}${c.white} _____          _        _        ${c.reset}         ${c.bold}${c.cyan}║${c.reset}`)
logger.raw(`${c.bold}${c.cyan}  ║${c.reset}   ${c.bold}${c.white}|__  /___ _ __ | |_ _ __(_) ___   ${c.reset}         ${c.bold}${c.cyan}║${c.reset}`)
logger.raw(`${c.bold}${c.cyan}  ║${c.reset}   ${c.bold}${c.white}  / // _ \\ '_ \\| __| '__| |/ _ \\  ${c.reset}         ${c.bold}${c.cyan}║${c.reset}`)
logger.raw(`${c.bold}${c.cyan}  ║${c.reset}   ${c.bold}${c.white} / /|  __/ | | | |_| |  | | (_) | ${c.reset}         ${c.bold}${c.cyan}║${c.reset}`)
logger.raw(`${c.bold}${c.cyan}  ║${c.reset}   ${c.bold}${c.white}/____\\___|_| |_|\\__|_|  |_|\\___/  ${c.reset}         ${c.bold}${c.cyan}║${c.reset}`)
logger.raw(`${c.bold}${c.cyan}  ║${c.reset}                                              ${c.bold}${c.cyan}║${c.reset}`)
logger.raw(`${c.bold}${c.cyan}  ║${c.reset}   ${dim('v' + version)}            ${dim('mode:')} ${mode}        ${c.bold}${c.cyan}║${c.reset}`)
logger.raw(`${c.bold}${c.cyan}  ╚══════════════════════════════════════════════╝${c.reset}`)
logger.raw('')

// Check superadmin & user stats
let userCount = 0
let hasSuperadmin = false
try {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number } | undefined
  userCount = countRow?.count ?? 0
  hasSuperadmin = !!(db.prepare("SELECT 1 FROM user WHERE role = 'superadmin' LIMIT 1").get())
} catch {
  // DB might not be ready yet
}

// SSO summary
const ssoProviders: string[] = []
if (cfg.GOOGLE_CLIENT_ID && cfg.GOOGLE_CLIENT_SECRET) ssoProviders.push('Google')
if (cfg.GITHUB_CLIENT_ID && cfg.GITHUB_CLIENT_SECRET) ssoProviders.push('GitHub')
if (cfg.DISCORD_CLIENT_ID && cfg.DISCORD_CLIENT_SECRET) ssoProviders.push('Discord')
if (cfg.OIDC_CLIENT_ID && cfg.OIDC_ISSUER) ssoProviders.push(cfg.OIDC_DISPLAY_NAME || 'OIDC')
const ssoSummary = ssoProviders.length > 0
  ? ssoProviders.map(p => val(p)).join(dim(', '))
  : dim('none')

// Email summary
let emailSummary = dim('not configured')
if (cfg.RESEND_API_KEY) {
  emailSummary = val('Resend')
} else if (cfg.SMTP_URL || cfg.EMAIL_HOST) {
  emailSummary = `SMTP ${dim('→')} ${val(cfg.EMAIL_HOST || 'via URL')}`
}

// Status panel
logger.raw(`  ${c.bold}${c.white}System Status${c.reset}`)
logger.raw(`  ${dim('─────────────────────────────────────────────')}`)
logger.raw(`  ${checks.authSecret ? ok('Auth Secret') : fail('Auth Secret')}      ${checks.authSecret ? dim('configured') : `${c.red}default/missing${c.reset}`}`)
logger.raw(`  ${checks.encryptionKey ? ok('Encryption') : fail('Encryption')}       ${checks.encryptionKey ? dim('configured') : `${c.red}default/missing${c.reset}`}`)
logger.raw(`  ${checks.database ? ok('Database') : fail('Database')}         ${dbSummary}`)
logger.raw(`  ${checks.rateLimiter ? ok('Rate Limiter') : ok('Rate Limiter')}     ${rateSummary}`)
logger.raw(`  ${ok('Proxy Logs')}       ${PROXY_LOGS ? val('enabled') : dim('disabled')}`)
logger.raw(`  ${dim('─────────────────────────────────────────────')}`)
logger.raw(`  ${hasSuperadmin ? ok('Superadmin') : fail('Superadmin')}       ${hasSuperadmin ? dim('claimed') : `${c.yellow}unclaimed${c.reset}`}`)
logger.raw(`  ${ok('Users')}            ${userCount > 0 ? val(String(userCount)) + ' ' + dim('registered') : dim('none')}`)
logger.raw(`  ${cfg.ADMIN_ENABLED ? ok('Admin Panel') : fail('Admin Panel')}      ${cfg.ADMIN_ENABLED ? val('enabled') : dim('disabled')}`)
logger.raw(`  ${dim('─────────────────────────────────────────────')}`)
logger.raw(`  ${ok('SSO')}              ${ssoSummary}`)
logger.raw(`  ${(cfg.RESEND_API_KEY || cfg.SMTP_URL || cfg.EMAIL_HOST) ? ok('Email') : fail('Email')}            ${emailSummary}`)
logger.raw(`  ${cfg.TMDB_API_KEY ? ok('TMDB') : fail('TMDB')}             ${cfg.TMDB_API_KEY ? dim('configured') : `${c.yellow}missing${c.reset}`}`)
logger.raw(`  ${cfg.TRAKT_CLIENT_ID ? ok('Trakt') : ok('Trakt')}            ${cfg.TRAKT_CLIENT_ID ? dim('configured') : dim('not configured')}`)
logger.raw(`  ${cfg.FANART_API_KEY ? ok('Fanart.tv') : ok('Fanart.tv')}        ${cfg.FANART_API_KEY ? dim('configured') : dim('not configured')}`)
logger.raw(`  ${dim('─────────────────────────────────────────────')}`)
logger.raw('')

// Warnings & setup notices
if (!checks.authSecret) {
  logger.warn('AUTH_SECRET is not configured or uses the default — set it in .env')
}
if (!checks.encryptionKey) {
  logger.warn('ENCRYPTION_KEY is not configured or uses the default — set it in .env')
}
if (!checks.database) {
  logger.warn('DATABASE_URL not configured — using default location')
}
if (!hasSuperadmin) {
  logger.raw('')
  logger.raw(`  ${c.bold}${c.yellow}⚠ Setup Required${c.reset}`)
  logger.raw(`  ${dim('─────────────────────────────────────────────')}`)
  logger.raw(`  No superadmin has claimed this instance yet.`)
  logger.raw(`  ${dim('1.')} Register or sign in as the first user`)
  logger.raw(`  ${dim('2.')} Navigate to ${c.cyan}/admin${c.reset} to claim ownership`)
  logger.raw(`  ${dim('─────────────────────────────────────────────')}`)
  logger.raw('')
}

logger.info('Initializing services...')

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

// Lazily record the client platform when the app sends X-Zentrio-Client header.
// Only runs when analytics are enabled (requires ADMIN_ENABLED=true and ANALYTICS_ENABLED!=false).
app.use('*', async (c, next) => {
  const { ANALYTICS_ENABLED } = getConfig()
  if (ANALYTICS_ENABLED) {
    const clientType = c.req.header('X-Zentrio-Client')
    if (clientType) {
      const authHeader = c.req.header('Authorization')
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
      if (token) {
        try {
          db.prepare(`
            INSERT INTO session_client_hints (session_token, client_type, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT (session_token) DO UPDATE SET client_type = excluded.client_type, updated_at = excluded.updated_at
          `).run(token, clientType, new Date().toISOString())
        } catch (_) { /* non-critical */ }
      }
    }
  }
  await next()
})



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
  // Try dist/static first (production/Docker), then public/static (development)
  // @ts-ignore
  const distPath = join(process.cwd(), 'dist', 'static', reqPath)
  // @ts-ignore
  const publicPath = join(process.cwd(), 'public', 'static', reqPath)

  let filePath = distPath
  // @ts-ignore
  if (!(await Bun.file(distPath).exists())) {
    filePath = publicPath
  }

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
    // Try dist/static first (production/Docker), then public/static (development)
    // @ts-ignore
    const distPath = join(process.cwd(), 'dist', 'static', 'logo', 'favicon', 'favicon.ico')
    // @ts-ignore
    const publicPath = join(process.cwd(), 'public', 'static', 'logo', 'favicon', 'favicon.ico')

    let filePath = distPath
    // @ts-ignore
    if (!(await Bun.file(distPath).exists())) {
      filePath = publicPath
    }

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

// Service worker (legacy clients may still request /sw.js?v=...)
// Serve the unregistering SW from /static/sw.js and disable caching to speed up removal/updates.
app.get('/sw.js', async () => {
  try {
    // Try dist/static first (production/Docker), then public/static (development)
    // @ts-ignore
    const distPath = join(process.cwd(), 'dist', 'static', 'sw.js')
    // @ts-ignore
    const publicPath = join(process.cwd(), 'public', 'static', 'sw.js')

    let filePath = distPath
    // @ts-ignore
    if (!(await Bun.file(distPath).exists())) {
      filePath = publicPath
    }

    // @ts-ignore
    const file = Bun.file(filePath)

    return new Response(file, {
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
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

// ─── Ready ────────────────────────────────────────────────────────────
const listenPort = process.env.PORT || 3000
const serverUrl = cfg.APP_URL || `http://localhost:${listenPort}`
logger.raw('')
logger.raw(`  ${c.bold}${c.green}▸ Server ready${c.reset}  ${dim('on')} ${c.bold}${c.cyan}${serverUrl}${c.reset}`)
logger.raw(`  ${dim('  API docs   →')} ${c.cyan}${serverUrl}/api/docs${c.reset}`)
logger.raw(`  ${dim('  Health     →')} ${c.cyan}${serverUrl}/api/health${c.reset}`)
logger.raw('')

export default {
  port: listenPort,
  fetch: app.fetch,
  idleTimeout: 60 // Increase timeout to 60s to allow for slow addon responses
}
