# Zentrio

<div align="center">
  <img src="app/src/static/logo/icon-512.png" alt="Zentrio Icon" width="256" height="256" />

  <strong>Profile management for Stremio Web</strong>

  <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="https://hono.dev/"><img src="https://img.shields.io/badge/Hono-FF6A00?style=for-the-badge&logo=hono&logoColor=white" alt="Hono"></a>
  <a href="https://www.sqlite.org/"><img src="https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite"></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"></a>

  <a href="https://zentrio.eu"><strong>Visit Zentrio.eu</strong></a> •
  <a href="https://github.com/MichielEijpe/Zentrio/issues"><strong>Report Issues</strong></a>
</div>

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

## How-to-use

<details>
<summary>Local installation</summary>

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
</details>

### Docker
Option A: Docker Compose (recommended)

```bash
docker-compose up -d
```

Option B: Docker Run

```bash
docker run -d \
    -p 3000:3000 \
    --env-file .env \
    ghcr.io/michieleijpe/zentrio:latest
```
## Configuration

<details>
<summary>Environment Variables</summary>

| Variable | Description | Default |
|---|---|---|
| DATABASE\_URL | URL for the SQLite database. | ./data/zentrio.db |
| AUTH\_SECRET | Secret key for authentication.  | your-super-secret-auth-key-change-this-in-production |
| ENCRYPTION\_KEY | Secret key for encryption. | your-super-secret-encryption-key-change-this-in-production |
| PORT | Port the server listens on. | 3000 |
| NODE\_ENV | Environment the server is running in. | production |
| APP\_URL | URL of the application. | http://localhost:3000 |
| EMAIL\_HOST | Hostname of the SMTP server. | smtp.gmail.com |
| EMAIL\_PORT | Port of the SMTP server. | 587 |
| EMAIL\_SECURE | Whether the SMTP connection is secure. | false |
| EMAIL\_USER | Username for the SMTP server. | your-email@gmail.com |
| EMAIL\_PASS | Password for the SMTP server. | your-app-password |
| EMAIL\_FROM | Email address to send emails from. | noreply@zentrio.app |
| RATE\_LIMIT\_WINDOW\_MS | Time window for rate limiting in milliseconds. | 900000 |
| RATE\_LIMIT\_LIMIT | Maximum number of requests per IP in the rate limiting window. | 100 |
| PROXY\_LOGS | Controls the request/proxy logger middleware. | true |
| STREMIO\_LOGS | Controls verbose logs for the /stremio route. | false |

</details>

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Trademark Notice

Zentrio is an independent project and is not affiliated with, endorsed by, or sponsored by Stremio. "Stremio" and associated trademarks are the property of their respective owners. Your use of this project must comply with Stremio's Terms of Service and all applicable laws.
