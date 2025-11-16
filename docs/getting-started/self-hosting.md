# Self-Hosting Zentrio

Deploy Zentrio on your own infrastructure for full control over your data.

## Prerequisites

- Node.js 18+ or Bun
- SQLite support
- 512MB RAM minimum
- 1GB disk space

## Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/MichielEijpe/Zentrio.git
cd Zentrio

# Start with Docker Compose
docker-compose up -d
```

Access Zentrio at `http://localhost:3000`

## Manual Installation

### 1. Clone and Setup

```bash
git clone https://github.com/MichielEijpe/Zentrio.git
cd Zentrio
cp .env.example .env
```

### 2. Configure Environment

Edit `.env` file with your settings:

```bash
# Required - Change these in production
AUTH_SECRET=your-super-secret-auth-key
ENCRYPTION_KEY=your-super-secret-encryption-key

# Database
DATABASE_URL=./data/zentrio.db

# Server
PORT=3000
NODE_ENV=production
APP_URL=http://localhost:3000
```

### 3. Install Dependencies

```bash
# Using Bun (recommended)
cd app
bun install
bun run build

# Or using npm
cd app
npm install
npm run build
```

### 4. Start the Server

```bash
# Development
bun run dev

# Production
bun run start
```

## Configuration

### Database

Zentrio uses SQLite by default. For production, consider:

```bash
# Optimized SQLite
DATABASE_URL=./data/zentrio.db?cache=shared&mode=rwc&journal_mode=WAL
```

### Email (Optional)

Configure email for magic link authentication:

```bash
# SMTP Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

### Security

For production deployment:

```bash
# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_LIMIT=100

# CORS
CORS_ORIGIN=https://yourdomain.com
```

## Reverse Proxy

### Nginx

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Caddy

```caddyfile
yourdomain.com {
    reverse_proxy localhost:3000
}
```

## Docker Deployment

### Dockerfile

```dockerfile
FROM oven/bun:1-alpine

WORKDIR /app

COPY app/package.json app/bun.lock ./
RUN bun install --frozen-lockfile --production

COPY app/ ./
COPY .env.example .env

RUN bun run build
RUN mkdir -p data

EXPOSE 3000

CMD ["bun", "start"]
```

### Docker Compose

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
```

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

### Logs

```bash
# Docker logs
docker-compose logs -f zentrio

# Direct logs
bun run start 2>&1 | tee zentrio.log
```

## Backup

### Database Backup

```bash
# Backup
cp data/zentrio.db data/zentrio.backup.db

# Automated backup
0 2 * * * cp /path/to/data/zentrio.db /backups/zentrio-$(date +\%Y\%m\%d).db
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>
```

### Permission Issues

```bash
# Fix data directory permissions
chmod 755 data
chmod 644 data/zentrio.db
```

### Database Locked

```bash
# Check for running processes
ps aux | grep zentrio

# Wait or restart server
```

## Next Steps

After deployment:

1. [Configure user settings](../../user-guide/settings.md)
2. [Set up mobile apps](../../mobile/)
3. [Configure production settings](../../deployment/production.md)
4. [Review API documentation](../../api/)