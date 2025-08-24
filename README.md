<h1 align="center"><img src="app/src/static/logo/icon-512.png" alt="Zentrio Icon" width="48" height="48" /> Zentrio</h1>
<p align="center"><strong>Profile management for Stremio Web</strong></p>

<p align="center">
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://hono.dev/"><img src="https://img.shields.io/badge/Hono-FF6A00?style=for-the-badge&logo=hono&logoColor=white" alt="Hono"></a>
  <a href="https://www.sqlite.org/"><img src="https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite"></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"></a>
</p>

<p align="center">
  <a href="https://zentrio.eu"><strong>Visit Zentrio.eu</strong></a> •
  <a href="https://github.com/MichielEijpe/Zentrio/issues"><strong>Report Issues</strong></a>
</p>

---

## Features

- Profiles: create unlimited profiles with custom avatars
- Per-profile content settings (e.g., NSFW filtering)
- Addon order management
- Installable PWA
- Secure email flows (magic link and OTP)

---

## Quick start (local development)

Prerequisites:
- Bun 1.x (https://bun.sh)
- Git

Setup:
```bash
# Clone and configure environment
git clone https://github.com/MichielEijpe/Zentrio.git
cd Zentrio
cp .env.example .env
# Edit .env (see "Configuration" below)

# Install and run the app
cd app
bun install
bun run dev          # hot reload
# or: bun run src/index.ts
```

The app runs at:
- http://localhost:3000 (default; configurable via PORT)

Environment loading:
- The app reads .env from the repository root (one level above /app). Keep .env at project root for both dev and Docker.

---

## Docker

Option A: Compose (recommended)
```bash
docker-compose up -d
```
- Builds from ./app/Dockerfile
- Exposes port 3000 by default (override HOST_PORT and PORT if needed)
- Persists data in a named volume (SQLite at /data/zentrio.db by default)
- Includes a healthcheck

Option B: Standalone image
```bash
# Build
docker build -t ghcr.io/michieleijpe/zentrio:latest -f app/Dockerfile ./app

# Run
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  ghcr.io/michieleijpe/zentrio:latest
```

Notes:
- Default port is 3000. Override with PORT in .env or -e PORT=3000
- Default database is SQLite. docker-compose sets DATABASE_URL=sqlite:/data/zentrio.db and mounts a persistent volume
- A GitHub Actions workflow builds and pushes images to GHCR from ./app using app/Dockerfile

---

## Configuration

Create .env at the repository root (cp .env.example .env). Important keys:

- Core
  - PORT: default 3000
  - APP_URL: default http://localhost:PORT
  - NODE_ENV: set to production in Docker

- Security
  - AUTH_SECRET: required (random string)
  - ENCRYPTION_KEY: required (random string)

- Database
  - DATABASE_URL:
    - default fallback inside the app: sqlite://./zentrio.db (local file)
    - docker-compose default: sqlite:/data/zentrio.db (persistent volume)

- Email (SMTP via Nodemailer)
  - EMAIL_HOST (e.g., smtp.gmail.com)
  - EMAIL_PORT (e.g., 587)
  - EMAIL_SECURE (true for 465, false for STARTTLS/587)
  - EMAIL_USER, EMAIL_PASS
  - EMAIL_FROM (e.g., noreply@zentrio.app)

- Rate limiting
  - RATE_LIMIT_WINDOW_MS: default 900000 (15 minutes)
  - RATE_LIMIT_LIMIT: default 100

See .env.example for a complete list and defaults.

---

## Health

- GET /api/health: JSON status including basic env configuration
- Root page (/) serves the web UI

---

## Public instance

Try Zentrio at https://zentrio.eu

---

## Acknowledgments

- Stremio Team — streaming platform
- Bun team — fast JavaScript runtime
- Community contributors

Disclaimer: Zentrio is an independent project and is not affiliated with Stremio. Use unique credentials and consider creating new Stremio profiles when testing.

---

## License

MIT
