import { OpenAPIHono } from '@hono/zod-openapi'
import authApiRoutes from './auth'
import profileApiRoutes from './profiles'
import userApiRoutes from './user'
import avatarApiRoutes from './avatar'
import streamingApiRoutes from './streaming'
import addonsApiRoutes from './addons'
import listsApiRoutes from './lists'
import appearanceApiRoutes from './appearance'
import syncApiRoutes from './sync'
import traktApiRoutes from './trakt'
import gatewayApiRoutes from './gateway'
import { getConfig } from '../../services/envParser'
import { db } from '../../services/database'
import {
  generateOpenAPISpec,
  setupScalarUI,
  ErrorSchema,
  HealthResponseSchema,
  ApiInfoSchema,
} from './openapi'

const app = new OpenAPIHono()

// Mount sub-routers under /api/*
app.route('/auth', authApiRoutes)
app.route('/profiles', profileApiRoutes)
app.route('/user', userApiRoutes)
app.route('/avatar', avatarApiRoutes)
app.route('/streaming', streamingApiRoutes)
app.route('/addons', addonsApiRoutes)
app.route('/lists', listsApiRoutes)
app.route('/appearance', appearanceApiRoutes)
app.route('/sync', syncApiRoutes)
app.route('/trakt', traktApiRoutes)
app.route('/gateway', gatewayApiRoutes)

// Health check with OpenAPI documentation
interface HealthStats {
  users?: number
  profiles?: number
  addons?: number
  active_sessions?: number
  watched_items?: number
  error?: string
}

app.openapi({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Health Check',
  description: 'Returns the health status of the API including database connectivity, environment configuration, and usage statistics.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
      description: 'API is healthy',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
      description: 'Internal server error',
    },
  },
}, (c) => {
  const { DATABASE_URL, AUTH_SECRET } = getConfig()

  // Gather stats
  let stats: HealthStats = {}
  try {
    const userCount = (db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number }).count
    const profileCount = (db.prepare('SELECT COUNT(*) as count FROM profiles').get() as { count: number }).count
    const addonCount = (db.prepare('SELECT COUNT(*) as count FROM addons').get() as { count: number }).count
    const activeSessions = (db.prepare('SELECT COUNT(*) as count FROM proxy_sessions WHERE is_active = 1').get() as { count: number }).count
    const watchedItems = (db.prepare('SELECT COUNT(*) as count FROM watch_history WHERE is_watched = 1').get() as { count: number }).count

    stats = {
      users: userCount,
      profiles: profileCount,
      addons: addonCount,
      active_sessions: activeSessions,
      watched_items: watchedItems
    }
  } catch (e) {
    console.error('Failed to fetch health stats', e)
    stats = { error: 'Failed to fetch stats' }
  }

  // Get version safely
  let version = 'unknown'
  try {
    // @ts-ignore
    const pkg = require('../../../package.json')
    version = pkg.version
  } catch {}

  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    app: {
      version,
      uptime: process.uptime(),
      memory: process.memoryUsage().rss
    },
    environment: {
      database: DATABASE_URL ? 'configured' : 'not configured',
      auth: AUTH_SECRET ? 'configured' : 'not configured',
    },
    stats: stats as { users: number; profiles: number; addons: number; active_sessions: number; watched_items: number }
  }, 200)
})

// API info with OpenAPI documentation
app.openapi({
  method: 'get',
  path: '/',
  tags: ['System'],
  summary: 'API Information',
  description: 'Returns general information about the Zentrio API including available endpoints and documentation. Visit /api/docs for interactive documentation.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ApiInfoSchema,
        },
      },
      description: 'API information retrieved successfully',
    },
  },
}, (c) => {
  return c.json({
    message: 'Zentrio API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      docs: '/docs',
      openapi: '/openapi.json',
      auth: {
        identify: 'POST /api/auth/identify',
        identifyInfo: {
          description: 'Email identification that returns only whether an account exists for the normalized email. Does not leak additional user information.',
          request: { email: 'string' },
          response: { exists: 'boolean' },
          example: {
            request: { email: 'user@example.com' },
            response: { exists: true }
          }
        },
        signInEmail: 'POST /api/auth/sign-in/email',
        signUpEmail: 'POST /api/auth/sign-up/email',
        signInMagicLink: 'POST /api/auth/sign-in/magic-link',
        signInEmailOTP: 'POST /api/auth/sign-in/email-otp',
        twoFactor: {
            enable: 'POST /api/auth/two-factor/enable',
            verify: 'POST /api/auth/two-factor/verify',
            disable: 'POST /api/auth/two-factor/disable'
        },
        changePassword: 'POST /api/auth/change-password',
        changeEmail: 'POST /api/auth/change-email'
      },
      profiles: {
        list: 'GET /api/profiles',
        create: 'POST /api/profiles',
        update: 'PUT /api/profiles/:id',
        delete: 'DELETE /api/profiles/:id',
      },
      user: {
        settings: 'GET /api/user/settings',
        updateSettings: 'PUT /api/user/settings',
        profile: 'GET /api/user/profile',
        tmdbApiKey: 'GET /api/user/tmdb-api-key',
        updateTmdbApiKey: 'PUT /api/user/tmdb-api-key',
      },
      pages: {
        landing: '/',
        signin: '/signin',
        register: '/register',
        profiles: '/profiles',
        settings: '/settings',
      },
    },
    notes: {
      security: 'Identify returns only a boolean to avoid data leakage; emails are trimmed and lowercased.',
      rateLimiting: 'Global rate limiting may apply via middleware; an endpoint-specific limiter can be added if needed.',
      documentation: 'Interactive API documentation is available at /api/docs'
    }
  }, 200)
})

// Generate OpenAPI specification endpoint at /api/openapi.json
generateOpenAPISpec(app, '')

// Setup Scalar API Reference UI at /api/docs
setupScalarUI(app, '')

export default app
