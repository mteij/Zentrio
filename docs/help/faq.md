# ❓ Frequently Asked Questions

Find answers to common questions about Zentrio. Can't find what you're looking for? [Check our troubleshooting guide](troubleshooting.md) or [ask the community](https://github.com/MichielEijpe/Zentrio/discussions).

## 🚀 Getting Started

### What is Zentrio?
Zentrio is a profile management system for Stremio Web that allows you to:
- Create multiple profiles with unique Stremio credentials
- Maintain individual watch history and preferences for each profile
- Customize your streaming experience with themes and addon management
- Access enhanced features like avatar uploads and UI customization

### How do I try Zentrio?
You have two options:
- **🌐 Public Instance**: Visit [zentrio.eu](https://zentrio.eu) to try Zentrio instantly - no setup required
- **🏠 Self-Hosting**: Deploy Zentrio on your own infrastructure using our [5-minute setup guide](../getting-started/self-hosting.md)

### Is Zentrio free?
Yes! Zentrio is completely free and open-source. The public instance is free to use, and self-hosting costs nothing except your own infrastructure.

## 🔐 Privacy & Security

### Is my data safe?
Absolutely! Zentrio is privacy-first:
- **No tracking or analytics** - we don't collect any personal data
- **Encrypted storage** - your Stremio credentials are encrypted
- **Self-hosting option** - keep all data on your own infrastructure
- **Open source** - transparent code that anyone can audit

### What data does Zentrio store?
When self-hosting, Zentrio stores only:
- Profile names and settings
- Encrypted Stremio credentials
- Avatar images (if uploaded)
- Theme preferences

The public instance stores the same data but on our servers.

### Can I use my main Stremio account?
While you can, we recommend using a separate Stremio account for Zentrio, especially when trying the public instance. This adds an extra layer of privacy and security.

## 🏠 Self-Hosting

### What do I need to self-host Zentrio?
**Minimum requirements:**
- Docker and Docker Compose (recommended)
- Or Node.js 18+ / Bun runtime
- 512MB RAM and 1GB disk space
- Basic command line knowledge

### How long does self-hosting take?
With Docker: **5 minutes**
Without Docker: **10-15 minutes**

### Can I use Zentrio behind a reverse proxy?
Yes! Zentrio works perfectly behind Nginx, Caddy, Apache, or any other reverse proxy. See our [deployment guide](../deployment/) for configuration examples.

## 📱 Mobile Apps

### Are there official mobile apps?
Native iOS and Android apps are coming soon! In the meantime:
- **PWA**: Add zentrio.eu to your home screen for an app-like experience
- **Self-hosted**: Your self-hosted instance also works as a PWA

### Does Zentrio work offline?
Yes! Once loaded, Zentrio works offline for:
- Profile switching
- Settings changes
- Theme customization

You'll need an internet connection for:
- Initial authentication
- Streaming content through Stremio

## 👥 Profiles & Features

### How many profiles can I create?
Unlimited! Create as many profiles as you need for family members, different content preferences, or testing.

### Can I share profiles between devices?
Yes, profiles are stored in your Zentrio instance and accessible from any device that can reach your instance.

### What customization options are available?
- **Themes**: Multiple built-in themes (dark, light, midnight, etc.)
- **Addons**: Reorder and organize your Stremio addons
- **UI Elements**: Hide/show buttons and interface elements
- **Avatars**: Upload custom profile images

## 🔧 Technical

### What technology does Zentrio use?
- **Backend**: Bun + Hono framework
- **Frontend**: TypeScript + PWA
- **Database**: SQLite (embedded)
- **Mobile**: Capacitor for native apps
- **Deployment**: Docker support

### Can I contribute to Zentrio?
Absolutely! Zentrio is open-source and welcomes contributions. See our [development guide](../development/) for getting started.

### Is there an API?
Yes! Zentrio provides a REST API for integration. See our [API documentation](../api/) for details.

## 🆘 Troubleshooting

### Zentrio won't start
1. Check if port 3000 is available
2. Verify your `.env` file configuration
3. Check logs for error messages
4. Try our [troubleshooting guide](troubleshooting.md)

### I forgot my password
Zentrio uses magic link authentication - no passwords to remember! Just request a new magic link with your email.

### Profiles aren't saving
1. Check database file permissions
2. Verify disk space is available
3. Check your browser's local storage settings

### Mobile app issues
1. Clear browser cache and data
2. Ensure you're using a supported browser
3. Try accessing via the web interface

## 🌐 Community

### Where can I get help?
- **GitHub Discussions**: [Ask questions](https://github.com/MichielEijpe/Zentrio/discussions)
- **GitHub Issues**: [Report bugs](https://github.com/MichielEijpe/Zentrio/issues)
- **Documentation**: Browse these guides thoroughly

### How can I request features?
Feature requests are welcome! Please:
1. Check if someone already requested it
2. Add your use case and details
3. Vote on existing requests

---

Still have questions? [Check our troubleshooting guide](troubleshooting.md) or [ask the community](https://github.com/MichielEijpe/Zentrio/discussions).