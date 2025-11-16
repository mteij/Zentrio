# ⚡ Quick Start Guide

Get Zentrio running in minutes with this streamlined setup guide for technically advanced users.

## 🎯 Prerequisites

- **Docker** (recommended) OR **Node.js 18+** and **Bun**
- **Git** for cloning the repository
- **Command line experience**
- **5-10 minutes** of time

---

## 🐳 Option 1: Docker (Recommended)

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

---

## 💻 Option 2: Manual Installation

### Quick Setup Commands

```bash
# Clone and setup
git clone https://github.com/MichielEijpe/Zentrio.git && cd Zentrio
cp .env.example .env

# Navigate to app directory
cd app

# Install dependencies and build
bun install && bun run build

# Start the server
bun start
```

Zentrio is now running at `http://localhost:3000`

---

## ✅ Verify Installation

1. **Health Check**: Visit `http://localhost:3000/health`
2. **Web Interface**: Open `http://localhost:3000` in your browser
3. **Create Profile**: Test by creating your first profile

## 🔧 Common Quick Configurations

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

### Database Optimization

```bash
# Optimized SQLite settings
DATABASE_URL=./data/zentrio.db?cache=shared&mode=rwc&journal_mode=WAL
```

### Rate Limiting

```bash
# Basic rate limiting
RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
RATE_LIMIT_LIMIT=100           # Max requests per window
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

---

## 🐛 Quick Troubleshooting

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

---

## 📚 Where to Go Next

- **User Guide**: [Learn about profiles and features](../user-guide/)
- **Mobile Setup**: [Set up mobile apps](../mobile/)
- **Configuration**: [Advanced configuration options](../reference/configuration.md)
- **Development**: [Contribute to Zentrio](../development/)

## 🆘 Need Help?

- **Documentation**: [Full documentation](../)
- **Issues**: [GitHub Issues](https://github.com/MichielEijpe/Zentrio/issues)
- **Discussions**: [GitHub Discussions](https://github.com/MichielEijpe/Zentrio/discussions)

---

**🎉 Congratulations!** You have Zentrio running. Start creating profiles and enjoy enhanced Stremio experience!