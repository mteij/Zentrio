# Local Setup

## Prerequisites

- [Bun](https://bun.sh)
- Optional native tooling if you want to run Tauri:
  - [Rust](https://rustup.rs)
  - Android Studio for Android builds
  - Xcode for iOS-related work

## Install Dependencies

From `app/`:

```bash
bun install
```

From `docs/` if you want to work on the docs site:

```bash
bun install
```

## Environment

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

The shared `.env` file lives in the repository root, not inside `app/`.

## Run The Web App

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

The Bun server listens on `http://localhost:3000`.

## Run Native Builds

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
