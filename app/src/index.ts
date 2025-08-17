import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { corsMiddleware, securityHeaders, rateLimiter } from './middleware/security'
import { join, extname } from 'path'
import { initEnv, getConfig } from './services/envParser'

// Import route modules
import viewRoutes from './routes/views'

// Import API route modules
import apiRoutes from './routes/api/index'

// Initialize environment variables before starting the app
await initEnv()

const app = new Hono()

// Environment Configuration
const { PORT } = getConfig()

// Basic Middleware
app.use('*', corsMiddleware())
app.use('*', logger())
app.use('*', securityHeaders)
app.use('*', rateLimiter({ windowMs: 15 * 60 * 1000, limit: 100 }))

// Static file serving (explicit, to avoid path mismatches)
app.get('/static/*', async (c) => {
  const reqPath = c.req.path.replace(/^\/static\//, '')
  const filePath = join(process.cwd(), 'src', 'static', reqPath)
  try {
    const file = Bun.file(filePath)
    const buf = await file.arrayBuffer()
    const typeMap: Record<string, string> = {
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
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

// Mount proxy middleware for proxy routes
// Mount route modules
app.route('/', viewRoutes)              // HTML pages (/, /signin, /register, etc.)
app.route('/api', apiRoutes)            // API routes, including auth, profiles, user, avatar, health, stream

export default app
