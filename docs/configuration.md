---
layout: default
title: Configuration Guide
---

# ⚙️ Configuration Guide

This guide covers all configuration options available in Zentrio, from basic setup to advanced customization.

## 📋 Environment Variables

Zentrio uses environment variables for configuration. Copy [`.env.example`](../.env.example) to `.env` and modify as needed.

### Required Configuration

```bash
# Security (MUST be changed in production)
AUTH_SECRET=your-super-secret-auth-key-change-this-in-production
ENCRYPTION_KEY=your-super-secret-encryption-key-change-this-in-production

# Database
DATABASE_URL=./data/zentrio.db

# Server
PORT=3000
NODE_ENV=production
APP_URL=http://localhost:3000  # Your public URL
```

### Email Configuration (Recommended)

```bash
# SMTP Settings
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

### Rate Limiting

```bash
# Rate Limiting (optional)
RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
RATE_LIMIT_LIMIT=100           # Max requests per window
```

### Logging

```bash
# Logging Configuration
PROXY_LOGS=true                # Enable request/proxy logging
STREMIO_LOGS=false             # Enable verbose Stremio logs
LOG_LEVEL=info                 # debug, info, warn, error
```

---

## 🔐 Security Configuration

### Authentication Secret

Generate a strong secret for JWT tokens:

```bash
# Using OpenSSL
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Encryption Key

Generate a key for data encryption:

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Bun
bun -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

### Security Headers

Zentrio automatically includes security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HTTPS only)

---

## 📧 Email Setup

### Gmail Configuration

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate an App Password**:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
3. **Configure environment variables**:

```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-generated-app-password
EMAIL_FROM=Zentrio <noreply@yourdomain.com>
```

### Other Email Providers

#### Outlook/Hotmail
```bash
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_SECURE=false
```

#### SendGrid
```bash
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASS=YOUR_SENDGRID_API_KEY
```

#### Custom SMTP
```bash
EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-smtp-username
EMAIL_PASS=your-smtp-password
```

---

## 🗄️ Database Configuration

### SQLite Options

```bash
# Basic SQLite
DATABASE_URL=./data/zentrio.db

# SQLite with optimizations
DATABASE_URL=./data/zentrio.db?cache=shared&mode=rwc

# SQLite with WAL mode (better concurrency)
DATABASE_URL=./data/zentrio.db?mode=rwc&cache=shared&journal_mode=WAL
```

### Database Connection Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `mode` | Database mode | `rwc` (read/write/create) |
| `cache` | Cache mode | `shared` |
| `journal_mode` | Journal mode | `DELETE` |
| `synchronous` | Sync mode | `NORMAL` |

### Database Optimization

```bash
# Production-optimized SQLite
DATABASE_URL=./data/zentrio.db?mode=rwc&cache=shared&journal_mode=WAL&synchronous=NORMAL&temp_store=memory&mmap_size=268435456
```

---

## 🌐 Server Configuration

### Basic Server Settings

```bash
# Server Configuration
PORT=3000
NODE_ENV=production
APP_URL=https://yourdomain.com
```

### Advanced Server Options

```bash
# Request limits
BODY_LIMIT=1048576          # 1MB max request body
QUERY_LIMIT=1000            # Max query string length

# Timeout settings
REQUEST_TIMEOUT=30000       # 30 seconds
KEEP_ALIVE_TIMEOUT=5000     # 5 seconds
```

### CORS Configuration

```bash
# CORS Settings
CORS_ORIGIN=*               # Allowed origins (comma-separated)
CORS_METHODS=GET,POST,PUT,DELETE
CORS_CREDENTIALS=true
```

---

## 🎨 Theme Configuration

### Custom Themes

Create custom themes in the [`src/themes/`](../app/src/themes/) directory:

```json
{
  "name": "Custom Theme",
  "colors": {
    "primary": "#your-primary-color",
    "secondary": "#your-secondary-color",
    "background": "#your-background-color",
    "surface": "#your-surface-color",
    "text": "#your-text-color",
    "text-secondary": "#your-text-secondary-color"
  },
  "typography": {
    "fontFamily": "Inter, sans-serif",
    "fontSize": {
      "xs": "12px",
      "sm": "14px",
      "base": "16px",
      "lg": "18px",
      "xl": "20px",
      "2xl": "24px",
      "3xl": "30px"
    },
    "fontWeight": {
      "normal": "400",
      "medium": "500",
      "semibold": "600",
      "bold": "700"
    }
  },
  "spacing": {
    "xs": "4px",
    "sm": "8px",
    "md": "16px",
    "lg": "24px",
    "xl": "32px",
    "2xl": "48px"
  },
  "borderRadius": {
    "sm": "4px",
    "md": "8px",
    "lg": "12px",
    "xl": "16px"
  }
}
```

### Theme Selection

Set the default theme in your environment:

```bash
DEFAULT_THEME=zentrio
AVAILABLE_THEMES=zentrio,midnight,stremio,custom
```

---

## 📱 Mobile App Configuration

### Capacitor Configuration

Edit [`app/capacitor.config.ts`](../app/capacitor.config.ts):

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
    allowNavigation: ['*']
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#0366d6",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#999999",
      splashFullScreen: true,
      splashImmersive: true,
      layoutName: "launch_screen",
      useDialog: true
    }
  }
};

export default config;
```

### App Store Configuration

#### Android (Google Play Store)

Update [`app/android/app/build.gradle`](../app/android/app/build.gradle):

```gradle
android {
    defaultConfig {
        applicationId "com.zentrio.app"
        minSdkVersion 21
        targetSdkVersion 33
        versionCode 1
        versionName "1.0.0"
    }
}
```

#### iOS (App Store)

Update [`app/ios/App/App/Info.plist`](../app/ios/App/App/Info.plist):

```xml
<key>CFBundleDisplayName</key>
<string>Zentrio</string>
<key>CFBundleVersion</key>
<string>1.0.0</string>
```

---

## 🔌 Plugin Configuration

### Addon Management

Configure addon behavior:

```bash
# Addon Settings
ADDON_CACHE_TTL=3600        # Cache addons for 1 hour
ADDON_TIMEOUT=10000         # 10 second timeout
MAX_ADDONS=50               # Maximum addons per profile
```

### NSFW Filter

```bash
# NSFW Filter Configuration
NSFW_FILTER_ENABLED=false
NSFW_FILTER_STRICT=false
NSFW_KEYWORDS=adult,mature,explicit
```

### Downloads Manager

```bash
# Download Settings
DOWNLOADS_ENABLED=false
DOWNLOADS_PATH=./downloads
MAX_DOWNLOAD_SIZE=1073741824  # 1GB
DOWNLOAD_TIMEOUT=300000       # 5 minutes
```

---

## 🐳 Docker Configuration

### Docker Compose

Customize your [`docker-compose.yml`](../docker-compose.yml):

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
    volumes:
      - ./data:/app/data
      - ./.env:/app/.env
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Dockerfile Customization

```dockerfile
FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY app/package.json app/bun.lock ./
COPY app/tsconfig.json ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY app/ ./

# Copy environment
COPY .env.example .env

# Build application
RUN bun run build

# Create data directory
RUN mkdir -p data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["bun", "start"]
```

---

## 🔍 Monitoring and Logging

### Log Levels

```bash
# Available log levels
LOG_LEVEL=debug    # All logs
LOG_LEVEL=info     # Info, warnings, errors
LOG_LEVEL=warn     # Warnings and errors only
LOG_LEVEL=error    # Errors only
```

### Structured Logging

```bash
# Log format
LOG_FORMAT=json    # JSON format for parsing
LOG_FORMAT=text    # Human-readable format
```

### Metrics Collection

```bash
# Metrics (optional)
METRICS_ENABLED=false
METRICS_PORT=9090
METRICS_PATH=/metrics
```

---

## 🚀 Performance Tuning

### Memory Optimization

```bash
# Node.js memory limits
NODE_OPTIONS=--max-old-space-size=512

# Bun memory settings
BUN_RUNTIME_OPTIONS=--max-old-space-size=512
```

### Caching Configuration

```bash
# Cache settings
CACHE_TTL=300              # 5 minutes default cache
CACHE_MAX_SIZE=100          # Max cached items
CACHE_STRATEGY=lru          # LRU cache strategy
```

### Database Pooling

```bash
# Database connection pool
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000
```

---

## 🔧 Advanced Configuration

### Environment-Specific Configs

Create separate configs for different environments:

```bash
# .env.development
NODE_ENV=development
LOG_LEVEL=debug
PROXY_LOGS=true
STREMIO_LOGS=true

# .env.staging
NODE_ENV=staging
LOG_LEVEL=info
PROXY_LOGS=true
STREMIO_LOGS=false

# .env.production
NODE_ENV=production
LOG_LEVEL=warn
PROXY_LOGS=false
STREMIO_LOGS=false
```

### Feature Flags

```bash
# Feature toggles
FEATURE_DOWNLOADS=false
FEATURE_NSFW_FILTER=false
FEATURE_THEMES=true
FEATURE_MOBILE_APPS=true
```

### Experimental Features

```bash
# Experimental settings
EXPERIMENTAL_CACHE=true
EXPERIMENTAL_COMPRESSION=true
EXPERIMENTAL_WEBSOCKETS=false
```

---

## 📋 Configuration Checklist

### Production Deployment

- [ ] Change `AUTH_SECRET` and `ENCRYPTION_KEY`
- [ ] Set `NODE_ENV=production`
- [ ] Configure email settings
- [ ] Set correct `APP_URL`
- [ ] Enable HTTPS
- [ ] Configure rate limiting
- [ ] Set up monitoring
- [ ] Test all features

### Security Review

- [ ] Strong secrets generated
- [ ] HTTPS enabled
- [ ] Rate limiting configured
- [ ] Security headers verified
- [ ] Email authentication working
- [ ] Database permissions set

### Performance Optimization

- [ ] Database optimized
- [ ] Caching enabled
- [ ] Compression enabled
- [ ] Resource limits set
- [ ] Monitoring configured

---

## 🔍 Troubleshooting Configuration

### Common Issues

#### Database Connection Errors
```bash
# Check database file permissions
ls -la data/zentrio.db

# Test database connection
sqlite3 data/zentrio.db ".tables"
```

#### Email Not Sending
```bash
# Test SMTP connection
telnet smtp.gmail.com 587

# Check email configuration
curl -X POST http://localhost:3000/api/test-email
```

#### Authentication Failures
```bash
# Verify JWT secret
echo $AUTH_SECRET | wc -c

# Test token generation
curl -X POST http://localhost:3000/api/auth/test
```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Enable all debug logs
DEBUG=* LOG_LEVEL=debug bun run dev

# Specific debug modules
DEBUG=auth,database,email LOG_LEVEL=debug bun run dev
```

---

## 📚 Additional Resources

- [Environment Variables Reference](https://hono.dev/guides/basics#environment-variables)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Capacitor Configuration](https://capacitorjs.com/docs/config)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

For more help, check the [Development Guide](development) or open an issue on GitHub.