# 🏠 Self-Hosting Zentrio

Deploy Zentrio on your own infrastructure for full control over your data and customization options.

## 🎯 Choose Your Installation Method

### ⚡ Quick Start (Docker) - Recommended
**For**: Users who want to get running in 5 minutes
- **Time**: 5 minutes
- **Skill**: Basic command line
- **Requirements**: Docker and Docker Compose

[Jump to Quick Start](#-quick-start-docker-recommended)

### 🔧 Manual Installation
**For**: Users who prefer native setup or need custom configuration
- **Time**: 10-15 minutes
- **Skill**: Intermediate
- **Requirements**: Node.js 18+ or Bun

[Jump to Manual Installation](#-manual-installation)

### 🚀 Advanced Setup
**For**: Production deployment with security and optimization
- **Time**: 20-30 minutes
- **Skill**: Advanced
- **Requirements**: All above + reverse proxy knowledge

[Jump to Advanced Setup](#-advanced-setup)

---

## ⚡ Quick Start (Docker) - Recommended

Get Zentrio running in minutes with Docker.

### Prerequisites
- Docker and Docker Compose installed
- Git for cloning the repository

### One-Command Setup

```bash
# Clone and start Zentrio
git clone https://github.com/MichielEijpe/Zentrio.git && cd Zentrio && \
cp .env.example .env && \
docker-compose up -d
```

That's it! Zentrio is running at `http://localhost:3000`

### Basic Configuration

Edit `.env` for essential settings:

```bash
# Minimum required changes
AUTH_SECRET=change-this-to-a-random-string
ENCRYPTION_KEY=change-this-to-another-random-string
APP_URL=http://localhost:3000
```

Generate secure secrets:
```bash
# Generate AUTH_SECRET
openssl rand -base64 32

# Generate ENCRYPTION_KEY
openssl rand -hex 32
```

### Verify Installation

1. **Health Check**: Visit `http://localhost:3000/health`
2. **Web Interface**: Open `http://localhost:3000` in your browser
3. **Create Profile**: Test by creating your first profile

---

## 🔧 Manual Installation

### Prerequisites
- Node.js 18+ or Bun
- Git for cloning the repository
- 512MB RAM minimum
- 1GB disk space

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

Zentrio is now running at `http://localhost:3000`

## 🚀 Advanced Setup

For production deployment with security and optimization features.

### Database Optimization

```bash
# Optimized SQLite settings
DATABASE_URL=./data/zentrio.db?cache=shared&mode=rwc&journal_mode=WAL
```

### Email Setup (Optional but Recommended)

```bash
# Gmail configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=Zentrio <noreply@yourdomain.com>
```

### Security Configuration

```bash
# Rate limiting
RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
RATE_LIMIT_LIMIT=100           # Max requests per window

# CORS
CORS_ORIGIN=https://yourdomain.com
```

### Reverse Proxy Setup

#### Nginx

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

#### Caddy

```caddyfile
yourdomain.com {
    reverse_proxy localhost:3000
}
```

### Docker Production Deployment

#### Dockerfile

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

#### Docker Compose (Production)

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

---

## 🔧 Configuration Options

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

## 📊 Monitoring

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

## 💾 Backup

### Database Backup

```bash
# Backup
cp data/zentrio.db data/zentrio.backup.db

# Automated backup
0 2 * * * cp /path/to/data/zentrio.db /backups/zentrio-$(date +\%Y\%m\%d).db
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find what's using port 3000
lsof -i :3000
# Kill the process
kill -9 <PID>
```

### Permission Issues
```bash
# Fix data directory permissions
sudo chown -R $USER:$USER ./data
chmod 755 ./data
```

### Docker Issues
```bash
# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Build Failures
```bash
# Clean and rebuild
cd app
rm -rf node_modules dist
bun install
bun run build
```

### Database Locked

```bash
# Check for running processes
ps aux | grep zentrio

# Wait or restart server
```

---

## 🚀 Next Steps

### Immediate Actions

1. **Create your first profile** with your Stremio credentials
2. **Test profile switching** to ensure everything works
3. **Explore settings** and customize your experience

### Production Considerations

If you're setting this up for production:

- [ ] Change default secrets
- [ ] Set up HTTPS with reverse proxy
- [ ] Configure backups
- [ ] Set up monitoring

Learn more in our [Deployment Guide](../deployment/)

### Further Learning

After deployment:

1. **User Guide**: [Learn about profiles and features](../user-guide/)
2. **Mobile Setup**: [Set up mobile apps](../mobile/)
3. **Configuration**: [Advanced configuration options](../reference/configuration.md)
4. **Development**: [Contribute to Zentrio](../development/)

## 🆘 Need Help?

- **Documentation**: [Full documentation](../)
- **Issues**: [GitHub Issues](https://github.com/MichielEijpe/Zentrio/issues)
- **Discussions**: [GitHub Discussions](https://github.com/MichielEijpe/Zentrio/discussions)

---

**🎉 Congratulations!** You have Zentrio running. Start creating profiles and enjoy enhanced Stremio experience!