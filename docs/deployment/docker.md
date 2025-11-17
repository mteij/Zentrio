# 🐳 Docker Deployment Guide

Deploy Zentrio using Docker for a consistent, isolated, and easily manageable installation. This is the recommended method for most users.

## 🎯 Why Use Docker?

- **Consistent Environment**: Same setup everywhere
- **Isolation**: No conflicts with system packages
- **Easy Updates**: Simple version management
- **Portability**: Move between servers easily
- **Security**: Containerized application

## 🚀 Quick Start (5 Minutes)

### Prerequisites

- Docker and Docker Compose installed
- Git for cloning the repository
- 5 minutes of your time

### One-Command Installation

```bash
# Clone, configure, and start Zentrio
git clone https://github.com/MichielEijpe/Zentrio.git && cd Zentrio && \
cp .env.example .env && \
docker-compose up -d
```

That's it! Zentrio is now running at `http://localhost:3000`

### Basic Configuration

Edit the `.env` file for essential settings:

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

## 📋 Docker Compose Configuration

### Basic Setup

The included `docker-compose.yml` provides a basic setup:

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

### Production Configuration

For production use, consider this enhanced configuration:

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
      - DATABASE_URL=/app/data/zentrio.db?cache=shared&mode=rwc&journal_mode=WAL
    volumes:
      - ./data:/app/data
      - ./.env:/app/.env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    resource limits:
      mem_limit: 512m
      cpus: '0.5'
```

## 🔧 Dockerfile Analysis

### Multi-stage Build

Zentrio uses an optimized multi-stage Dockerfile:

```dockerfile
# Build stage
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY app/package.json app/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY app/ ./
RUN bun run build

# Runtime stage
FROM oven/bun:1-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
RUN mkdir -p data
EXPOSE 3000
CMD ["bun", "start"]
```

### Optimization Features

- **Alpine Linux**: Minimal base image
- **Multi-stage**: Smaller final image
- **Production dependencies**: Only runtime dependencies
- **Non-root user**: Enhanced security

## 🌐 Production Deployment

### With Reverse Proxy

#### Nginx Configuration

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

#### Docker Compose with Nginx

```yaml
version: '3.8'
services:
  zentrio:
    build: .
    expose:
      - "3000"
    environment:
      - NODE_ENV=production
      - APP_URL=https://yourdomain.com
    volumes:
      - ./data:/app/data
      - ./.env:/app/.env
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - zentrio
    restart: unless-stopped
```

### SSL/HTTPS Setup

#### Let's Encrypt with Certbot

```yaml
version: '3.8'
services:
  zentrio:
    build: .
    expose:
      - "3000"
    environment:
      - NODE_ENV=production
      - APP_URL=https://yourdomain.com
    volumes:
      - ./data:/app/data
      - ./.env:/app/.env
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on:
      - zentrio
    restart: unless-stopped
    
  certbot:
    image: certbot/certbot
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt
      - ./certbot-www:/var/www/certbot
    command: certonly --webroot --webroot-path=/var/www/certbot --email your@email.com --agree-tos --no-eff-email -d yourdomain.com
```

## 📊 Monitoring & Logging

### Health Checks

Built-in health check configuration:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### Log Management

Configure logging for production:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

### Monitoring with Docker Compose

```bash
# View logs
docker-compose logs -f zentrio

# Check container status
docker-compose ps

# Monitor resource usage
docker stats zentrio_zentrio_1
```

## 🔒 Security Best Practices

### Container Security

1. **Non-root User**: Container runs as non-root user
2. **Read-only Filesystem**: Where possible
3. **Resource Limits**: CPU and memory limits
4. **Network Isolation**: Proper network configuration

### Environment Variables

Secure your environment variables:

```bash
# Use Docker secrets for sensitive data
echo "your-secret-key" | docker secret create auth_secret -
```

### Firewall Configuration

```bash
# Only allow necessary ports
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny 3000/tcp  # Direct access blocked
```

## 🔄 Updates & Maintenance

### Updating Zentrio

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Automated Updates

Create a simple update script:

```bash
#!/bin/bash
# update-zentrio.sh
cd /path/to/Zentrio
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
docker system prune -f
```

### Backup Strategy

```bash
#!/bin/bash
# backup-zentrio.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/zentrio"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker cp zentrio_zentrio_1:/app/data/zentrio.db $BACKUP_DIR/zentrio_$DATE.db

# Backup configuration
cp .env $BACKUP_DIR/env_$DATE.backup

# Clean old backups (keep 7 days)
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
find $BACKUP_DIR -name "*.backup" -mtime +7 -delete
```

## 🐛 Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check logs
docker-compose logs zentrio

# Check configuration
docker-compose config

# Rebuild container
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

#### Permission Issues

```bash
# Fix data directory permissions
sudo chown -R 1000:1000 ./data
chmod 755 ./data
```

#### Port Conflicts

```bash
# Check what's using port 3000
netstat -tulpn | grep :3000

# Use different port
docker-compose up -d --scale zentrio=0
sed -i 's/3000:3000/3001:3000/' docker-compose.yml
docker-compose up -d
```

#### Database Issues

```bash
# Access container shell
docker-compose exec zentrio sh

# Check database
ls -la /app/data/
sqlite3 /app/data/zentrio.db ".tables"
```

### Performance Issues

#### Memory Usage

```bash
# Check memory usage
docker stats zentrio_zentrio_1

# Add memory limits
docker-compose down
# Edit docker-compose.yml to add mem_limit
docker-compose up -d
```

#### Disk Space

```bash
# Clean up Docker
docker system prune -a

# Check container size
docker images zentrio_zentrio
```

## 🚀 Advanced Configurations

### Multi-Stage Deployment

```yaml
version: '3.8'
services:
  zentrio-staging:
    build: .
    ports:
      - "3001:3000"
    environment:
      - NODE_ENV=staging
      - APP_URL=https://staging.yourdomain.com
    volumes:
      - ./staging-data:/app/data
      - ./.env.staging:/app/.env
    
  zentrio-production:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - APP_URL=https://yourdomain.com
    volumes:
      - ./production-data:/app/data
      - ./.env.production:/app/.env
```

### Docker Swarm Deployment

```yaml
version: '3.8'
services:
  zentrio:
    image: zentrio:latest
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
    ports:
      - "3000:3000"
    networks:
      - zentrio-network
    volumes:
      - zentrio-data:/app/data

networks:
  zentrio-network:
    driver: overlay

volumes:
  zentrio-data:
    driver: local
```

---

Need help with Docker deployment? [Check our troubleshooting guide](../help/troubleshooting.md) or [ask the community](https://github.com/MichielEijpe/Zentrio/discussions).