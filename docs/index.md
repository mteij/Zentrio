---
layout: home
hero:
  name: Zentrio
  text: Profile management for Stremio Web
  tagline: Create multiple profiles, maintain individual watch history, and customize your streaming experience
  image:
    src: /icon-512.png
    alt: Zentrio
  actions:
    - theme: brand
      text: Try Public Instance
      link: https://zentrio.eu
    - theme: alt
      text: Get Started
      link: /getting-started/

features:
  - title: Multiple Profiles
    details: Create and manage multiple profiles with unique Stremio credentials, each with its own watch history and preferences.
  - title: Self-Hosting
    details: Deploy Zentrio on your own infrastructure for complete control over your data and privacy.
  - title: Mobile Support
    details: Native mobile apps for iOS and Android, bringing Zentrio's features to your devices.
  - title: Customizable
    details: Personalize your experience with themes, addon management, and UI customization options.
  - title: Privacy First
    details: No tracking or analytics. Your data stays private, especially when self-hosting.
  - title: Open Source
    details: Fully open-source with MIT license. Contribute and make it your own.
---

## Quick Start

### 🌐 Try the Public Instance
Experience Zentrio immediately without any setup:
- **No registration required**
- **Instant access**
- **All features enabled**

[**Try Zentrio Now** →](https://zentrio.eu)

### 🏠 Self-Host Your Instance
Deploy Zentrio on your own server:

```bash
# Clone the repository
git clone https://github.com/MichielEijpe/Zentrio.git
cd Zentrio

# Start with Docker
docker-compose up -d
```

[**Self-Hosting Guide** →](getting-started/self-hosting.md)

## What Can You Do With Zentrio?

### Profile Management
- **Unlimited Profiles**: Create as many profiles as you need
- **Individual History**: Each profile maintains its own watch history
- **Unique Credentials**: Separate Stremio authentication for each profile
- **Custom Settings**: Individual preferences and configurations

### Streaming Enhancement
- **Addon Management**: Organize and reorder your Stremio addons
- **UI Customization**: Hide/show interface elements
- **Theme Support**: Multiple built-in themes to choose from
- **Avatar Upload**: Personalize profiles with custom avatars

### Cross-Platform
- **Web Application**: Works on all modern browsers
- **Mobile Apps**: Native iOS and Android applications
- **PWA Support**: Install on your home screen for app-like experience
- **Responsive Design**: Optimized for all screen sizes

## Documentation

### User Guide
- [**Profiles**](user-guide/profiles.md) - Learn about profile management
- [**Settings**](user-guide/settings.md) - Configure your experience
- [**Themes**](user-guide/themes.md) - Customize the look and feel
- [**Troubleshooting**](user-guide/troubleshooting.md) - Solve common issues

### Deployment
- [**Docker Deployment**](deployment/docker.md) - Deploy with Docker
- [**Manual Installation**](deployment/manual.md) - Install from source
- [**Reverse Proxy**](deployment/reverse-proxy.md) - Nginx/Caddy configuration
- [**Production Guide**](deployment/production.md) - Production best practices

### Development
- [**API Reference**](api/endpoints.md) - REST API documentation
- [**Development Setup**](development/setup.md) - Start contributing
- [**Architecture**](development/architecture.md) - System design
- [**Mobile Development**](mobile/setup.md) - Build mobile apps

## Community & Support

- **GitHub Issues**: [Report bugs](https://github.com/MichielEijpe/Zentrio/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/MichielEijpe/Zentrio/discussions)
- **Discord Server**: [Join our community](https://discord.gg/zentrio)

## License

MIT License - [View on GitHub](https://github.com/MichielEijpe/Zentrio/blob/main/LICENSE)