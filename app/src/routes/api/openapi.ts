import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { apiReference } from '@scalar/hono-api-reference'

// Common schemas for reuse across routes
export const ErrorSchema = z.object({
  error: z.string().openapi({ example: 'An error occurred' }),
}).openapi('Error')

export const HealthStatsSchema = z.object({
  users: z.number().openapi({ example: 10 }),
  profiles: z.number().openapi({ example: 15 }),
  addons: z.number().openapi({ example: 5 }),
  active_sessions: z.number().openapi({ example: 3 }),
  watched_items: z.number().openapi({ example: 42 }),
}).openapi('HealthStats')

export const HealthResponseSchema = z.object({
  status: z.string().openapi({ example: 'ok' }),
  timestamp: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  app: z.object({
    version: z.string().openapi({ example: '0.4.12' }),
    uptime: z.number().openapi({ example: 3600 }),
    memory: z.number().openapi({ example: 52428800 }),
  }),
  environment: z.object({
    database: z.string().openapi({ example: 'configured' }),
    auth: z.string().openapi({ example: 'configured' }),
  }),
  stats: HealthStatsSchema,
}).openapi('HealthResponse')

// API Info Response Schema
export const ApiInfoSchema = z.object({
  message: z.string().openapi({ example: 'Zentrio API' }),
  version: z.string().openapi({ example: '1.0.0' }),
  endpoints: z.any().openapi({ example: { health: '/health', auth: { signIn: 'POST /api/auth/sign-in/email' } } }),
  notes: z.object({
    security: z.string(),
    rateLimiting: z.string(),
  }),
}).openapi('ApiInfo')

// Create the OpenAPI app instance
export function createOpenAPIApp() {
  const app = new OpenAPIHono()

  // Health check route
  const healthRoute = createRoute({
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
  })

  // API info route
  const apiInfoRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['System'],
    summary: 'API Information',
    description: 'Returns general information about the Zentrio API including available endpoints and documentation.',
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
  })

  return {
    app,
    routes: {
      health: healthRoute,
      apiInfo: apiInfoRoute,
    },
  }
}

// Extended schemas for documentation
export const UserSchema = z.object({
  id: z.string().openapi({ example: 'user123' }),
  email: z.string().email().openapi({ example: 'user@example.com' }),
  username: z.string().openapi({ example: 'johndoe' }),
  firstName: z.string().openapi({ example: 'John' }),
  lastName: z.string().openapi({ example: 'Doe' }),
  twoFactorEnabled: z.boolean().openapi({ example: false }),
}).openapi('User')

export const ProfileSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  user_id: z.string().openapi({ example: 'user123' }),
  name: z.string().openapi({ example: 'My Profile' }),
  avatar: z.string().openapi({ example: 'JD' }),
  avatar_type: z.string().openapi({ example: 'initials' }),
  avatar_style: z.string().openapi({ example: 'bottts-neutral' }),
  is_default: z.boolean().openapi({ example: false }),
}).openapi('Profile')

export const AuthProvidersSchema = z.object({
  google: z.boolean().openapi({ example: true }),
  github: z.boolean().openapi({ example: true }),
  discord: z.boolean().openapi({ example: false }),
  oidc: z.boolean().openapi({ example: false }),
  oidcName: z.string().openapi({ example: 'OpenID' }),
}).openapi('AuthProviders')

// Generate OpenAPI spec endpoint
export function generateOpenAPISpec(app: OpenAPIHono, basePath: string = '/api') {
  const docConfig = {
    openapi: '3.1.0',
    info: {
      title: 'Zentrio API',
      version: '1.0.0',
      description: 'API for authentication, profiles, personalization, streaming discovery, playback, sync, and Trakt integration.',
      termsOfService: '/tos',
      contact: {
        name: 'Zentrio Support',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'Current server',
      },
    ],
    tags: [
      { name: 'System', description: 'Health, diagnostics, and API discovery endpoints.' },
      { name: 'Authentication', description: 'Sign-in flows, sessions, provider discovery, and account linking.' },
      { name: 'Profiles', description: 'Create, update, and manage playback profiles.' },
      { name: 'User', description: 'Account-level settings, security actions, and user metadata.' },
      { name: 'Avatar', description: 'Avatar style lookup and deterministic/avatar-random generation endpoints.' },
      { name: 'Appearance', description: 'Theme and appearance preferences per profile or settings profile.' },
      { name: 'Streaming', description: 'Catalog discovery, stream resolution, subtitles, and watch-state APIs.' },
      { name: 'Addons', description: 'Addon catalog, enablement, ordering, and profile assignment.' },
      { name: 'Lists', description: 'Watchlists, list items, sharing, and invite workflows.' },
      { name: 'Sync', description: 'Cloud sync configuration, status, and push/pull operations.' },
      { name: 'Trakt', description: 'Trakt auth, sync settings, recommendations, and scrobbling.' },
      {
        name: 'Gateway',
        description: 'Local-only sidecar proxy for desktop/Tauri that forwards allowlisted read routes to a remote Zentrio server with auth context preserved.',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'better-auth.session_token',
          description: 'Session cookie used by web clients authenticated through Better Auth.',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Bearer token used by desktop/mobile clients and selected API flows.',
        },
      },
    },
  }

  // Primary OpenAPI spec generated directly from OpenAPIHono-decorated routes.
  // We use a custom route so we can guarantee production metadata (security schemes, tags, etc.)
  // regardless of generator defaults.
  app.get(`${basePath}/openapi.json`, (c) => {
    const getDoc = (app as any).getOpenAPI31Document || (app as any).getOpenAPIDocument

    if (typeof getDoc !== 'function') {
      return c.json(docConfig)
    }

    const generated = getDoc.call(app, docConfig) || {}
    const merged = {
      ...generated,
      openapi: '3.1.0',
      info: {
        ...(generated.info || {}),
        ...docConfig.info,
      },
      servers: docConfig.servers,
      tags: docConfig.tags,
      components: {
        ...(generated.components || {}),
        securitySchemes: {
          ...((generated.components || {}).securitySchemes || {}),
          ...(docConfig.components.securitySchemes || {}),
        },
      },
    }

    return c.json(merged)
  })

  // Legacy hand-maintained spec retained for backward compatibility.
  app.get(`${basePath}/openapi-legacy.json`, (c) => {
    const baseSpec = {
      openapi: '3.1.0',
      info: {
        title: 'Zentrio API',
        version: '1.0.0',
        description: 'API for authentication, profiles, personalization, streaming discovery, playback, sync, and Trakt integration.',
        termsOfService: '/tos',
        contact: {
          name: 'Zentrio Support',
        },
      },
      servers: [
        {
          url: '/api',
          description: 'Current server',
        },
      ],
      tags: [
        { name: 'System', description: 'Health, diagnostics, and API discovery endpoints.' },
        { name: 'Authentication', description: 'Sign-in flows, sessions, provider discovery, and account linking.' },
        { name: 'Profiles', description: 'Create, update, and manage playback profiles.' },
        { name: 'User', description: 'Account-level settings, security actions, and user metadata.' },
        { name: 'Avatar', description: 'Avatar style lookup and deterministic/avatar-random generation endpoints.' },
        { name: 'Appearance', description: 'Theme and appearance preferences per profile or settings profile.' },
        { name: 'Streaming', description: 'Catalog discovery, stream resolution, subtitles, and watch-state APIs.' },
        { name: 'Addons', description: 'Addon catalog, enablement, ordering, and profile assignment.' },
        { name: 'Lists', description: 'Watchlists, list items, sharing, and invite workflows.' },
        { name: 'Sync', description: 'Cloud sync configuration, status, and push/pull operations.' },
        { name: 'Trakt', description: 'Trakt auth, sync settings, recommendations, and scrobbling.' },
        { name: 'Gateway', description: 'Local-only sidecar proxy for allowlisted read forwarding to remote Zentrio servers.' },
      ],
      components: {
        securitySchemes: {
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'better-auth.session_token',
            description: 'Session cookie used by web clients authenticated through Better Auth.',
          },
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Bearer token used by desktop/mobile clients and selected API flows.',
          },
        },
        schemas: {
          Error: {
            type: 'object',
            properties: {
              error: { type: 'string', example: 'An error occurred' },
            },
            required: ['error'],
          },
          HealthResponse: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ok' },
              timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
              app: {
                type: 'object',
                properties: {
                  version: { type: 'string', example: '0.4.12' },
                  uptime: { type: 'number', example: 3600 },
                  memory: { type: 'number', example: 52428800 },
                },
                required: ['version', 'uptime', 'memory'],
              },
              environment: {
                type: 'object',
                properties: {
                  database: { type: 'string', example: 'configured' },
                  auth: { type: 'string', example: 'configured' },
                },
                required: ['database', 'auth'],
              },
              stats: { $ref: '#/components/schemas/HealthStats' },
            },
            required: ['status', 'timestamp', 'app', 'environment', 'stats'],
          },
          HealthStats: {
            type: 'object',
            properties: {
              users: { type: 'number', example: 10 },
              profiles: { type: 'number', example: 15 },
              addons: { type: 'number', example: 5 },
              active_sessions: { type: 'number', example: 3 },
              watched_items: { type: 'number', example: 42 },
            },
            required: ['users', 'profiles', 'addons', 'active_sessions', 'watched_items'],
          },
          ApiInfo: {
            type: 'object',
            properties: {
              message: { type: 'string', example: 'Zentrio API' },
              version: { type: 'string', example: '1.0.0' },
              endpoints: { type: 'object' },
              notes: {
                type: 'object',
                properties: {
                  security: { type: 'string' },
                  rateLimiting: { type: 'string' },
                },
                required: ['security', 'rateLimiting'],
              },
            },
            required: ['message', 'version', 'notes'],
          },
          User: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'user123' },
              email: { type: 'string', format: 'email', example: 'user@example.com' },
              username: { type: 'string', example: 'johndoe' },
              firstName: { type: 'string', example: 'John' },
              lastName: { type: 'string', example: 'Doe' },
              twoFactorEnabled: { type: 'boolean', example: false },
            },
            required: ['id', 'email'],
          },
          Profile: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 1 },
              user_id: { type: 'string', example: 'user123' },
              name: { type: 'string', example: 'My Profile' },
              avatar: { type: 'string', example: 'JD' },
              avatar_type: { type: 'string', example: 'initials' },
              avatar_style: { type: 'string', example: 'bottts-neutral' },
              is_default: { type: 'boolean', example: false },
            },
            required: ['id', 'user_id', 'name'],
          },
          AuthProviders: {
            type: 'object',
            properties: {
              google: { type: 'boolean', example: true },
              github: { type: 'boolean', example: true },
              discord: { type: 'boolean', example: false },
              oidc: { type: 'boolean', example: false },
              oidcName: { type: 'string', example: 'OpenID' },
            },
            required: ['google', 'github', 'discord', 'oidc', 'oidcName'],
          },
        },
      },
      paths: {
      // Authentication Routes
      '/auth/providers': {
        get: {
          tags: ['Authentication'],
          summary: 'Get Auth Providers',
          description: 'Returns which authentication providers are enabled (Google, GitHub, Discord, OIDC)',
          responses: {
            200: {
              description: 'List of enabled providers',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AuthProviders' },
                },
              },
            },
          },
        },
      },
      '/auth/identify': {
        post: {
          tags: ['Authentication'],
          summary: 'Identify User',
          description: 'Check if a user exists by email without revealing additional information',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email', example: 'user@example.com' },
                  },
                  required: ['email'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'User existence check result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      exists: { type: 'boolean', example: true },
                      nickname: { type: 'string', nullable: true, example: 'johndoe' },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid email address',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/auth/sign-in/email': {
        post: {
          tags: ['Authentication'],
          summary: 'Sign In with Email',
          description: 'Authenticate using email and password',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                  },
                  required: ['email', 'password'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Sign in successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      user: { $ref: '#/components/schemas/User' },
                      session: { type: 'object' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Invalid credentials',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/auth/sign-up/email': {
        post: {
          tags: ['Authentication'],
          summary: 'Sign Up with Email',
          description: 'Create a new account with email and password',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                    name: { type: 'string' },
                  },
                  required: ['email', 'password'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Account created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      user: { $ref: '#/components/schemas/User' },
                      session: { type: 'object' },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid input or email already exists',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/auth/sign-out': {
        post: {
          tags: ['Authentication'],
          summary: 'Sign Out',
          description: 'Sign out the current user and invalidate the session',
          responses: {
            200: {
              description: 'Sign out successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/auth/session': {
        get: {
          tags: ['Authentication'],
          summary: 'Get Session',
          description: 'Get the current user session',
          responses: {
            200: {
              description: 'Current session',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      user: { $ref: '#/components/schemas/User' },
                      session: { type: 'object' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Not authenticated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      // Profile Routes
      '/profiles': {
        get: {
          tags: ['Profiles'],
          summary: 'List Profiles',
          description: 'Get all profiles for the authenticated user',
          responses: {
            200: {
              description: 'List of profiles',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Profile' },
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
        post: {
          tags: ['Profiles'],
          summary: 'Create Profile',
          description: 'Create a new profile for the authenticated user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', example: 'My Profile' },
                    avatar: { type: 'string', example: 'JD' },
                    avatarType: { type: 'string', example: 'initials' },
                    avatarStyle: { type: 'string', example: 'bottts-neutral' },
                    settingsProfileId: { type: 'number', nullable: true },
                  },
                  required: ['name'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Profile created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Profile' },
                },
              },
            },
            400: {
              description: 'Invalid input',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/profiles/{id}': {
        get: {
          tags: ['Profiles'],
          summary: 'Get Profile',
          description: 'Get a specific profile by ID',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Profile ID',
            },
          ],
          responses: {
            200: {
              description: 'Profile details',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Profile' },
                },
              },
            },
            404: {
              description: 'Profile not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
        put: {
          tags: ['Profiles'],
          summary: 'Update Profile',
          description: 'Update a profile',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Profile ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    avatar: { type: 'string' },
                    avatarType: { type: 'string' },
                    avatarStyle: { type: 'string' },
                    settingsProfileId: { type: 'number', nullable: true },
                  },
                  required: ['name'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Profile updated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Profile' },
                },
              },
            },
            403: {
              description: 'Forbidden - not owner',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            404: {
              description: 'Profile not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
        delete: {
          tags: ['Profiles'],
          summary: 'Delete Profile',
          description: 'Delete a profile (cannot delete default profile)',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Profile ID',
            },
          ],
          responses: {
            200: {
              description: 'Profile deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Cannot delete default or active profile',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            403: {
              description: 'Forbidden - not owner',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            404: {
              description: 'Profile not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      // User Routes
      '/user/settings': {
        get: {
          tags: ['User'],
          summary: 'Get User Settings',
          description: 'Get current user app settings',
          responses: {
            200: {
              description: 'User settings',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      addonManagerEnabled: { type: 'boolean' },
                      hideCalendarButton: { type: 'boolean' },
                      hideAddonsButton: { type: 'boolean' },
                      hideCinemetaContent: { type: 'boolean' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
        put: {
          tags: ['User'],
          summary: 'Update User Settings',
          description: 'Update current user app settings',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    addonManagerEnabled: { type: 'boolean' },
                    hideCalendarButton: { type: 'boolean' },
                    hideAddonsButton: { type: 'boolean' },
                    hideCinemetaContent: { type: 'boolean' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Settings saved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/user/profile': {
        get: {
          tags: ['User'],
          summary: 'Get User Profile',
          description: 'Get current user profile information including linked accounts',
          responses: {
            200: {
              description: 'User profile',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      username: { type: 'string' },
                      firstName: { type: 'string' },
                      lastName: { type: 'string' },
                      twoFactorEnabled: { type: 'boolean' },
                      hasPassword: { type: 'boolean' },
                      linkedAccounts: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            providerId: { type: 'string' },
                            createdAt: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/user/tmdb-api-key': {
        get: {
          tags: ['User'],
          summary: 'Get TMDB API Key',
          description: 'Get the current user TMDB API key',
          responses: {
            200: {
              description: 'TMDB API key',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tmdb_api_key: { type: 'string', nullable: true },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
        put: {
          tags: ['User'],
          summary: 'Update TMDB API Key',
          description: 'Update or clear the TMDB API key',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tmdb_api_key: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'API key updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tmdb_api_key: { type: 'string', nullable: true },
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid API key',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/user/password': {
        put: {
          tags: ['User'],
          summary: 'Change Password',
          description: 'Change user password with old password verification',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    oldPassword: { type: 'string' },
                    newPassword: { type: 'string' },
                  },
                  required: ['oldPassword', 'newPassword'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Password updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid old password',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/user/account': {
        delete: {
          tags: ['User'],
          summary: 'Delete Account',
          description: 'Permanently delete the user account',
          responses: {
            200: {
              description: 'Account deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      // Addons Routes
      '/addons': {
        get: {
          tags: ['Addons'],
          summary: 'List Addons',
          description: 'Get all addons for the current settings profile',
          responses: {
            200: {
              description: 'List of addons',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'number' },
                        manifest_url: { type: 'string' },
                        name: { type: 'string' },
                        enabled: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // Streaming Routes
      '/streaming/catalog': {
        get: {
          tags: ['Streaming'],
          summary: 'Get Catalog',
          description: 'Get streaming catalog from enabled addons',
          parameters: [
            {
              name: 'type',
              in: 'query',
              schema: { type: 'string', enum: ['movie', 'series'] },
              description: 'Content type',
            },
            {
              name: 'genre',
              in: 'query',
              schema: { type: 'string' },
              description: 'Genre filter',
            },
          ],
          responses: {
            200: {
              description: 'Catalog items',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        type: { type: 'string' },
                        poster: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/streaming/meta': {
        get: {
          tags: ['Streaming'],
          summary: 'Get Meta',
          description: 'Get metadata for a specific item',
          parameters: [
            {
              name: 'id',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Item ID',
            },
            {
              name: 'type',
              in: 'query',
              required: true,
              schema: { type: 'string', enum: ['movie', 'series'] },
              description: 'Content type',
            },
          ],
          responses: {
            200: {
              description: 'Metadata',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      meta: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          type: { type: 'string' },
                          poster: { type: 'string' },
                          description: { type: 'string' },
                          year: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/streaming/stream': {
        get: {
          tags: ['Streaming'],
          summary: 'Get Stream',
          description: 'Get streaming links for a specific item',
          parameters: [
            {
              name: 'id',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Item ID',
            },
            {
              name: 'type',
              in: 'query',
              required: true,
              schema: { type: 'string', enum: ['movie', 'series'] },
              description: 'Content type',
            },
          ],
          responses: {
            200: {
              description: 'Streaming links',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      streams: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            url: { type: 'string' },
                            name: { type: 'string' },
                            quality: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // Lists Routes
      '/lists': {
        get: {
          tags: ['Lists'],
          summary: 'Get Lists',
          description: 'Get all watchlists for the current user',
          responses: {
            200: {
              description: 'User lists',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'number' },
                        name: { type: 'string' },
                        items: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // Sync Routes
      '/sync': {
        post: {
          tags: ['Sync'],
          summary: 'Trigger Sync',
          description: 'Manually trigger data synchronization',
          responses: {
            200: {
              description: 'Sync started',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      // Avatar Routes
      '/avatar/styles': {
        get: {
          tags: ['Avatar'],
          summary: 'Get Avatar Styles',
          description: 'Returns all available avatar styles and the default style',
          responses: {
            200: {
              description: 'List of avatar styles',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      styles: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                          },
                        },
                      },
                      default: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/avatar/random': {
        get: {
          tags: ['Avatar'],
          summary: 'Generate Random Avatar',
          description: 'Generate a random avatar with optional style parameter',
          parameters: [
            {
              name: 'style',
              in: 'query',
              schema: { type: 'string' },
              description: 'Avatar style (optional, defaults to system default)',
            },
          ],
          responses: {
            200: {
              description: 'Random avatar generated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      svg: { type: 'string' },
                      seed: { type: 'string' },
                      style: { type: 'string' },
                      dataUrl: { type: 'string' },
                    },
                  },
                },
              },
            },
            500: {
              description: 'Failed to generate avatar',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      '/avatar/{seed}': {
        get: {
          tags: ['Avatar'],
          summary: 'Get Avatar by Seed',
          description: 'Generate an avatar SVG based on a seed string. Returns SVG image directly.',
          parameters: [
            {
              name: 'seed',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Seed string for deterministic avatar generation',
            },
            {
              name: 'style',
              in: 'query',
              schema: { type: 'string' },
              description: 'Avatar style (optional)',
            },
          ],
          responses: {
            200: {
              description: 'Avatar SVG image',
              content: {
                'image/svg+xml': {
                  schema: { type: 'string' },
                },
              },
            },
            500: {
              description: 'Failed to generate avatar',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      // Appearance Routes
      '/appearance/settings': {
        get: {
          tags: ['Appearance'],
          summary: 'Get Appearance Settings',
          description: 'Get appearance settings for a profile or settings profile',
          parameters: [
            {
              name: 'profileId',
              in: 'query',
              schema: { type: 'integer' },
              description: 'Profile ID (optional, will use default if not provided)',
            },
            {
              name: 'settingsProfileId',
              in: 'query',
              schema: { type: 'integer' },
              description: 'Settings Profile ID (overrides profileId if provided)',
            },
          ],
          responses: {
            200: {
              description: 'Appearance settings',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'object' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            404: {
              description: 'Profile or settings not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
        put: {
          tags: ['Appearance'],
          summary: 'Update Appearance Settings',
          description: 'Save appearance settings for a profile or settings profile',
          parameters: [
            {
              name: 'profileId',
              in: 'query',
              schema: { type: 'integer' },
              description: 'Profile ID (optional)',
            },
            {
              name: 'settingsProfileId',
              in: 'query',
              schema: { type: 'integer' },
              description: 'Settings Profile ID (overrides profileId if provided)',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
          responses: {
            200: {
              description: 'Settings saved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      // Gateway Routes
      '/gateway/{path}': {
        get: {
          tags: ['Gateway'],
          summary: 'Gateway Proxy',
          description: 'Local sidecar gateway for forwarding requests to remote server. Only available on localhost.',
          parameters: [
            {
              name: 'path',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Target path to proxy (must be in allowlist)',
            },
            {
              name: '__remote',
              in: 'query',
              schema: { type: 'string' },
              description: 'Remote base URL override',
            },
          ],
          responses: {
            200: {
              description: 'Proxied response',
            },
            403: {
              description: 'Forbidden - not on local host or route not allowed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            504: {
              description: 'Gateway upstream timeout or error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
        post: {
          tags: ['Gateway'],
          summary: 'Gateway Proxy',
          description: 'Forward POST requests via local sidecar gateway (allowlist restricted).',
          parameters: [
            {
              name: 'path',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Target path to proxy (must be in allowlist)',
            },
            {
              name: '__remote',
              in: 'query',
              schema: { type: 'string' },
              description: 'Remote base URL override',
            },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
          responses: {
            200: {
              description: 'Proxied response',
            },
            403: {
              description: 'Forbidden - not on local host or route not allowed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            504: {
              description: 'Gateway upstream timeout or error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
        put: {
          tags: ['Gateway'],
          summary: 'Gateway Proxy',
          description: 'Forward PUT requests via local sidecar gateway (allowlist restricted).',
          parameters: [
            {
              name: 'path',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Target path to proxy (must be in allowlist)',
            },
            {
              name: '__remote',
              in: 'query',
              schema: { type: 'string' },
              description: 'Remote base URL override',
            },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
          responses: {
            200: {
              description: 'Proxied response',
            },
            403: {
              description: 'Forbidden - not on local host or route not allowed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            504: {
              description: 'Gateway upstream timeout or error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
        delete: {
          tags: ['Gateway'],
          summary: 'Gateway Proxy',
          description: 'Forward DELETE requests via local sidecar gateway (allowlist restricted).',
          parameters: [
            {
              name: 'path',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Target path to proxy (must be in allowlist)',
            },
            {
              name: '__remote',
              in: 'query',
              schema: { type: 'string' },
              description: 'Remote base URL override',
            },
          ],
          responses: {
            200: {
              description: 'Proxied response',
            },
            403: {
              description: 'Forbidden - not on local host or route not allowed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
            504: {
              description: 'Gateway upstream timeout or error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' },
                },
              },
            },
          },
        },
      },
      // Additional Lists Routes
      '/lists/{id}/items': {
        get: {
          tags: ['Lists'],
          summary: 'Get List Items',
          description: 'Get all items in a specific list',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'List ID',
            },
            {
              name: 'profileId',
              in: 'query',
              schema: { type: 'integer' },
              description: 'Profile ID for watch status enrichment',
            },
          ],
          responses: {
            200: {
              description: 'List items',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      items: { type: 'array' },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Lists'],
          summary: 'Add Item to List',
          description: 'Add a content item to a list',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'List ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    metaId: { type: 'string' },
                    type: { type: 'string' },
                    title: { type: 'string' },
                    poster: { type: 'string' },
                    imdbRating: { type: 'number' },
                  },
                  required: ['metaId', 'type'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Item added successfully',
            },
            500: {
              description: 'Failed to add item',
            },
          },
        },
      },
      '/lists/{id}/items/{metaId}': {
        delete: {
          tags: ['Lists'],
          summary: 'Remove Item from List',
          description: 'Remove a specific item from a list',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'List ID',
            },
            {
              name: 'metaId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Meta ID of the item to remove',
            },
          ],
          responses: {
            200: {
              description: 'Item removed successfully',
            },
            500: {
              description: 'Failed to remove item',
            },
          },
        },
      },
      '/lists/check/{metaId}': {
        get: {
          tags: ['Lists'],
          summary: 'Check Lists for Item',
          description: 'Check which lists contain a specific item',
          parameters: [
            {
              name: 'metaId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Meta ID to check',
            },
            {
              name: 'profileId',
              in: 'query',
              required: true,
              schema: { type: 'integer' },
              description: 'Profile ID',
            },
          ],
          responses: {
            200: {
              description: 'List IDs containing the item',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      listIds: { type: 'array', items: { type: 'integer' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/lists/{id}/share': {
        post: {
          tags: ['Lists'],
          summary: 'Share List',
          description: 'Share a list with another user via email',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'List ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email' },
                    permission: { type: 'string', enum: ['read', 'add', 'full'] },
                  },
                  required: ['email'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Share created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      share: { type: 'object' },
                      emailSent: { type: 'boolean' },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid input or cannot share with self',
            },
            403: {
              description: 'Not list owner',
            },
          },
        },
      },
      '/lists/share/{token}': {
        get: {
          tags: ['Lists'],
          summary: 'Get Share Details',
          description: 'Get details of a shared list by token (public)',
          parameters: [
            {
              name: 'token',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Share token',
            },
          ],
          responses: {
            200: {
              description: 'Share details',
            },
            404: {
              description: 'Share not found or expired',
            },
            410: {
              description: 'Share invitation expired',
            },
          },
        },
      },
      '/lists/share/{token}/accept': {
        post: {
          tags: ['Lists'],
          summary: 'Accept Share',
          description: 'Accept a list share invitation',
          parameters: [
            {
              name: 'token',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Share token',
            },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    profileId: { type: 'integer' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Share accepted',
            },
            400: {
              description: 'Share already processed',
            },
            403: {
              description: 'Wrong email or own share',
            },
          },
        },
      },
      '/lists/shared-with-me': {
        get: {
          tags: ['Lists'],
          summary: 'Get Shared Lists',
          description: 'Get lists shared with the current user',
          responses: {
            200: {
              description: 'Shared lists',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      lists: { type: 'array' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
            },
          },
        },
      },
      '/lists/pending-invites': {
        get: {
          tags: ['Lists'],
          summary: 'Get Pending Invites',
          description: 'Get pending list share invitations for current user',
          responses: {
            200: {
              description: 'Pending invites',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      invites: { type: 'array' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
            },
          },
        },
      },
      // Additional Sync Routes
      '/sync/status': {
        get: {
          tags: ['Sync'],
          summary: 'Get Sync Status',
          description: 'Get current synchronization status and state',
          responses: {
            200: {
              description: 'Sync status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      remote_url: { type: 'string' },
                      auth_token: { type: 'string' },
                      is_syncing: { type: 'boolean' },
                      last_sync_at: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
            500: {
              description: 'Failed to get status',
            },
          },
        },
      },
      '/sync/config': {
        get: {
          tags: ['Sync'],
          summary: 'Get Sync Configuration',
          description: 'Get sync configuration including mode and server URL',
          responses: {
            200: {
              description: 'Sync configuration',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      mode: { type: 'string' },
                      serverUrl: { type: 'string' },
                      isConnected: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/sync/configure': {
        post: {
          tags: ['Sync'],
          summary: 'Configure Sync',
          description: 'Configure sync settings for cloud mode',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    serverUrl: { type: 'string' },
                    mode: { type: 'string', enum: ['cloud'] },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Configuration saved',
            },
            500: {
              description: 'Configuration failed',
            },
          },
        },
      },
      '/sync/connect': {
        post: {
          tags: ['Sync'],
          summary: 'Connect Sync',
          description: 'Connect to sync server with token',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    remoteUrl: { type: 'string' },
                    token: { type: 'string' },
                    userId: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Connected successfully',
            },
          },
        },
      },
      '/sync/disconnect': {
        post: {
          tags: ['Sync'],
          summary: 'Disconnect Sync',
          description: 'Disconnect from sync server',
          responses: {
            200: {
              description: 'Disconnected successfully',
            },
          },
        },
      },
      '/sync/token': {
        post: {
          tags: ['Sync'],
          summary: 'Generate Sync Token',
          description: 'Generate a sync token for Tauri/desktop clients',
          responses: {
            200: {
              description: 'Sync token generated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      syncToken: { type: 'string' },
                      userId: { type: 'string' },
                      expiresAt: { type: 'string' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized',
            },
          },
        },
      },
      '/sync/push': {
        post: {
          tags: ['Sync'],
          summary: 'Push Sync Data',
          description: 'Push local data to server (Tauri clients)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
          responses: {
            200: {
              description: 'Data pushed successfully',
            },
            401: {
              description: 'Unauthorized',
            },
          },
        },
      },
      '/sync/pull': {
        get: {
          tags: ['Sync'],
          summary: 'Pull Sync Data',
          description: 'Get changes from server since last sync (Tauri clients)',
          parameters: [
            {
              name: 'since',
              in: 'query',
              schema: { type: 'string', format: 'date-time' },
              description: 'Timestamp to get changes since',
            },
          ],
          responses: {
            200: {
              description: 'Changes retrieved',
            },
            401: {
              description: 'Unauthorized',
            },
          },
        },
      },
      // Trakt Routes (Extended)
      '/trakt/available': {
        get: {
          tags: ['Trakt'],
          summary: 'Check Trakt Availability',
          description: 'Check if Trakt integration is configured and available',
          responses: {
            200: {
              description: 'Availability status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      available: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/trakt/status': {
        get: {
          tags: ['Trakt'],
          summary: 'Get Trakt Status',
          description: 'Get Trakt connection status for a profile',
          parameters: [
            {
              name: 'profileId',
              in: 'query',
              required: true,
              schema: { type: 'integer' },
              description: 'Profile ID',
            },
          ],
          responses: {
            200: {
              description: 'Trakt status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      connected: { type: 'boolean' },
                      username: { type: 'string' },
                      syncEnabled: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/trakt/auth-url': {
        get: {
          tags: ['Trakt'],
          summary: 'Get Trakt Auth URL',
          description: 'Get OAuth authorization URL for Trakt',
          parameters: [
            {
              name: 'profileId',
              in: 'query',
              required: true,
              schema: { type: 'integer' },
              description: 'Profile ID',
            },
            {
              name: 'isTauri',
              in: 'query',
              schema: { type: 'string', enum: ['true', 'false'] },
              description: 'Whether request is from Tauri app',
            },
          ],
          responses: {
            200: {
              description: 'Auth URL and state',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      authUrl: { type: 'string' },
                      state: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/trakt/device-code': {
        post: {
          tags: ['Trakt'],
          summary: 'Get Device Code',
          description: 'Generate device code for Trakt.tv/activate flow',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    profileId: { type: 'integer' },
                  },
                  required: ['profileId'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Device code info',
            },
          },
        },
      },
      '/trakt/poll-token': {
        get: {
          tags: ['Trakt'],
          summary: 'Poll for Token',
          description: 'Poll for authorization status using poll token',
          parameters: [
            {
              name: 'pollToken',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Poll token from device-code endpoint',
            },
          ],
          responses: {
            200: {
              description: 'Polling result (pending, authorized, or expired)',
            },
          },
        },
      },
      '/trakt/disconnect': {
        post: {
          tags: ['Trakt'],
          summary: 'Disconnect Trakt',
          description: 'Disconnect Trakt from a profile',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    profileId: { type: 'integer' },
                  },
                  required: ['profileId'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Disconnected successfully',
            },
          },
        },
      },
      '/trakt/sync-settings': {
        put: {
          tags: ['Trakt'],
          summary: 'Update Sync Settings',
          description: 'Update Trakt sync settings for a profile',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    profileId: { type: 'integer' },
                    syncEnabled: { type: 'boolean' },
                    pushToTrakt: { type: 'boolean' },
                  },
                  required: ['profileId'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Settings updated',
            },
          },
        },
      },
      '/trakt/recommendations': {
        get: {
          tags: ['Trakt'],
          summary: 'Get Recommendations',
          description: 'Get personalized recommendations from Trakt',
          parameters: [
            {
              name: 'profileId',
              in: 'query',
              required: true,
              schema: { type: 'integer' },
              description: 'Profile ID',
            },
            {
              name: 'type',
              in: 'query',
              schema: { type: 'string', enum: ['movies', 'shows'] },
              description: 'Content type',
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer' },
              description: 'Number of items to return',
            },
          ],
          responses: {
            200: {
              description: 'Recommendations',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      items: { type: 'array' },
                      connected: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/trakt/scrobble/start': {
        post: {
          tags: ['Trakt'],
          summary: 'Start Scrobbling',
          description: 'Report playback start to Trakt',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    profileId: { type: 'integer' },
                    metaType: { type: 'string' },
                    imdbId: { type: 'string' },
                    tmdbId: { type: 'integer' },
                    season: { type: 'integer' },
                    episode: { type: 'integer' },
                    progress: { type: 'number' },
                  },
                  required: ['profileId', 'metaType'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Scrobble start reported',
            },
          },
        },
      },
      '/trakt/scrobble/pause': {
        post: {
          tags: ['Trakt'],
          summary: 'Pause Scrobbling',
          description: 'Report playback pause to Trakt',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    profileId: { type: 'integer' },
                    metaType: { type: 'string' },
                    imdbId: { type: 'string' },
                    tmdbId: { type: 'integer' },
                    season: { type: 'integer' },
                    episode: { type: 'integer' },
                    progress: { type: 'number' },
                  },
                  required: ['profileId', 'metaType'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Scrobble pause reported',
            },
          },
        },
      },
      '/trakt/scrobble/stop': {
        post: {
          tags: ['Trakt'],
          summary: 'Stop Scrobbling',
          description: 'Report playback stop to Trakt',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    profileId: { type: 'integer' },
                    metaType: { type: 'string' },
                    imdbId: { type: 'string' },
                    tmdbId: { type: 'integer' },
                    season: { type: 'integer' },
                    episode: { type: 'integer' },
                    progress: { type: 'number' },
                  },
                  required: ['profileId', 'metaType'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Scrobble stop reported',
            },
          },
        },
      },
      '/trakt/checkin': {
        post: {
          tags: ['Trakt'],
          summary: 'Check In',
          description: 'Check in to a movie or episode on Trakt',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    profileId: { type: 'integer' },
                    metaType: { type: 'string' },
                    imdbId: { type: 'string' },
                    tmdbId: { type: 'integer' },
                    season: { type: 'integer' },
                    episode: { type: 'integer' },
                    message: { type: 'string' },
                  },
                  required: ['profileId', 'metaType'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Checkin successful',
            },
          },
        },
        delete: {
          tags: ['Trakt'],
          summary: 'Cancel Checkin',
          description: 'Cancel active checkin',
          parameters: [
            {
              name: 'profileId',
              in: 'query',
              required: true,
              schema: { type: 'integer' },
              description: 'Profile ID',
            },
          ],
          responses: {
            200: {
              description: 'Checkin cancelled',
            },
          },
        },
      },
      // Streaming Routes (Extended)
      '/streaming/settings': {
        get: {
          tags: ['Streaming'],
          summary: 'Get Streaming Settings',
          description: 'Get streaming settings for a profile',
          parameters: [
            {
              name: 'profileId',
              in: 'query',
              schema: { type: 'integer' },
              description: 'Profile ID',
            },
            {
              name: 'settingsProfileId',
              in: 'query',
              schema: { type: 'integer' },
              description: 'Settings Profile ID',
            },
          ],
          responses: {
            200: {
              description: 'Streaming settings',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'object' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
            },
          },
        },
        put: {
          tags: ['Streaming'],
          summary: 'Update Streaming Settings',
          description: 'Update streaming settings for a profile',
          parameters: [
            {
              name: 'profileId',
              in: 'query',
              schema: { type: 'integer' },
              description: 'Profile ID',
            },
            {
              name: 'settingsProfileId',
              in: 'query',
              schema: { type: 'integer' },
              description: 'Settings Profile ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
          responses: {
            200: {
              description: 'Settings saved',
            },
            401: {
              description: 'Authentication required',
            },
          },
        },
      },
      '/streaming/streams/{type}/{id}': {
        get: {
          tags: ['Streaming'],
          summary: 'Get Streams',
          description: 'Get streaming links for a movie or series episode',
          parameters: [
            {
              name: 'type',
              in: 'path',
              required: true,
              schema: { type: 'string', enum: ['movie', 'series'] },
              description: 'Content type',
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Content ID (e.g., tt1234567)',
            },
            {
              name: 'profileId',
              in: 'query',
              required: true,
              schema: { type: 'integer' },
              description: 'Profile ID',
            },
            {
              name: 'season',
              in: 'query',
              schema: { type: 'integer' },
              description: 'Season number (for series)',
            },
            {
              name: 'episode',
              in: 'query',
              schema: { type: 'integer' },
              description: 'Episode number (for series)',
            },
          ],
          responses: {
            200: {
              description: 'Streaming links',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      streams: { type: 'array' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/streaming/streams-live/{type}/{id}': {
        get: {
          tags: ['Streaming'],
          summary: 'Get Streams Live (SSE)',
          description: 'Get streaming links via Server-Sent Events for real-time updates',
          parameters: [
            {
              name: 'type',
              in: 'path',
              required: true,
              schema: { type: 'string', enum: ['movie', 'series'] },
              description: 'Content type',
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Content ID',
            },
            {
              name: 'profileId',
              in: 'query',
              required: true,
              schema: { type: 'integer' },
              description: 'Profile ID',
            },
            {
              name: 'season',
              in: 'query',
              schema: { type: 'integer' },
              description: 'Season number',
            },
            {
              name: 'episode',
              in: 'query',
              schema: { type: 'integer' },
              description: 'Episode number',
            },
            {
              name: 'refresh',
              in: 'query',
              schema: { type: 'string', enum: ['true', 'false'] },
              description: 'Force refresh cache',
            },
          ],
          responses: {
            200: {
              description: 'SSE stream of addon results',
              content: {
                'text/event-stream': {
                  schema: { type: 'string' },
                },
              },
            },
          },
        },
      },
      '/streaming/subtitles/{type}/{id}': {
        get: {
          tags: ['Streaming'],
          summary: 'Get Subtitles',
          description: 'Get subtitles for a movie or series',
          parameters: [
            {
              name: 'type',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Content type',
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Content ID',
            },
            {
              name: 'profileId',
              in: 'query',
              required: true,
              schema: { type: 'integer' },
              description: 'Profile ID',
            },
            {
              name: 'videoHash',
              in: 'query',
              schema: { type: 'string' },
              description: 'Video hash for subtitle matching',
            },
          ],
          responses: {
            200: {
              description: 'Subtitles list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      subtitles: { type: 'array' },
                      debug: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/streaming/search': {
        get: {
          tags: ['Streaming'],
          summary: 'Search Content',
          description: 'Search for movies and series across addons',
          parameters: [
            {
              name: 'q',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Search query',
            },
            {
              name: 'profileId',
              in: 'query',
              required: true,
              schema: { type: 'integer' },
              description: 'Profile ID',
            },
            {
              name: 'type',
              in: 'query',
              schema: { type: 'string', enum: ['movie', 'series'] },
              description: 'Filter by type',
            },
            {
              name: 'year',
              in: 'query',
              schema: { type: 'integer' },
              description: 'Filter by year',
            },
            {
              name: 'sort',
              in: 'query',
              schema: { type: 'string' },
              description: 'Sort order',
            },
          ],
          responses: {
            200: {
              description: 'Search results',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      results: { type: 'array' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/streaming/progress': {
        post: {
          tags: ['Streaming'],
          summary: 'Save Progress',
          description: 'Save watch progress for a movie or episode',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    profileId: { type: 'integer' },
                    metaId: { type: 'string' },
                    metaType: { type: 'string' },
                    season: { type: 'integer' },
                    episode: { type: 'integer' },
                    position: { type: 'number' },
                    duration: { type: 'number' },
                  },
                  required: ['profileId', 'metaId', 'metaType'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Progress saved',
            },
            400: {
              description: 'Missing required fields',
            },
          },
        },
      },
      '/streaming/mark-watched': {
        post: {
          tags: ['Streaming'],
          summary: 'Mark as Watched',
          description: 'Mark content as watched or unwatched',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    profileId: { type: 'integer' },
                    metaId: { type: 'string' },
                    metaType: { type: 'string' },
                    season: { type: 'integer' },
                    episode: { type: 'integer' },
                    watched: { type: 'boolean' },
                  },
                  required: ['profileId', 'metaId', 'metaType', 'watched'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Watch status updated',
            },
          },
        },
      },
      '/streaming/details/{type}/{id}': {
        get: {
          tags: ['Streaming'],
          summary: 'Get Content Details',
          description: 'Get detailed metadata for a movie or series',
          parameters: [
            {
              name: 'type',
              in: 'path',
              required: true,
              schema: { type: 'string', enum: ['movie', 'series'] },
              description: 'Content type',
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Content ID',
            },
            {
              name: 'profileId',
              in: 'query',
              required: true,
              schema: { type: 'integer' },
              description: 'Profile ID',
            },
          ],
          responses: {
            200: {
              description: 'Content details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      meta: { type: 'object' },
                      inLibrary: { type: 'boolean' },
                      watchProgress: { type: 'object' },
                    },
                  },
                },
              },
            },
            404: {
              description: 'Content not found',
            },
          },
        },
      },
      '/streaming/dashboard': {
        get: {
          tags: ['Streaming'],
          summary: 'Get Dashboard',
          description: 'Get dashboard data including continue watching and catalog metadata',
          parameters: [
            {
              name: 'profileId',
              in: 'query',
              schema: { type: 'integer' },
              description: 'Profile ID (optional, uses default if not provided)',
            },
          ],
          responses: {
            200: {
              description: 'Dashboard data',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      catalogMetadata: { type: 'array' },
                      history: { type: 'array' },
                      continueWatchingHero: { type: 'object' },
                      trending: { type: 'array' },
                      profile: { type: 'object' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Authentication required',
            },
          },
        },
      },
      // Additional Addons Routes
      '/addons/profile/{profileId}': {
        get: {
          tags: ['Addons'],
          summary: 'Get Profile Addons',
          description: 'Get enabled addons for a profile',
          parameters: [
            {
              name: 'profileId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Profile ID',
            },
          ],
          responses: {
            200: {
              description: 'Enabled addons for profile',
              content: {
                'application/json': {
                  schema: { type: 'array' },
                },
              },
            },
          },
        },
      },
      '/addons/settings-profile/{settingsProfileId}': {
        get: {
          tags: ['Addons'],
          summary: 'Get Settings Profile Addons',
          description: 'Get enabled addons for a settings profile',
          parameters: [
            {
              name: 'settingsProfileId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Settings Profile ID',
            },
          ],
          responses: {
            200: {
              description: 'Enabled addons',
              content: {
                'application/json': {
                  schema: { type: 'array' },
                },
              },
            },
          },
        },
      },
      '/addons/settings-profile/{settingsProfileId}/manage': {
        get: {
          tags: ['Addons'],
          summary: 'Manage Addons',
          description: 'Get all addons with status for a settings profile',
          parameters: [
            {
              name: 'settingsProfileId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Settings Profile ID',
            },
          ],
          responses: {
            200: {
              description: 'All addons with status',
              content: {
                'application/json': {
                  schema: { type: 'array' },
                },
              },
            },
          },
        },
      },
      '/addons/settings-profile/{settingsProfileId}/toggle': {
        post: {
          tags: ['Addons'],
          summary: 'Toggle Addon',
          description: 'Enable or disable an addon for a settings profile',
          parameters: [
            {
              name: 'settingsProfileId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Settings Profile ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    addonId: { type: 'integer' },
                    enabled: { type: 'boolean' },
                  },
                  required: ['addonId', 'enabled'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Addon toggled',
            },
          },
        },
      },
      '/addons/settings-profile/{settingsProfileId}/reorder': {
        post: {
          tags: ['Addons'],
          summary: 'Reorder Addons',
          description: 'Update addon order for a settings profile',
          parameters: [
            {
              name: 'settingsProfileId',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Settings Profile ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    addonIds: { type: 'array', items: { type: 'integer' } },
                  },
                  required: ['addonIds'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Order updated',
            },
            400: {
              description: 'Invalid addonIds',
            },
          },
        },
      },
      // Additional Auth Routes
      '/auth/sign-in/social': {
        post: {
          tags: ['Authentication'],
          summary: 'Social Sign In',
          description: 'Sign in with a social provider (Google, GitHub, Discord, OIDC)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    provider: { type: 'string', enum: ['google', 'github', 'discord', 'oidc'] },
                    callbackURL: { type: 'string' },
                  },
                  required: ['provider', 'callbackURL'],
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Sign in initiated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      url: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/auth/link-social/{provider}': {
        post: {
          tags: ['Authentication'],
          summary: 'Link Social Account',
          description: 'Link a social provider to existing account',
          parameters: [
            {
              name: 'provider',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Provider name',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    callbackURL: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Linking initiated',
            },
          },
        },
      },
      '/auth/mobile-callback': {
        post: {
          tags: ['Authentication'],
          summary: 'Mobile Callback',
          description: 'Handle mobile/desktop deep link callback with authorization code',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    url: { type: 'string' },
                    authCode: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Authentication successful',
            },
            401: {
              description: 'Invalid or expired code',
            },
          },
        },
      },
      '/auth/link-code': {
        post: {
          tags: ['Authentication'],
          summary: 'Generate Link Code',
          description: 'Generate a link code for Tauri account linking',
          responses: {
            200: {
              description: 'Link code generated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      linkCode: { type: 'string' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Not authenticated',
            },
          },
        },
      },
    },
    }
    return c.json(baseSpec)
  })
}

// Scalar API Reference UI
export function setupScalarUI(app: OpenAPIHono, basePath: string = '/api') {
  app.get(`${basePath}/docs`, apiReference({
    theme: 'kepler',
    layout: 'modern',
    hideClientButton: true,
    defaultHttpClient: {
      targetKey: 'js',
      clientKey: 'fetch',
    },
    url: '/api/openapi.json',
    metaData: {
      title: 'Zentrio API Documentation',
      description: 'Interactive API documentation for the Zentrio streaming platform',
    },
  }))
}
