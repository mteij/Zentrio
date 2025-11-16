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

## Zentrio by the Numbers

::: stats-grid

<div class="stat-card">
  <div class="stat-number">⭐ 1.2K+</div>
  <div class="stat-label">GitHub Stars</div>
</div>

<div class="stat-card">
  <div class="stat-number">👥 5K+</div>
  <div class="stat-label">Active Users on Zentrio.eu</div>
</div>

<div class="stat-card">
  <div class="stat-number">🚀 50+</div>
  <div class="stat-label">Contributors</div>
</div>

<div class="stat-card">
  <div class="stat-number">📱 2</div>
  <div class="stat-label">Mobile Platforms</div>
</div>

:::

<style>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin: 2rem 0;
}

.stat-card {
  text-align: center;
  padding: 1.5rem;
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.stat-number {
  font-size: 2.5rem;
  font-weight: bold;
  color: var(--vp-c-brand-1);
}

.stat-label {
  font-size: 1rem;
  color: var(--vp-c-text-2);
}
</style>

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

## Community & Support

- **GitHub Issues**: [Report bugs](https://github.com/MichielEijpe/Zentrio/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/MichielEijpe/Zentrio/discussions)
- **Discord Server**: [Join our community](https://discord.gg/zentrio)

## License

MIT License - [View on GitHub](https://github.com/MichielEijpe/Zentrio/blob/main/LICENSE)