# ⚡ Quick Start Guides

Choose the quick start guide that matches your needs and get Zentrio running in minutes!

## 🎯 Choose Your User Type

### 👨‍👩‍👧‍👦 **Family User**
Multiple family members, different ages and preferences

### 👤 **Individual User**
Personal use, multiple content preferences

### 🔒 **Privacy-Conscious User**
Maximum data control and self-hosting

### 🧪 **Power User**
Advanced customization and development

---

## 👨‍👩‍👧‍👦 Family User Quick Start

Perfect for families who want separate profiles for each member.

### 🚀 5-Minute Setup

1. **🌐 Try Public Instance** (Recommended for families)
   - Visit [zentrio.eu](https://zentrio.eu)
   - No setup required
   - Safe for testing

2. **👥 Create Family Profiles**
   - Profile 1: "Kids" with age-appropriate settings
   - Profile 2: "Parents" with full access
   - Profile 3: "Teens" with intermediate restrictions

3. **🎨 Customize Each Profile**
   - Different themes for each age group
   - Appropriate addon configurations
   - Custom avatars for easy identification

### 📋 Family Setup Checklist

- [ ] Create profiles for each family member
- [ ] Set age-appropriate content filters
- [ ] Choose family-friendly themes
- [ ] Configure addon order for each profile
- [ ] Teach family members how to switch profiles
- [ ] Set up mobile access for all devices

### 💡 Family Pro Tips

- **Profile Names**: Use clear names like "Kids Movies", "Parents Only"
- **Themes**: Dark themes for evening viewing, light themes for daytime
- **Mobile**: Add to home screen for easy access
- **Rules**: Establish screen time rules per profile

---

## 👤 Individual User Quick Start

Perfect for personal use with different content preferences.

### 🚀 3-Minute Setup

1. **🌐 Start with Public Instance**
   - Visit [zentrio.eu](https://zentrio.eu)
   - Create your account in 30 seconds

2. **👤 Create Personal Profiles**
   - Profile 1: "Movies" - for film content
   - Profile 2: "Series" - for TV shows
   - Profile 3: "Documentaries" - for educational content

3. **⚙️ Personalize Experience**
   - Choose your preferred theme
   - Organize addons by usage frequency
   - Upload a personal avatar

### 📋 Individual Setup Checklist

- [ ] Create profiles for different content types
- [ ] Set up your preferred theme
- [ ] Organize addons for each profile
- [ ] Upload custom avatars
- [ ] Install PWA on mobile devices
- [ ] Configure quick profile switching

### 💡 Individual Pro Tips

- **Content Separation**: Keep movies and series separate for better recommendations
- **Addon Order**: Put most-used addons first
- **Theme Switching**: Use different themes for different viewing conditions
- **Mobile**: Use biometric authentication for quick access

---

## 🔒 Privacy-Conscious User Quick Start

Perfect for users who want maximum control over their data.

### 🚀 10-Minute Self-Hosting Setup

1. **🐳 Docker Setup** (Recommended)
   ```bash
   git clone https://github.com/MichielEijpe/Zentrio.git && cd Zentrio && \
   cp .env.example .env && \
   docker-compose up -d
   ```

2. **🔐 Secure Configuration**
   ```bash
   # Generate secure secrets
   openssl rand -base64 32  # For AUTH_SECRET
   openssl rand -hex 32     # For ENCRYPTION_KEY
   ```

3. **🌐 Reverse Proxy** (Optional but recommended)
   - Set up Nginx or Caddy
   - Configure SSL with Let's Encrypt
   - Enable firewall rules

### 📋 Privacy Setup Checklist

- [ ] Self-host on your own infrastructure
- [ ] Generate strong encryption keys
- [ ] Configure HTTPS with valid certificates
- [ ] Set up firewall rules
- [ ] Configure regular backups
- [ ] Test security settings

### 💡 Privacy Pro Tips

- **Network**: Use VPN for additional privacy
- **Backups**: Encrypt backups and store securely
- **Updates**: Keep Zentrio updated for security patches
- **Monitoring**: Set up log monitoring for suspicious activity

---

## 🧪 Power User Quick Start

Perfect for advanced users who want customization and development.

### 🚀 15-Minute Advanced Setup

1. **🔧 Development Environment**
   ```bash
   git clone https://github.com/MichielEijpe/Zentrio.git
   cd Zentrio/app
   bun install
   bun run dev
   ```

2. **🎨 Custom Theme Creation**
   - Copy existing theme from `src/themes/`
   - Modify colors and typography
   - Test theme changes in real-time

3. **🔌 Advanced Addon Configuration**
   - Create custom addon configurations
   - Set up advanced proxy rules
   - Configure performance optimizations

### 📋 Power User Setup Checklist

- [ ] Set up development environment
- [ ] Explore source code structure
- [ ] Create custom themes
- [ ] Configure advanced settings
- [ ] Set up monitoring and logging
- [ ] Contribute to the project

### 💡 Power User Pro Tips

- **Source Code**: Familiarize yourself with the architecture
- **Customization**: Create custom themes and share with community
- **Performance**: Monitor and optimize database performance
- **Contributing**: Submit pull requests for improvements

---

## 📱 Mobile Quick Start (All Users)

### 🚀 2-Minute Mobile Setup

1. **🌐 Visit Zentrio** on your mobile browser
2. **📱 Add to Home Screen**
   - iOS: Share → Add to Home Screen
   - Android: Menu → Add to Home Screen
3. **🎉 Enjoy App-Like Experience**

### 📋 Mobile Setup Checklist

- [ ] Add Zentrio to home screen
- [ ] Enable offline mode
- [ ] Test profile switching
- [ ] Configure biometric authentication
- [ ] Sync profiles across devices

---

## 🆘 Common Quick Start Issues

### ❌ **Can't Access Zentrio**
- **Solution**: Check internet connection, try different browser
- **Public Instance**: Visit [zentrio.eu](https://zentrio.eu) directly
- **Self-Hosted**: Check if Docker is running: `docker-compose ps`

### ❌ **Profile Not Saving**
- **Solution**: Clear browser cache and cookies
- **Check**: Ensure browser allows localStorage
- **Self-Hosted**: Check database permissions

### ❌ **Mobile App Not Working**
- **Solution**: Use supported browser (Chrome, Safari)
- **Check**: Ensure HTTPS connection
- **Alternative**: Use web interface in mobile browser

---

## 🎯 Next Steps After Quick Start

### 📚 **Learn More**
- [📖 Complete User Guide](../user-guide/) - Master all features
- [🎨 Theme Guide](../user-guide/themes.md) - Customize your experience
- [⚙️ Settings Guide](../user-guide/settings.md) - Advanced configuration

### 🛠️ **Advanced Setup**
- [🏠 Self-Hosting Guide](self-hosting.md) - Complete deployment instructions
- [🐳 Docker Deployment](../deployment/docker.md) - Production setup
- [🔧 Development Guide](../development/) - Contribute to Zentrio

### ❓ **Get Help**
- [❓ FAQ](../help/faq.md) - Find answers to common questions
- [🔧 Troubleshooting](../help/troubleshooting.md) - Solve common issues
- [💬 Community](https://github.com/MichielEijpe/Zentrio/discussions) - Ask questions

---

<div style="text-align: center; margin: 2rem 0;">

**🌟 Congratulations! You're ready to enhance your Stremio experience!**

<br>

[🚀 Try Zentrio Now](public-instance.md) &nbsp;&nbsp;|&nbsp;&nbsp; [📖 Learn More](../user-guide/) &nbsp;&nbsp;|&nbsp;&nbsp; [❓ Get Help](../help/faq.md)

</div>