# Zentrio

<details>
<summary>Disclaimer: Zentrio's Story and AI Development</summary>

Zentrio is primarily an AI-coded project. Almost all of its codebase was generated with the assistance of AI models, demonstrating the potential of artificial intelligence in software development.

This project aims to provide profile management capabilities for Stremio Web, allowing users to create and manage multiple profiles with custom settings and avatars.

While in pre-alpha stage, Zentrio represents an innovative approach to building applications using AI tools for development.
</details>

## About Zentrio

Zentrio is a profile management tool for Stremio Web, allowing users to create and manage multiple profiles with custom settings and avatars.

## Features

-   Profiles: create unlimited profiles with custom avatars
-   Per-profile content settings (e.g., NSFW filtering)
-   Addon order management
-   Installable PWA
-   Secure email flows (magic link and OTP)

## Quick Start (Local Development)

<details>
<summary>Setup Instructions</summary>

Prerequisites:

-   Bun 1.x (https://bun.sh)
-   Git

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

-   http://localhost:3000 (default; configurable via PORT)

Environment loading:

-   The app reads .env from the repository root (one level above /app). Keep .env at project root for both dev and Docker.
</details>

## Docker

Option A: Compose (recommended)

```bash
docker-compose up -d
```

-   Builds from ./app/Dockerfile
-   Exposes port 3000 by default (override HOST_PORT and PORT if needed)
-   Persists data in a named volume (SQLite at /data/zentrio.db by default)
-   Includes a healthcheck

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

-   Default port is 3000. Override with PORT in .env or -e PORT=3000
-   Default database is SQLite. docker-compose sets DATABASE_URL=sqlite:/data/zentrio.db and mounts a persistent volume
-   A GitHub Actions workflow builds and pushes images to GHCR from ./app using app/Dockerfile

## Configuration

Create .env at the repository root (cp .env.example .env). Important keys:

-   Core
    -   PORT: default 3000
    -   APP\_URL: default http://localhost:PORT
    -   NODE\_ENV: set to production in Docker
-   Security
    -   AUTH\_SECRET: required (random string)
    -   ENCRYPTION\_KEY: required (random string)
-   Database
    -   DATABASE\_URL:
        -   default fallback inside the app: sqlite://./zentrio.db (local file)
        -   docker-compose default: sqlite:/data/zentrio.db (persistent volume)
-   Email (SMTP via Nodemailer)
    -   EMAIL\_HOST (e.g., smtp.gmail.com)
    -   EMAIL\_PORT (e.g., 587)
    -   EMAIL\_SECURE (true for 465, false for STARTTLS/587)
    -   EMAIL\_USER, EMAIL\_PASS
    -   EMAIL\_FROM (e.g., noreply@zentrio.app)
-   Rate limiting
    -   RATE\_LIMIT\_WINDOW\_MS: default 900000 (15 minutes)
    -   RATE\_LIMIT\_LIMIT: default 100

See .env.example for a complete list and defaults.

## Health

-   GET /api/health: JSON status including basic env configuration
-   Root page (/) serves the web UI

## Public Instance

Try Zentrio at https://zentrio.eu

## Acknowledgments

-   Stremio Team — streaming platform
-   Bun team — fast JavaScript runtime
-   Community contributors

Disclaimer: Zentrio is an independent project and is not affiliated with Stremio. Use unique credentials and consider creating new Stremio profiles when testing.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Trademark Notice

Zentrio is an independent project and is not affiliated with, endorsed by, or sponsored by Stremio. "Stremio" and associated trademarks are the property of their respective owners. Your use of this project must comply with Stremio's Terms of Service and all applicable laws.
