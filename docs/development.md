# Development

Zentrio is a monorepo with three main surfaces:

- `app/`: the product codebase
- `docs/`: the VitePress docs site
- `landing/`: the marketing website

If you are working on the actual app, you will spend nearly all of your time in `app/`.

## Stack

- Frontend: React 19, React Router 7, TanStack Query, Zustand, Vite
- Backend: Bun, Hono, SQLite, Better Auth
- Native shell: Tauri v2 with Rust
- Tooling: TypeScript, Vitest, ESLint, Knip

## Architecture Overview

Zentrio has three runtime contexts:

| Context | Entry point | Notes |
| --- | --- | --- |
| Bun server | `app/src/index.ts` | Serves the API and the SPA |
| Client app | `app/src/main.tsx` | Runs in the browser or Tauri WebView |
| Native shell | `app/src-tauri/src/lib.rs` | Owns Tauri plugins, commands, and downloads |

Current streaming split:

- first-party app state stays on the backend
- third-party addon requests increasingly happen on the client
- native clients can also use a local gateway for selected remote read routes
- the older server-side SSE stream endpoint still exists for compatibility

For the full repository map, read `llm/ARCHITECTURE.md`.

## Local Setup

### Prerequisites

- [Bun](https://bun.sh)
- Optional native tooling if you want to run Tauri:
  - [Rust](https://rustup.rs)
  - Android Studio for Android builds
  - Xcode for iOS-related work

### Install dependencies

From `app/`:

```bash
bun install
```

From `docs/` if you want to work on the docs site:

```bash
bun install
```

### Environment

Copy `.env.example` to `.env` in the repository root:

```bash
cp .env.example .env
```

Minimum useful local config:

```txt
AUTH_SECRET=dev-secret
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
TMDB_API_KEY=your-tmdb-api-key
DATABASE_URL=./data/zentrio.db
APP_URL=http://localhost:3000
CLIENT_URL=http://localhost:5173
```

## Running the Web App

Run these from `app/` in separate terminals.

### Frontend

```bash
bun run dev
```

Vite serves the frontend on `http://localhost:5173`.

### Backend

```bash
bun run dev:server
```

The Bun/Hono server listens on `http://localhost:3000`.

In development, the frontend talks to the backend through Vite/dev routing and the shared root `.env`.

## Running Native Builds

From `app/`:

### Desktop

```bash
bun run tauri:dev
```

### Android

```bash
bun run tauri:android:init
bun run tauri:android:dev
```

Notes:

- the app has active Android support
- iOS artifacts exist in the repo, but support is not the primary active path right now
- native downloads and some deep-link flows are only visible in Tauri builds

## Useful Commands

From `app/`:

```bash
bun run type-check
bun run test
bun run lint
bun run knip
bun run build
```

From `docs/`:

```bash
bun run dev
bun run build
```

## Working Conventions

- Keep route handlers thin and move reusable logic into `app/src/services/`.
- Use `apiFetch` for internal API calls from client code.
- Use `addon-client.ts` and `addon-fetch.ts` for third-party addon URLs.
- Do not import Bun-only modules into client code.
- Prefer existing hooks, stores, and UI primitives before creating new ones.
- Keep schema changes inside the database layer and migrations.

## Important Files

| Path | Why it matters |
| --- | --- |
| `app/src/index.ts` | Bun server bootstrap |
| `app/src/App.tsx` | Main client route tree and app orchestration |
| `app/src/routes/api/index.ts` | API mount point |
| `app/src/routes/api/streaming.ts` | Streaming dashboard, metadata, progress, and IntroDB endpoints |
| `app/src/lib/stream-resolver.ts` | Client-side progressive stream resolution |
| `app/src/routes/api/gateway.ts` | Local-only remote read gateway for native connected mode |
| `app/src-tauri/src/lib.rs` | Native entry point and command registration |
| `app/src-tauri/src/downloads/` | Native download engine |

## Docs and Landing Site

Other workspaces in the repo:

- `docs/` is the product documentation site.
- `landing/` is the separate marketing/release website.

Those are intentionally separate from the main app and may have different dependencies and build pipelines.
