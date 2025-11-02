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
<summary><font size="+7"><b>Disclaimer: Built with AI</b></font></summary>

Zentrio was built with substantial assistance from AI tooling, guided by an engineering student exploring what these tools make possible.

Although the project is maintained with care, it remains experimental and may contain imperfections. **Please use it at your own risk**, and consider using unique credentials instead of your primary Stremio account for additional safety.
</details>

## About Zentrio

Zentrio started as a weekend project to solve [this community issue](https://github.com/Stremio/stremio-features/issues/622) regarding Stremio profiles, but it's grown into something bigger. Not only does Zentrio create a seperate space but its also bundled with a lot of QoL features that hope to make the already awesome Stremio experience even better!

<div align="center">
  <img src="app/src/static/media/profiles.png" alt="Zentrio Profiles" width="800" />
</div>

## Features

-   Profiles: create profiles with unique stremio credentials
-   Additional Features/Plugins:
    - Addon order management
    - Hide calendar/addons button
    - NSFW Filter (Soon™)
    - Downloads manager (Soon™): The ability to download media and watch later
-   Installable PWA: Zentrio can be installed as a PWA

## How-to-use

<details>
<summary>Local installation (for development)</summary>

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

See the [`docker-compose.yml`](docker-compose.yml).

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
Zentrio is fairly straightforward to setup. It is recommened to atleast configure the AUTH_SECRET, ENCRYPTION_KEY and EMAIL environment variables. For a complete list of all variables, look below:

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
