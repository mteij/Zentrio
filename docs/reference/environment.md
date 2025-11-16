# Environment Variables Reference

Complete list of all environment variables for Zentrio.

## Required Variables

These must be set for Zentrio to function:

### AUTH_SECRET
JWT signing secret for authentication.

```bash
AUTH_SECRET=your-super-secret-auth-key-change-this-in-production
```

- **Required**: Yes
- **Default**: None
- **Notes**: Must be at least 32 characters long

### ENCRYPTION_KEY
Key for encrypting sensitive data.

```bash
ENCRYPTION_KEY=your-super-secret-encryption-key-change-this-in-production
```

- **Required**: Yes
- **Default**: None
- **Notes**: Must be at least 32 characters long

### DATABASE_URL
SQLite database connection string.

```bash
DATABASE_URL=./data/zentrio.db
```

- **Required**: Yes
- **Default**: `./data/zentrio.db`
- **Notes**: Can include SQLite parameters

## Server Configuration

### PORT
Server listening port.

```bash
PORT=3000
```

- **Required**: No
- **Default**: `3000`
- **Range**: 1-65535

### NODE_ENV
Application environment.

```bash
NODE_ENV=production
```

- **Required**: No
- **Default**: `development`
- **Options**: `development`, `production`, `test`

### APP_URL
Public URL of the application.

```bash
APP_URL=https://yourdomain.com
```

- **Required**: No
- **Default**: `http://localhost:3000`
- **Notes**: Used for links and redirects

### BODY_LIMIT
Maximum request body size.

```bash
BODY_LIMIT=1048576
```

- **Required**: No
- **Default**: `1048576` (1MB)
- **Format**: Bytes

### QUERY_LIMIT
Maximum query string length.

```bash
QUERY_LIMIT=1000
```

- **Required**: No
- **Default**: `1000`
- **Format**: Characters

### REQUEST_TIMEOUT
Request timeout in milliseconds.

```bash
REQUEST_TIMEOUT=30000
```

- **Required**: No
- **Default**: `30000` (30 seconds)
- **Format**: Milliseconds

## Database Options

### SQLite Parameters

```bash
DATABASE_URL=./data/zentrio.db?mode=rwc&cache=shared&journal_mode=WAL&synchronous=NORMAL
```

Parameters:
- `mode`: `rwc` (read/write/create)
- `cache`: `shared`
- `journal_mode`: `WAL` or `DELETE`
- `synchronous`: `NORMAL`, `FULL`, or `OFF`
- `temp_store`: `memory` or `file`
- `mmap_size`: Memory mapping size in bytes

## Security

### Rate Limiting

```bash
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_LIMIT=100
```

- `RATE_LIMIT_WINDOW_MS`: Time window in milliseconds
- `RATE_LIMIT_LIMIT`: Max requests per window

### CORS

```bash
CORS_ORIGIN=*
CORS_METHODS=GET,POST,PUT,DELETE
CORS_CREDENTIALS=true
```

- `CORS_ORIGIN`: Allowed origins (comma-separated)
- `CORS_METHODS`: Allowed HTTP methods
- `CORS_CREDENTIALS`: Allow credentials

### Session

```bash
SESSION_SECRET=your-session-secret
SESSION_TTL=86400000
```

- `SESSION_SECRET`: Session signing secret
- `SESSION_TTL`: Session time-to-live in milliseconds

## Email Configuration

### SMTP Settings

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

- `SMTP_HOST`: SMTP server hostname
- `SMTP_PORT`: SMTP server port
- `SMTP_SECURE`: Use SSL/TLS
- `SMTP_USER`: SMTP username
- `SMTP_PASS`: SMTP password
- `EMAIL_FROM`: From email address

### Email Templates

```bash
EMAIL_TEMPLATE_MAGIC_LINK=templates/magic-link.html
EMAIL_TEMPLATE_WELCOME=templates/welcome.html
```

## Feature Flags

```bash
DOWNLOADS_ENABLED=false
NSFW_FILTER_ENABLED=false
MOBILE_APPS_ENABLED=true
```

- `DOWNLOADS_ENABLED`: Enable downloads feature
- `NSFW_FILTER_ENABLED`: Enable NSFW filter
- `MOBILE_APPS_ENABLED`: Enable mobile app support

## Addon Management

```bash
ADDON_CACHE_TTL=3600
ADDON_TIMEOUT=10000
MAX_ADDONS=50
```

- `ADDON_CACHE_TTL`: Cache time-to-live in seconds
- `ADDON_TIMEOUT`: Request timeout in milliseconds
- `MAX_ADDONS`: Maximum addons per profile

## Mobile App

### Capacitor

```bash
CAPACITOR_SERVER_URL=http://localhost:3000
CAPACITOR_SCHEME=https
CAPACITOR_CLEARTTEXT=true
```

- `CAPACITOR_SERVER_URL`: Server URL for mobile apps
- `CAPACITOR_SCHEME`: URL scheme
- `CAPACITOR_CLEARTEXT`: Allow HTTP in development

### Build Settings

```bash
ANDROID_VERSION_CODE=1
ANDROID_VERSION_NAME=1.0.0
IOS_BUILD_NUMBER=1
IOS_VERSION=1.0.0
```

## Logging

### Log Level

```bash
LOG_LEVEL=info
```

- **Options**: `error`, `warn`, `info`, `debug`
- **Default**: `info`

### Debug Modules

```bash
DEBUG=auth,database,email
PROXY_LOGS=false
STREMIO_LOGS=false
```

- `DEBUG`: Comma-separated module names
- `PROXY_LOGS`: Enable proxy request logging
- `STREMIO_LOGS`: Enable Stremio API logging

## Performance

### Node.js Options

```bash
NODE_OPTIONS=--max-old-space-size=512
```

### Cache Settings

```bash
CACHE_TTL=300
```

- **Format**: Seconds
- **Default**: `300` (5 minutes)

## Production Examples

### Minimum Production

```bash
AUTH_SECRET=your-super-secret-auth-key-change-this-in-production
ENCRYPTION_KEY=your-super-secret-encryption-key-change-this-in-production
DATABASE_URL=./data/zentrio.db
NODE_ENV=production
PORT=3000
APP_URL=https://yourdomain.com
```

### Full Production

```bash
# Required
AUTH_SECRET=your-super-secret-auth-key-change-this-in-production
ENCRYPTION_KEY=your-super-secret-encryption-key-change-this-in-production

# Server
NODE_ENV=production
PORT=3000
APP_URL=https://yourdomain.com
BODY_LIMIT=1048576
REQUEST_TIMEOUT=30000

# Database
DATABASE_URL=./data/zentrio.db?cache=shared&mode=rwc&journal_mode=WAL

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_LIMIT=100
CORS_ORIGIN=https://yourdomain.com

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# Features
DOWNLOADS_ENABLED=false
NSFW_FILTER_ENABLED=false
MOBILE_APPS_ENABLED=true

# Logging
LOG_LEVEL=warn
PROXY_LOGS=false
STREMIO_LOGS=false
```

## Development Examples

### Basic Development

```bash
NODE_ENV=development
LOG_LEVEL=debug
DEBUG=*
```

### Mobile Development

```bash
NODE_ENV=development
CAPACITOR_SERVER_URL=http://192.168.1.100:3000
CAPACITOR_CLEARTTEXT=true
PROXY_LOGS=true
STREMIO_LOGS=true
```

## Security Notes

1. **Always change** `AUTH_SECRET` and `ENCRYPTION_KEY` in production
2. Use strong, random values for secrets
3. Don't commit `.env` files to version control
4. Use environment-specific values
5. Regularly rotate secrets

For configuration examples, see [Configuration Reference](configuration.md).