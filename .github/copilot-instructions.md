# Zentrio AI Coding Assistant Instructions

## Architecture Overview

Zentrio is a **high-performance streaming proxy application** built with **Hono + Bun.js**, featuring user authentication and Stremio integration. The app operates as a middleware proxy that sits between users and Stremio services, providing enhanced features and session management.

### Core Architecture Pattern
- **Framework**: Hono (web framework) + Bun (runtime)
- **Auth**: Custom implementation using Better Auth patterns with SQLite database
- **Proxy Chain**: Layered middleware system for request processing, session validation, and response modification
- **Database**: SQLite with comprehensive schema for users, profiles, sessions, and proxy analytics

## Key Service Boundaries

### 1. Authentication Layer (`src/routes/api/auth.ts`)
- **Custom auth system**: Email/password, OTP, magic links with bcrypt + SQLite storage
- **Session management**: `sessionDb` with HTTP-only cookies, 7-day expiration
- **Rate limiting**: Built-in for OTP/magic link endpoints (5 per hour, 1 per 30s)

### 2. Proxy Infrastructure (`src/middleware/proxy/`)
- **Middleware chain**: `proxyMiddlewareChain` applies: timing → logging → session validation → rate limiting → response headers → script injection → error handling
- **Target URL routing**: Smart routing between `web.stremio.com` and `api.strem.io` based on path patterns
- **Profile-based features**: NSFW filtering, addon management via `profile_proxy_settings` table

## Proxy Service Architecture

The proxy service is the core component that transforms Zentrio into a middleware layer between users and Stremio services. It consists of multiple coordinated systems:

### Core Proxy Components

#### 1. **Proxy Middleware Chain** (`src/middleware/proxy/index.ts`)
Seven-layer middleware system that processes every proxy request in order:

1. **Request Timing** (`requestTimingMiddleware`): Performance monitoring, adds `X-Response-Time` header
2. **Enhanced Logging** (`proxyLoggerMiddleware`): Detailed request/response logging with metrics
3. **Session Validation** (`proxySessionValidator`): Dual session system (user + proxy sessions)
4. **Rate Limiting** (`proxyRateLimiter`): Per-endpoint rate limits (100-200 req/min)
5. **Response Headers** (`responseHeadersMiddleware`): CORS, CSP, cookie rewriting
6. **Script Injection** (`scriptInjectorMiddleware`): Injects Zentrio enhancements into HTML
7. **Error Handling** (`proxyErrorHandler`): Structured error responses with logging

#### 2. **Route Handlers**
- **Stremio Routes** (`src/routes/stremio/[...path].ts`): Main proxy endpoint handling `/stremio/*`
- **Generic Proxy** (`src/routes/api/proxy.ts`): URL-based proxy at `/api/proxy?url=<target>`
- **Proxy Management**: Settings, sessions, and metrics endpoints

#### 3. **Core Proxy Service** (`src/services/proxy/ProxyService.ts`)
The `proxyRequest()` function handles the actual proxying:
- Header manipulation (removes cache headers, sets Host)
- Redirect handling with URL rewriting
- Response decompression (gzip, deflate)
- Streaming support for large responses

### Expected Proxy Behavior

#### URL Routing Patterns
```
/stremio/{profileId}/web/{path}    → https://web.stremio.com/{path}
/stremio/{profileId}/api/{path}    → https://api.strem.io/{path}
/stremio/https://example.com       → https://example.com (direct URL)
/api/proxy?url=https://example.com → https://example.com (generic proxy)
```

#### Session Management Flow
1. **Initial Request**: Checks for `sessionId` cookie or `sessionToken` query param
2. **Session Validation**: Validates against `user_sessions` and `proxy_sessions` tables
3. **Proxy Session Creation**: Creates proxy session for tracking and features
4. **Cookie Persistence**: Sets scoped `/stremio` cookie for subsequent asset requests
5. **Static Asset Bypass**: CSS/JS/images skip authentication for performance

#### Response Transformation
- **CORS Headers**: Sets permissive CORS for cross-origin requests
- **CSP Modification**: Replaces restrictive CSP with permissive policy
- **Cookie Rewriting**: Removes domain restrictions, adjusts security flags
- **Cache Prevention**: Disables caching for proxy-sensitive resources
- **Script Injection**: Adds Zentrio features to HTML responses

#### Rate Limiting Strategy
Three-tier rate limiting system:
- **Generic Endpoints**: 100 requests/minute
- **Stremio Endpoints**: 200 requests/minute  
- **API Endpoints**: 50 requests/minute
- **Identifier**: SHA-256 hash of IP + User-Agent
- **Headers**: Includes `X-RateLimit-*` headers for client awareness

#### Error Handling Patterns
- **Network Errors**: Returns 502 with user-friendly HTML error page
- **Timeout Errors**: Returns 504 with retry suggestions
- **DNS Errors**: Returns 502 with connectivity guidance
- **Rate Limit Exceeded**: Returns 429 with `Retry-After` header
- **All Errors**: Logged to `proxy_logs` table with full context

### Proxy Enhancement Features

#### Script Injection System (`src/middleware/proxy/scriptInjector.ts`)
Injects JavaScript into HTML responses for:
- **Session Data**: Transfers server session to client localStorage
- **UI Modifications**: Hides elements based on profile settings
- **Zentrio Branding**: Adds watermarks and modified logos
- **Logout Functionality**: Provides logout button and session monitoring

#### Profile-Based Proxy Settings
Each user profile can have customized proxy behavior:
- **NSFW Filtering**: Age-based content filtering
- **Addon Management**: Enable/disable addon manager
- **UI Customization**: Hide calendar/addon buttons
- **Downloads**: Enable/disable download features
- **Mobile Enhancements**: Click-to-hover for mobile devices

#### Performance & Monitoring
- **Request Metrics**: Tracks response times, error rates, request counts
- **Slow Request Detection**: Logs requests > 1 second
- **Error Tracking**: Unique error IDs for debugging
- **Database Logging**: All proxy requests logged to `proxy_logs` table
- **Cleanup Tasks**: Automatic cleanup of expired proxy sessions

### Integration with Stremio Services

#### Target Service Detection
- **web.stremio.com**: Main Stremio web interface
- **api.strem.io**: Stremio API endpoints
- **Static Assets**: Direct passthrough for CSS, JS, images, fonts

#### Location Header Rewriting
Redirects from Stremio services are rewritten to maintain proxy routing:
```javascript
location.replace('https://web.stremio.com/', '/stremio/{profileId}/web/')
```

#### Content Decompression
Automatically decompresses gzipped/deflated responses to allow content modification while removing `content-encoding` headers.

The proxy system is designed to be transparent to Stremio while providing enhanced features, security, and user management capabilities.

### 3. Database Architecture (`src/services/database.ts`)
- **Comprehensive schema**: Users, profiles, sessions, proxy sessions, logs, settings, rate limits
- **Atomic operations**: Transaction-based profile defaults, session cleanup
- **Security patterns**: Passwords hashed with bcrypt (12 rounds), tokens SHA-256 hashed

## Development Workflow

### Essential Commands (from `app/` directory)
```bash
bun dev          # Hot reload development server
bun run start    # Production server
bun run build    # Build for production
bun run preview  # Preview production build
```

### Environment Setup
- **Root `.env`**: Loaded via custom `envParser.ts` from project root (not app directory)
- **Required vars**: `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, email SMTP settings
- **SQLite database**: Auto-created at `app/zentrio.db` with comprehensive schema

### Database Management
- **Auto-migration**: Schema tables created automatically on startup
- **Cleanup tasks**: Hourly cleanup of expired sessions, OTP codes, magic links
- **Query patterns**: Prepared statements throughout, explicit foreign key constraints

## Critical Patterns & Conventions

### 1. Request Flow Architecture
```
Request → CORS/Security → Proxy Middleware Chain → Route Handler → Response
```
- **Static files**: Explicit `/static/*` handler with MIME type mapping
- **Proxy routes**: `/api/proxy/*` and `/stremio/*` use full middleware chain
- **API routes**: Standard `/api/*` routes with auth validation

### 2. Error Handling Strategy
- **Proxy errors**: User-friendly HTML error pages for Stremio (502 status)
- **API errors**: JSON responses with structured error messages
- **Rate limiting**: Throws `RATE_LIMITED` errors, handled with 429 status

### 3. Security Implementation
- **Session validation**: Custom middleware checks proxy sessions vs user sessions
- **CORS handling**: Explicit preflight handling for proxy routes
- **Header manipulation**: Removes caching headers, sets proxy identification headers

### 4. Code Organization Patterns
- **Route modules**: Each feature area has dedicated route file (auth, profiles, user, etc.)
- **Service layer**: Database operations abstracted into `*Db` objects with CRUD methods
- **Middleware composition**: Reusable middleware pieces composed into chains

## Integration Points

### Stremio Proxy Integration
- **URL rewriting**: `/{profileId}/{service}/{path}` → `https://{service}.strem.io/{path}`
- **Response modification**: Location header rewriting, content decompression
- **Session injection**: Profile settings and session data injected into responses

### Email Service Integration
- **SMTP configuration**: Nodemailer with environment-based config
- **Email types**: Welcome, OTP, magic link emails with custom templates
- **Error handling**: Graceful fallback when email service unavailable

## Performance Considerations

- **Bun.js runtime**: Leverages native performance optimizations
- **SQLite optimization**: Prepared statements, indexed queries, foreign key constraints
- **Response streaming**: Hono streaming support for large responses
- **Connection pooling**: Not needed for SQLite, but ready for PostgreSQL/MySQL

## Common Debugging Patterns

1. **Proxy issues**: Check `proxy_logs` table and console output for request/response details
2. **Auth problems**: Verify session token in cookies, check `user_sessions` expiration
3. **Database errors**: SQLite pragmas enabled, check foreign key constraints
4. **Environment issues**: `initEnv()` must be called before `getConfig()` in startup

When implementing new features, follow the established patterns: create service functions in `database.ts`, add route handlers in appropriate modules, and compose middleware for complex request processing.
