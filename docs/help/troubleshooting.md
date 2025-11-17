# 🔧 Troubleshooting Guide

Having issues with Zentrio? This guide covers common problems and their solutions. If you don't find your issue here, [check our FAQ](faq.md) or [ask the community](https://github.com/MichielEijpe/Zentrio/discussions).

## 🚀 Installation & Setup Issues

### Port Already in Use
**Problem**: `Error: listen EADDRINUSE :::3000`

**Solutions**:
```bash
# Find what's using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill the process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Or use a different port
PORT=3001 bun run start
```

### Docker Build Fails
**Problem**: Docker build fails with dependency errors

**Solutions**:
```bash
# Clean and rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check Docker logs
docker-compose logs zentrio
```

### Permission Issues
**Problem**: Database or file permission errors

**Solutions**:
```bash
# Fix data directory permissions
sudo chown -R $USER:$USER ./data
chmod 755 ./data

# For Docker, ensure proper volume mapping
docker-compose down
docker-compose up -d
```

### Environment Variables Not Loading
**Problem**: Configuration not applied from `.env` file

**Solutions**:
1. Ensure `.env` file is in the correct location (project root)
2. Check file name: `.env` (not `env.txt` or `.env.txt`)
3. Verify no spaces around `=` signs
4. Restart the application after changes

## 🔐 Authentication Issues

### Magic Link Not Received
**Problem**: Email with magic link doesn't arrive

**Solutions**:
1. Check spam/junk folder
2. Verify email address is correct
3. Wait up to 5 minutes for delivery
4. Try requesting again (rate limited to 1 per minute)

### Magic Link Expired
**Problem**: "Token expired" error when clicking magic link

**Solutions**:
- Magic links expire after 15 minutes
- Request a new magic link
- Check your system clock is correct

### Authentication Fails
**Problem**: "Invalid token" or authentication errors

**Solutions**:
1. Clear browser cookies and localStorage
2. Try incognito/private browsing
3. Check if your instance URL changed (APP_URL)
4. Verify AUTH_SECRET is set correctly

## 👥 Profile Issues

### Profile Not Saving
**Problem**: Changes to profiles aren't saved

**Solutions**:
1. Check database file permissions
2. Verify disk space is available
3. Check browser console for errors
4. Try refreshing the page

### Profile Switching Fails
**Problem**: Can't switch between profiles

**Solutions**:
1. Refresh the page and try again
2. Clear browser cache
3. Check if profile still exists in database
4. Verify Stremio credentials are correct

### Avatar Upload Fails
**Problem**: Can't upload profile avatar

**Solutions**:
1. Check file size (max 5MB)
2. Ensure file is PNG/JPG/JPEG
3. Check internet connection
4. Try a different image

## 🌐 Network & Connectivity

### Can't Access Zentrio
**Problem**: "Connection refused" or timeout errors

**Solutions**:
```bash
# Check if Zentrio is running
curl http://localhost:3000/health

# Check logs for errors
docker-compose logs -f zentrio  # Docker
bun run start  # Direct run
```

### Reverse Proxy Issues
**Problem**: 502 Bad Gateway or proxy errors

**Nginx Configuration**:
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

**Caddy Configuration**:
```caddyfile
yourdomain.com {
    reverse_proxy localhost:3000
}
```

### CORS Errors
**Problem**: Cross-origin request blocked

**Solutions**:
1. Configure CORS_ORIGIN in `.env`
2. Ensure reverse proxy passes correct headers
3. Check browser console for specific error

## 📱 Mobile & PWA Issues

### PWA Won't Install
**Problem**: Can't "Add to Home Screen"

**Solutions**:
1. Use a supported browser (Chrome, Safari, Edge)
2. Ensure site is served over HTTPS
3. Check if service worker is registered
4. Clear browser cache and try again

### Mobile App Crashes
**Problem**: App crashes or won't open

**Solutions**:
1. Update to latest version
2. Clear app data and cache
3. Reinstall the app
4. Check device compatibility

### Offline Mode Not Working
**Problem**: PWA doesn't work offline

**Solutions**:
1. Ensure service worker is registered
2. Check browser supports service workers
3. Clear cache and reload
4. Verify site is accessed via HTTPS

## 🗄️ Database Issues

### Database Locked
**Problem**: "Database is locked" errors

**Solutions**:
```bash
# Check for running processes
ps aux | grep zentrio

# Wait for current operations to complete
# Or restart the service
docker-compose restart zentrio
```

### Database Corruption
**Problem**: Database file is corrupted

**Solutions**:
```bash
# Backup current database
cp data/zentrio.db data/zentrio.backup.db

# Try to recover
sqlite3 data/zentrio.db ".recover" | sqlite3 data/recovered.db

# If recovery fails, start fresh (loses data)
rm data/zentrio.db
# Restart Zentrio to create new database
```

### Database Size Issues
**Problem**: Database file is too large

**Solutions**:
```bash
# Check database size
du -h data/zentrio.db

# Vacuum database
sqlite3 data/zentrio.db "VACUUM;"

# Clean up old avatars (if applicable)
find data/ -name "*.old" -delete
```

## 🔧 Performance Issues

### Slow Loading
**Problem**: Zentrio loads slowly

**Solutions**:
1. Check server resources (CPU, RAM, disk)
2. Optimize SQLite with WAL mode
3. Enable compression in reverse proxy
4. Check network connectivity

### High Memory Usage
**Problem**: Zentrio uses too much memory

**Solutions**:
```bash
# Optimize Node.js memory
NODE_OPTIONS="--max-old-space-size=512" bun run start

# For Docker, add memory limits
docker-compose.yml:
services:
  zentrio:
    mem_limit: 512m
```

### Database Performance
**Problem**: Database operations are slow

**Solutions**:
```bash
# Use optimized SQLite URL
DATABASE_URL=./data/zentrio.db?cache=shared&mode=rwc&journal_mode=WAL

# Regular maintenance
sqlite3 data/zentrio.db "VACUUM; ANALYZE;"
```

## 📊 Debugging

### Enable Debug Logging
```bash
# Set log level to debug
LOG_LEVEL=debug

# Enable proxy logs
PROXY_LOGS=true
STREMIO_LOGS=true
```

### Check System Status
```bash
# Health check
curl http://localhost:3000/health

# System info
curl http://localhost:3000/api/system/info

# Database status
sqlite3 data/zentrio.db ".schema"
```

### Browser Debugging
1. Open Developer Tools (F12)
2. Check Console tab for errors
3. Network tab for failed requests
4. Application tab for localStorage issues

## 🆘 Getting Help

### Before Asking for Help
1. Check this troubleshooting guide
2. Search [existing issues](https://github.com/MichielEijpe/Zentrio/issues)
3. Check [FAQ](faq.md)
4. Gather relevant information:
   - Zentrio version
   - Installation method (Docker/manual)
   - Error messages
   - Steps to reproduce

### How to Report Issues
1. **GitHub Issues**: [Report bugs](https://github.com/MichielEijpe/Zentrio/issues)
2. **GitHub Discussions**: [Ask questions](https://github.com/MichielEijpe/Zentrio/discussions)
3. **Include**: Error logs, configuration, and steps to reproduce

### Community Support
- **Discussions**: General questions and help
- **Issues**: Bug reports and feature requests
- **Documentation**: Report documentation issues

---

Still having issues? [Check our FAQ](faq.md) or [ask the community](https://github.com/MichielEijpe/Zentrio/discussions).