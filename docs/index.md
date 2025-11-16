---
layout: default
title: Home
---

# Zentrio Documentation

<div align="center">
  <img src="../app/src/static/logo/icon-512.png" alt="Zentrio Icon" width="256" height="256" />

  <strong>Profile management for Stremio Web</strong>

  <a href="https://zentrio.eu"><strong>Visit Zentrio.eu</strong></a> •
  <a href="https://github.com/MichielEijpe/Zentrio/issues"><strong>Report Issues</strong></a>
</div>

## Welcome to Zentrio Documentation

Zentrio is a profile management system for Stremio Web that provides a separate space with additional quality-of-life features.

## Quick Start

### Local Development

```bash
# Clone and configure environment
git clone https://github.com/MichielEijpe/Zentrio.git
cd Zentrio
cp .env.example .env
# Edit .env with your configuration

# Install and run the app
cd app
bun install
bun run dev
```

### Docker Setup

```bash
docker-compose up -d
```

## Documentation

- [Android Development Setup](ANDROID_SETUP.md)
- [Capacitor Integration](CAPACITOR.md)
- [Quick Start Android](QUICK_START_ANDROID.md)

## Features

- **Profiles**: Create profiles with unique Stremio credentials
- **Cross-platform support**: Web, iOS, Android, and PWA
- **Additional Features**:
  - Addon order management
  - Hide calendar/addons button
  - NSFW Filter (coming soon)
  - Downloads manager (coming soon)

## Configuration

Zentrio requires minimal configuration. The most important environment variables are:

- `AUTH_SECRET`: Secret key for authentication
- `ENCRYPTION_KEY`: Secret key for encryption
- EMAIL settings: For sending authentication emails

See the main [README.md](../README.md) for a complete list of configuration options.

## License

This project is licensed under the MIT License. See [LICENSE](../LICENSE) for details.