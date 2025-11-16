# Configuration Reference

Complete guide to Zentrio configuration options.

## Environment Variables

### Required

These must be set for Zentrio to function:

```bash
# Authentication secret - Change in production!
AUTH_SECRET=your-super-secret-auth-key-change-this-in-production

# Encryption key - Change in production!
ENCRYPTION_KEY=your-super-secret-encryption-key-change-this-in-production

# Database path
DATABASE_URL=./data/zentrio.db
```

### Server Settings

```bash
# Server configuration
PORT=3000
NODE_ENV=production
APP_URL=http://localhost:3000

# Request limits
BODY_LIMIT=1048576          # 1MB max request body
QUERY_LIMIT=1000            # Max query string length

# Timeout settings
REQUEST_TIMEOUT=30000       # 30 seconds
KEEP_ALIVE_TIMEOUT=5000     # 5 seconds
```

### Database Configuration

```bash
# SQLite options
DATABASE_URL=./data/zentrio.db?mode=rwc&cache=shared&journal_mode=WAL&synchronous=NORMAL

# Connection pool
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

### Security

```bash
# Rate limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_LIMIT=100         # Requests per window

# CORS
CORS_ORIGIN=*               # Allowed origins
CORS_METHODS=GET,POST,PUT,DELETE
CORS_CREDENTIALS=true

# Session
SESSION_SECRET=your-session-secret
SESSION_TTL=86400000         # 24 hours
```

### Email Configuration

```bash
# SMTP settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# Email templates
EMAIL_TEMPLATE_MAGIC_LINK=templates/magic-link.html
EMAIL_TEMPLATE_WELCOME=templates/welcome.html
```

### Features

```bash
# Feature flags
DOWNLOADS_ENABLED=false
NSFW_FILTER_ENABLED=false
MOBILE_APPS_ENABLED=true

# Addon management
ADDON_CACHE_TTL=3600         # 1 hour
ADDON_TIMEOUT=10000          # 10 seconds
MAX_ADDONS=50
```

### Mobile App

```bash
# Capacitor configuration
CAPACITOR_SERVER_URL=http://localhost:3000
CAPACITOR_SCHEME=https
CAPACITOR_CLEARTTEXT=true

# Build settings
ANDROID_VERSION_CODE=1
ANDROID_VERSION_NAME=1.0.0
IOS_BUILD_NUMBER=1
IOS_VERSION=1.0.0
```

### Logging

```bash
# Log levels
LOG_LEVEL=info              # error, warn, info, debug

# Debug logs
DEBUG=auth,database,email
PROXY_LOGS=false
STREMIO_LOGS=false
```

## Configuration Files

### .env.example

```bash
# Required - MUST be changed in production
AUTH_SECRET=your-super-secret-auth-key-change-this-in-production
ENCRYPTION_KEY=your-super-secret-encryption-key-change-this-in-production

# Database
DATABASE_URL=./data/zentrio.db

# Server
PORT=3000
NODE_ENV=production
APP_URL=http://localhost:3000

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_LIMIT=100
CORS_ORIGIN=*
```

### docker-compose.yml

```yaml
version: '3.8'
services:
  zentrio:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - AUTH_SECRET=${AUTH_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    volumes:
      - ./data:/app/data
      - ./.env:/app/.env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### capacitor.config.ts

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zentrio.app',
  appName: 'Zentrio',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: true,
    url: process.env.CAPACITOR_SERVER_URL || 'http://localhost:3000'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#0366d6"
    }
  }
};

export default config;
```

## Production Checklist

### Security

- [ ] Change AUTH_SECRET to a strong random value
- [ ] Change ENCRYPTION_KEY to a strong random value
- [ ] Set NODE_ENV=production
- [ ] Configure proper CORS_ORIGIN
- [ ] Enable rate limiting
- [ ] Use HTTPS in production

### Performance

- [ ] Use WAL journal mode for SQLite
- [ ] Enable shared cache
- [ ] Set appropriate timeouts
- [ ] Configure reverse proxy
- [ ] Enable compression

### Monitoring

- [ ] Set up health checks
- [ ] Configure logging
- [ ] Monitor resource usage
- [ ] Set up alerts

## Common Patterns

### Development

```bash
NODE_ENV=development
LOG_LEVEL=debug
DEBUG=*
PROXY_LOGS=true
STREMIO_LOGS=true
```

### Production

```bash
NODE_ENV=production
LOG_LEVEL=warn
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_LIMIT=100
DATABASE_URL=./data/zentrio.db?cache=shared&mode=rwc&journal_mode=WAL
```

### High Performance

```bash
NODE_OPTIONS=--max-old-space-size=512
DATABASE_URL=./data/zentrio.db?cache=shared&mode=rwc&journal_mode=WAL&synchronous=NORMAL&mmap_size=268435456
CACHE_TTL=300
```

## Troubleshooting

### Database Issues

```bash
# Check database file
ls -la data/zentrio.db

# Test connection
sqlite3 data/zentrio.db ".tables"

# Check permissions
chmod 644 data/zentrio.db
```

### Authentication Issues

```bash
# Verify secrets
echo $AUTH_SECRET | wc -c
echo $ENCRYPTION_KEY | wc -c

# Test JWT
curl -X POST http://localhost:3000/api/auth/test
```

### Performance Issues

```bash
# Check memory usage
ps aux | grep zentrio

# Monitor database
sqlite3 data/zentrio.db "PRAGMA cache_size;"
```

For more information, see [Environment Variables](environment.md) or [Deployment Guide](../deployment/).