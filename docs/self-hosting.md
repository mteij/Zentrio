# 🏠 Self-Hosting Zentrio

Self-hosting Zentrio gives you complete control over your data, privacy, and configuration. This guide will walk you through various deployment methods.

## 🎯 Why Self-Host?

- **🔒 Privacy**: Your data never leaves your infrastructure
- **🎛️ Control**: Full configuration freedom
- **🚀 Performance**: No external dependencies or rate limits
- **💰 Cost-effective**: Use your existing infrastructure
- **🌐 Offline**: Works without internet connection (after initial setup)

## 📋 Prerequisites

- **Docker** (recommended) or **Node.js 18+**
- **Git** to clone the repository
- **Domain name** (optional, for HTTPS)
- **Basic command line knowledge]

---

## 🐳 Method 1: Docker Compose (Recommended)

The easiest way to get started with Docker Compose.

### Quick Start

```bash
# Clone the repository
git clone https://github.com/MichielEijpe/Zentrio.git
cd Zentrio

# Copy environment file
cp .env.example .env

# Edit the environment file (see Configuration section)
nano .env

# Start with Docker Compose
docker-compose up -d
```

That's it! Zentrio is now running on `http://localhost:3000`

### Docker Compose File

Your [`docker-compose.yml`](../docker-compose.yml) includes:

```yaml
version: '3.8'
services:
  zentrio:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
      - ./.env:/app/.env
    restart: unless-stopped
```

### Docker Commands

```bash
# View logs
docker-compose logs -f

# Stop the service
docker-compose down

# Update to latest version
git pull
docker-compose build
docker-compose up -d
```

---

## 💻 Method 2: Manual Installation

Install Zentrio directly on your system without Docker.

### Prerequisites

- **Bun** (recommended) or **Node.js 18+**
- **SQLite3** (usually included with Node.js)

### Installation Steps

```bash
# Clone the repository
git clone https://github.com/MichielEijpe/Zentrio.git
cd Zentrio

# Install Bun (if not installed)
curl -fsSL https://bun.sh/install | bash

# Navigate to app directory
cd app

# Install dependencies
bun install

# Copy and configure environment
cp ../.env.example ../.env
nano ../.env

# Build the application
bun run build

# Start the server
bun start
```

### Using PM2 for Production

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start bun --name "zentrio" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

---

## ⚙️ Configuration

Edit your `.env` file with the following important settings:

### Required Settings

```bash
# Security (CHANGE THESE IN PRODUCTION)
AUTH_SECRET=your-super-secret-auth-key-change-this-in-production
ENCRYPTION_KEY=your-super-secret-encryption-key-change-this-in-production

# Database
DATABASE_URL=./data/zentrio.db

# Server
PORT=3000
NODE_ENV=production
APP_URL=http://localhost:3000  # Change to your domain
```

### Email Configuration (Optional but Recommended)

```bash
# Email for authentication
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@yourdomain.com
```

### Rate Limiting

```bash
# Rate limiting (optional)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_LIMIT=100
```

---

## 🌐 Setting Up a Domain

### Option A: Using Nginx Reverse Proxy

Create an Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

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

### Option B: Using Caddy (Automatic HTTPS)

Create a `Caddyfile`:

```
your-domain.com {
    reverse_proxy localhost:3000
}
```

Run Caddy:
```bash
caddy run
```

---

## 🔒 Security Best Practices

### 1. Environment Variables

- **Never commit `.env` to version control**
- Use strong, unique secrets
- Rotate keys periodically

### 2. Firewall

```bash
# Allow only necessary ports
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw enable
```

### 3. SSL/TLS

- Always use HTTPS in production
- Let's Encrypt provides free certificates
- Caddy handles this automatically

### 4. Regular Updates

```bash
# Update Zentrio regularly
git pull origin main
docker-compose build
docker-compose up -d
```

---

## 📊 Monitoring

### Health Check

Zentrio provides a health endpoint at `/health`

```bash
curl http://localhost:3000/health
```

### Logs

```bash
# Docker logs
docker-compose logs -f zentrio

# PM2 logs
pm2 logs zentrio

# Manual logs
tail -f data/zentrio.log
```

---

## 🚀 Performance Optimization

### 1. Database Optimization

```bash
# SQLite optimization in .env
DATABASE_URL=./data/zentrio.db?cache=shared&mode=rwc
```

### 2. Reverse Proxy Caching

Add caching to your Nginx configuration:

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### 3. Resource Limits

Set appropriate limits in Docker:

```yaml
services:
  zentrio:
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```

---

## 🔧 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Find what's using port 3000
lsof -i :3000
# Kill the process
kill -9 <PID>
```

#### Permission Issues
```bash
# Fix file permissions
chown -R $USER:$USER ./data
chmod 755 ./data
```

#### Database Locked
```bash
# Restart the service
docker-compose restart zentrio
```

### Getting Help

- Check the [GitHub Issues](https://github.com/MichielEijpe/Zentrio/issues)
- Review the [Development Guide](development)
- Join our community discussions

---

## 📦 Backup and Restore

### Backup

```bash
# Backup database and configuration
tar -czf zentrio-backup-$(date +%Y%m%d).tar.gz data/ .env
```

### Restore

```bash
# Stop the service
docker-compose down

# Restore from backup
tar -xzf zentrio-backup-YYYYMMDD.tar.gz

# Start the service
docker-compose up -d
```

---

## 🎉 Next Steps

Once your Zentrio instance is running:

1. **Create your first profile** and test functionality
2. **Set up regular backups** for data safety
3. **Configure monitoring** for production use
4. **Consider mobile app deployment** for full experience

For more advanced configuration, see the [Configuration Guide](configuration) and [Development Documentation](development).