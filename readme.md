<div align="center">
  <img src="app/public/static/logo/icon-512.png" alt="Zentrio logo" width="120" height="120" />

  <h1>Zentrio</h1>

  <p><strong>Stream anything. Own everything.</strong></p>

  <p>
    Web, desktop, and Android clients with profiles, Stremio-compatible addons,
    Trakt sync, and offline-capable native apps.
  </p>

  <p>
    <a href="https://zentrio.eu"><strong>Website</strong></a> |
    <a href="https://zentrio.eu/web"><strong>Try Zentrio Web</strong></a> |
    <a href="https://zentrio.eu/releases"><strong>Downloads</strong></a> |
    <a href="https://docs.zentrio.eu"><strong>Docs</strong></a> |
    <a href="https://github.com/Mteij/Zentrio/issues"><strong>Issues</strong></a>
  </p>

  <p>
    <a href="https://github.com/MichielEijpe/Zentrio/actions/workflows/quality.yml"><img src="https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/mteij/92598bd8ebd40beb60c71b870c3933d7/raw/zentrio-quality-badge.json&style=flat-square" alt="Code Quality"></a>
    <a href="https://github.com/Mteij/Zentrio/stargazers"><img src="https://img.shields.io/github/stars/mteij/Zentrio?style=flat-square&color=E50914&labelColor=1a1a1a" alt="Stars"></a>
    <a href="https://github.com/Mteij/Zentrio/releases"><img src="https://img.shields.io/github/downloads/mteij/Zentrio/total?style=flat-square&color=E50914&labelColor=1a1a1a" alt="Downloads"></a>
    <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-000000?style=flat-square&logo=bun&logoColor=white" alt="Bun"></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript"></a>
    <a href="https://tauri.app/"><img src="https://img.shields.io/badge/Tauri-FFC131?style=flat-square&logo=tauri&logoColor=black" alt="Tauri"></a>
  </p>
</div>

## Overview

Zentrio is an open-source, self-hosted streaming platform for people who want more control than a hosted service gives them, without settling for a clunky setup.

It brings the main pieces together in one project: a web app, native clients, user profiles, addon support, Trakt integration, and self-hosted deployment.

If you want the full walkthrough, self-hosting guide, or contributor docs, start at [docs.zentrio.eu](https://docs.zentrio.eu). If you want to try it first or grab builds, head to [zentrio.eu](https://zentrio.eu).

![Zentrio app screenshot](landing/public/app-screenshot-1000.png)

## Why People Use Zentrio

- It is self-hosted and open source, so you keep control of your server, data, and integrations.
- It supports multiple profiles, making it a better fit for households and shared setups.
- It works with Stremio-compatible addons, including a built-in TMDB addon.
- It is available on the web and as native desktop and Android apps.
- It is designed to feel like a product people actually want to use, not just a backend with a UI attached.

## What To Expect

- Zentrio is for people who are comfortable running their own setup or want to learn.
- It is usable today, but it is still an actively evolving project.
- It is not the best fit if you want a fully managed, zero-maintenance service.

If that sounds right, you can try the hosted experience at [zentrio.eu/web](https://zentrio.eu/web) or self-host your own instance.

## Quick Start

1. Copy `.env.example` to `.env`.

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

2. Set the required values:

```env
AUTH_SECRET=replace-me
ENCRYPTION_KEY=replace-me
TMDB_API_KEY=your-tmdb-api-key
```

3. Start Zentrio and open `http://localhost:3000`.

```bash
docker compose up -d
```

If you want to protect the first superadmin claim, set `ADMIN_SETUP_TOKEN` before the first sign-in.

For production setup, reverse proxy guidance, environment options, SSO, and operations, use [docs.zentrio.eu](https://docs.zentrio.eu).

## Native Apps

Release builds are available at [zentrio.eu/releases](https://zentrio.eu/releases) and on [GitHub Releases](https://github.com/Mteij/Zentrio/releases).

For Android TV and Fire TV, use the [Downloader app by AFTVnews](https://www.aftvnews.com/downloader/) with code `3250288`, or open `https://zentrio.eu/download/android`.

## Local Development

For local setup, architecture, and contribution workflow, use [docs.zentrio.eu](https://docs.zentrio.eu). The repository is a monorepo with `app/`, `docs/`, and `landing/` workspaces, but the docs are the best place to start if you want to run or modify Zentrio locally.

## Contributing

Contributions are welcome. Keep changes focused, run the relevant checks, and update docs when behavior or setup changes. The contributor guide lives in [docs.zentrio.eu](https://docs.zentrio.eu) and in [`docs/contributing.md`](docs/contributing.md).

## Legal Note

The legal pages on `zentrio.eu` apply to the official hosted service operated by the project maintainers. If you run your own instance for other people, you may need your own terms, privacy notice, and account-deletion process.

## AI Note

Zentrio is built and maintained with significant AI assistance. The project is actively developed and reviewed by humans, but AI has been used throughout implementation and documentation.

## Acknowledgements

- [tmdb-addon](https://github.com/mrcanelas/tmdb-addon) by mrcanelas
- [IntroDB](https://introdb.app) for intro, recap, and outro timestamps
- [Fanart.tv](https://fanart.tv) for artwork and logos
- [IMDb datasets](https://developer.imdb.com/non-commercial-datasets/) for ratings data
- [DiceBear](https://www.dicebear.com) for profile avatar generation
- [Better Auth](https://www.better-auth.com) for authentication

## Trademark Notice

Zentrio is an independent project. It supports Stremio-compatible addons but is not affiliated with, endorsed by, or sponsored by Stremio. "Stremio" and related marks belong to their respective owners.

## License

MIT. See [LICENSE](LICENSE).
