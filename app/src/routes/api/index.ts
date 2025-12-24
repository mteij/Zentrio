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
import { getConfig } from '../../services/envParser'

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
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      database: DATABASE_URL ? 'configured' : 'not configured',
      auth: AUTH_SECRET ? 'configured' : 'not configured',
    },
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