# Development

Set up Zentrio for local development.

## Prerequisites

- **Runtime**: [Bun](https://bun.sh) (recommended) or Node.js 18+
- **Database**: SQLite (included, no setup required)
- **Mobile**: [Android Studio](https://developer.android.com/studio) / [Xcode](https://developer.apple.com/xcode/) for mobile development

---

## Quick Start

```bash
git clone https://github.com/mteij/Zentrio.git
cd Zentrio/app
bun install
```

### Start Development Servers

You need to run both the frontend (Vite) and backend (Hono) servers:

```bash
# Terminal 1: Frontend (Vite dev server)
bun run dev

# Terminal 2: Backend (Hono API server)
bun run dev:server
```

The app will be available at `http://localhost:5173` (frontend) with API calls proxied to the backend.

---

## Available Commands

Run these from the `app` directory:

| Command              | Description                            |
| :------------------- | :------------------------------------- |
| `bun run dev`        | Start the Vite frontend dev server     |
| `bun run dev:server` | Start the Hono backend with hot reload |
| `bun run start`      | Run the production server              |
| `bun run build`      | Build for production (web + server)    |
| `bun run type-check` | Run TypeScript type checking           |

---

## Desktop Development (Tauri)

Zentrio uses [Tauri](https://tauri.app) for desktop builds.

```bash
# Start desktop development
bun run tauri dev
```

This launches the app in a native window with hot reloading.

---

## Mobile Development

### Android

Requires Android Studio with SDK installed.

```bash
# Initialize Android project (first time only)
bun run tauri:android:init

# Start Android development
bun run tauri:android:dev
```

### iOS

Requires Xcode and macOS.

```bash
# Initialize iOS project (first time only)
bun run tauri ios init

# Start iOS development
bun run tauri ios dev
```

---

## Project Structure

```
Zentrio/
├── app/                    # Main application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Route pages
│   │   ├── services/      # Business logic (addons, tmdb, etc.)
│   │   ├── routes/        # API routes (Hono)
│   │   └── index.ts       # Backend entry point
│   ├── src-tauri/         # Tauri configuration
│   └── public/            # Static assets
├── docs/                   # Documentation (VitePress)
└── landing/               # Landing page
```

---

## Environment Variables

Create a `.env` file in the `app` directory for local development:

```bash
AUTH_SECRET=dev-secret-change-in-production
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
DATABASE_URL=file:./data/zentrio.db
```

See [Self-Hosting](/self-hosting) for full configuration options.
