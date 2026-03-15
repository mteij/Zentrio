# Zentrio

<div align="center">
  <img src="app/public/static/logo/icon-512.png" alt="Zentrio" width="128" height="128" />

  <h3>Stream anything. Own everything.</h3>

  <p>
    <a href="https://zentrio.eu"><strong>Website</strong></a> |
    <a href="https://app.zentrio.eu"><strong>Live Demo</strong></a> |
    <a href="https://zentrio.eu/releases"><strong>Download</strong></a> |
    <a href="https://docs.zentrio.eu"><strong>Docs</strong></a> |
    <a href="https://github.com/Mteij/Zentrio/issues"><strong>Issues</strong></a>
  </p>

  <p>
    <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun"></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
    <a href="https://hono.dev/"><img src="https://img.shields.io/badge/Hono-FF6A00?style=for-the-badge&logo=hono&logoColor=white" alt="Hono"></a>
    <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-FFC131?style=for-the-badge&logo=tauri&logoColor=black" alt="Tauri"></a>
    <a href="https://www.sqlite.org/"><img src="https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite"></a>
    <a href="https://github.com/MichielEijpe/Zentrio/actions/workflows/quality.yml"><img src="https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/mteij/92598bd8ebd40beb60c71b870c3933d7/raw/zentrio-quality-badge.json&style=for-the-badge" alt="Code Quality"></a>
  </p>

  <img src="landing/public/app-screenshot-1000.png" alt="Zentrio App Screenshot" width="800" style="border-radius: 8px; margin-top: 16px;" />
</div>

<br />

<details>
<summary>A note on how this project was built</summary>

Zentrio was developed with significant AI assistance. Much of the code, architecture, and documentation was written or shaped with the help of large language models. The project is functional and actively maintained, but this context is worth knowing if you're evaluating it for production use.

</details>

> **Not ready to self-host?** Try the [public instance](https://app.zentrio.eu) first — no setup required.

---

## Why Zentrio?

**Multi-profile by design.** Watch history, streaming preferences, and appearance are all per-profile. Switch in one click — ideal for households or shared servers.

**Stremio-compatible addon ecosystem.** Install any Stremio-compatible addon by URL, reorder sources, and mix the built-in TMDB addon with third-party manifests.

**Native apps for desktop and mobile.** Zentrio ships as a Tauri app for Windows, macOS, Linux, and Android — with native auth flows, local-first reads, and offline downloads.

**Your data, your server.** One `.env`, SQLite, and a single `docker compose up`. No external databases, no cloud dependencies, no account required to self-host.

---

## Quick Start

The fastest way to run Zentrio is with Docker Compose.

**1. Copy the example env file:**
```bash
cp .env.example .env
```

**2. Fill in the required values:**
```env
AUTH_SECRET=replace-me
ENCRYPTION_KEY=replace-me          # 64 hex characters
TMDB_API_KEY=your-tmdb-api-key
```

**3. Start:**
```bash
docker compose up -d
```

Zentrio will be available at `http://localhost:3000`. The first user to register can claim the superadmin role via `BOOTSTRAP_ADMIN_TOKEN` in the env file.

> Full setup guide: [docs/self-hosting.md](docs/self-hosting.md)

---

## Download

Native desktop and mobile apps are available from the releases page.

**[→ zentrio.eu/releases](https://zentrio.eu/releases)** — Windows, macOS, Linux, Android

Or grab the latest from [GitHub Releases](https://github.com/Mteij/Zentrio/releases).

---

## Features

| Feature | Details |
|---|---|
| **Profiles** | Separate history, filters, settings, and appearance per profile |
| **Stremio Addons** | Install by URL, reorder sources, built-in TMDB addon included |
| **Native Apps** | Desktop (Win/Mac/Linux) and Android via Tauri v2 |
| **Offline Downloads** | Queue downloads on native clients with storage stats and quotas |
| **Trakt Integration** | Sync, scrobbling, recommendations, and check-ins |
| **Flexible Auth** | Email/password, magic links, OTP, 2FA, SSO (Google, GitHub, Discord, OIDC) |
| **Admin Dashboard** | Audit logs, platform analytics, user management, step-up verification |
| **API-first** | Full OpenAPI spec at `/api/docs`, Stremio-compatible addon endpoints |

---

## Local Development

```bash
cd app
bun install
```

Run both servers concurrently in separate terminals:

```bash
# Terminal 1 — Frontend (Vite at http://localhost:5173)
bun run dev

# Terminal 2 — Backend (Hono at http://localhost:3000)
bun run dev:server
```

Other useful commands:

```bash
bun run type-check   # TypeScript check
bun run test         # Run tests
bun run lint         # ESLint
bun run tauri:dev    # Desktop app
```

The `.env` file lives in the **repository root** (not `app/`). See `.env.example` for all options.

---

## Architecture

- **Frontend:** React 19 + React Router v7 + TanStack Query + Zustand
- **Backend:** Bun + Hono + SQLite (schema-first, no migration files)
- **Native:** Tauri v2 + Rust sidecar model
- **Auth:** Better Auth with email, magic link, OTP, 2FA, and SSO plugins

Full contributor map: [llm/ARCHITECTURE.md](llm/ARCHITECTURE.md)

---

## Contributing

Contributions are welcome. Please open an issue before starting significant work so we can discuss direction. See [docs/contributing.md](docs/contributing.md) for guidelines.

---

## Acknowledgements

- [tmdb-addon](https://github.com/mrcanelas/tmdb-addon) by mrcanelas — Zentrio's internal TMDB addon is substantially derived from this project (Apache 2.0 attributed in source).
- [IntroDB](https://introdb.app) — intro, recap, and outro timestamps.
- [Fanart.tv](https://fanart.tv) — artwork and logos.
- [IMDb datasets](https://developer.imdb.com/non-commercial-datasets/) — ratings data.
- [DiceBear](https://www.dicebear.com) — profile avatar generation.
- [Better Auth](https://www.better-auth.com) — authentication.

---

## Trademark Notice

Zentrio is an independent project. It supports Stremio-compatible addons but is not affiliated with, endorsed by, or sponsored by Stremio. "Stremio" and related marks belong to their respective owners.

## License

MIT — see [LICENSE](LICENSE).
