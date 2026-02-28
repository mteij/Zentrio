import { Hono } from 'hono'
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

const app = new Hono()

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

// Environment Configuration now read via getConfig() within handlers

// Streaming support
app.get('/stream', (c) => {
  return new Response(
    new ReadableStream({
      start(controller) {
        let i = 0
        const interval = setInterval(() => {
          if (i < 10) {
            controller.enqueue(`data: ${i}\n\n`)
            i++
          } else {
            controller.close()
            clearInterval(interval)
          }
        }, 1000)
      },
    }),
    {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    },
  )
})

// Health check
app.get('/health', (c) => {
  const { DATABASE_URL, AUTH_SECRET } = getConfig()
  
  // Gather stats
  let stats = {}
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
    stats
  })
})

// API info
app.get('/', (c) => {
  return c.json({
    message: 'Zentrio API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
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
      rateLimiting: 'Global rate limiting may apply via middleware; an endpoint-specific limiter can be added if needed.'
    }
  })
})

export default app
