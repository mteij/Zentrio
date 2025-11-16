# 📚 Reference Documentation

This section contains comprehensive reference materials for Zentrio, including detailed configuration options, environment variables, and technical specifications.

## 📋 Reference Materials

### 1. [Configuration Reference](configuration.md)
Complete guide to all Zentrio configuration options, including:
- Environment variables
- Server settings
- Database configuration
- Security options
- Performance tuning
- Feature flags

### 2. [Environment Variables](environment.md)
Detailed reference for all environment variables:
- Required variables
- Optional settings
- Security configurations
- Performance options
- Development settings

### 3. [Changelog](changelog.md)
Version history and release notes:
- New features
- Bug fixes
- Breaking changes
- Migration guides

## 🔧 Quick Reference

### Essential Environment Variables

```bash
# Required (MUST be changed in production)
AUTH_SECRET=your-super-secret-auth-key-change-this-in-production
ENCRYPTION_KEY=your-super-secret-encryption-key-change-this-in-production

# Database
DATABASE_URL=./data/zentrio.db

# Server
PORT=3000
NODE_ENV=production
APP_URL=http://localhost:3000
```

### Common Configuration Patterns

#### Development Setup
```bash
NODE_ENV=development
LOG_LEVEL=debug
PROXY_LOGS=true
STREMIO_LOGS=true
```

#### Production Setup
```bash
NODE_ENV=production
LOG_LEVEL=warn
PROXY_LOGS=false
STREMIO_LOGS=false
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_LIMIT=100
```

#### High Performance
```bash
DATABASE_URL=./data/zentrio.db?cache=shared&mode=rwc&journal_mode=WAL
CACHE_TTL=300
NODE_OPTIONS=--max-old-space-size=512
```

## 📊 Configuration Categories

### 🔐 Security
- Authentication secrets
- Encryption keys
- Rate limiting
- CORS settings
- Security headers

### 🗄️ Database
- SQLite configuration
- Connection parameters
- Optimization settings
- Backup options

### 🌐 Server
- Port and host settings
- Request limits
- Timeout configurations
- SSL/TLS options

### 📧 Email
- SMTP configuration
- Authentication settings
- Template options
- Delivery settings

### 📱 Mobile
- Capacitor configuration
- Platform-specific settings
- Build options
- Deployment settings

### 🎨 Themes
- Theme selection
- Custom themes
- Color schemes
- Typography settings

## 🔍 Finding Information

### By Use Case

**I'm setting up Zentrio for the first time:**
- [Getting Started Guide](../getting-started/)
- [Quick Start](../getting-started/quick-start.md)
- [Environment Variables](environment.md)

**I'm configuring a production instance:**
- [Configuration Reference](configuration.md)
- [Deployment Guide](../deployment/)
- [Security Best Practices](../deployment/production.md)

**I'm developing for Zentrio:**
- [Development Guide](../development/)
- [API Documentation](../api/)
- [Architecture Overview](../development/architecture.md)

**I'm troubleshooting an issue:**
- [Troubleshooting Guide](../user-guide/troubleshooting.md)
- [Common Issues](../user-guide/troubleshooting.md#common-issues)
- [GitHub Issues](https://github.com/MichielEijpe/Zentrio/issues)

### By Component

**Authentication & Security:**
- [Authentication API](../api/authentication.md)
- [Security Configuration](configuration.md#security-configuration)
- [Environment Variables](environment.md#security)

**Database & Storage:**
- [Database Configuration](configuration.md#database-configuration)
- [Environment Variables](environment.md#database)
- [Backup & Restore](../deployment/production.md#backup-and-restore)

**Mobile Apps:**
- [Mobile Setup](../mobile/setup.md)
- [Capacitor Configuration](configuration.md#mobile-app-configuration)
- [Platform-Specific Settings](../mobile/)

**API Integration:**
- [API Reference](../api/)
- [Authentication](../api/authentication.md)
- [Endpoints](../api/endpoints.md)

## 📏 Technical Specifications

### System Requirements

#### Minimum
- **CPU**: 1 core
- **RAM**: 512MB
- **Storage**: 1GB
- **OS**: Linux, macOS, Windows

#### Recommended
- **CPU**: 2+ cores
- **RAM**: 1GB+
- **Storage**: 5GB+ SSD
- **OS**: Linux (Ubuntu 20.04+)

### Performance Benchmarks

#### Concurrent Users
- **1GB RAM**: ~100 concurrent users
- **2GB RAM**: ~250 concurrent users
- **4GB RAM**: ~500+ concurrent users

#### Database Size
- **Per Profile**: ~100KB
- **Per Avatar**: ~50KB
- **Base Installation**: ~50MB

#### Network Usage
- **Per Active User**: ~1GB/month
- **API Calls**: ~100KB per 1000 calls
- **Static Assets**: ~10MB per session

### Supported Platforms

#### Browsers
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

#### Mobile
- ✅ iOS 13+
- ✅ Android 5.0+ (API 21+)
- ✅ PWA compatible browsers

#### Servers
- ✅ Linux (Ubuntu, Debian, CentOS)
- ✅ macOS 10.15+
- ✅ Windows 10+
- ✅ Docker (any platform)

## 🔄 Version Compatibility

### Current Version: 1.0.0

#### Supported Features
- ✅ Multiple profiles
- ✅ Theme support
- ✅ Avatar upload
- ✅ Mobile apps
- ✅ API access
- ✅ Self-hosting

#### Upcoming Features
- 🔄 Downloads manager
- 🔄 NSFW filter
- 🔄 Advanced analytics
- 🔄 Plugin system

### Migration Guides

#### From 0.x to 1.0
- Database schema changes
- Configuration updates
- API modifications
- [Migration Guide](changelog.md#migration-from-0x-to-10)

## 🆘 Getting Help

### Documentation Issues
- **Typos/Errors**: [Edit on GitHub](https://github.com/MichielEijpe/Zentrio/edit/main/docs/)
- **Missing Information**: [Request documentation](https://github.com/MichielEijpe/Zentrio/issues)
- **Structure Feedback**: [Start a discussion](https://github.com/MichielEijpe/Zentrio/discussions)

### Technical Support
- **Configuration Issues**: [GitHub Issues](https://github.com/MichielEijpe/Zentrio/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/MichielEijpe/Zentrio/discussions)
- **Security Issues**: [Private Report](mailto:security@zentrio.eu)

### Community Resources
- **Discord Server**: [Join our community](https://discord.gg/zentrio)
- **Reddit**: r/Zentrio
- **Twitter**: @ZentrioApp

---

Looking for something specific? Check our [Configuration Reference](configuration.md) for detailed options or [Environment Variables](environment.md) for all available settings.