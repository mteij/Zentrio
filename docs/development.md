# Development

This page is a short guide for working on Zentrio itself.

## 1. Prerequisites

- Git
- Bun **or** Node.js 18+
- Docker (optional, for running the full stack)

Recommended: VS Code with TypeScript support and formatter extensions.

## 2. Getting the code running

```bash
git clone https://github.com/mteij/Zentrio.git
cd Zentrio/app

# Install dependencies
bun install

# Start dev server
bun run dev
```

The app will be available at `http://localhost:3000`.

If you prefer npm:

```bash
npm install
npm run dev
```

## 3. Project structure (app)

A simplified view of the main app:

```text
app/
  src/
    components/   # Reusable UI components
    pages/        # Main pages (landing, settings, profiles, etc.)
    routes/       # API and view routes
    services/     # Business logic (database, email, Stremio integration)
    middleware/   # Security, logging, sessions
    static/       # JS, CSS, icons, manifest
    themes/       # Theme JSON files
  android/        # Android project (Capacitor)
  ios/            # iOS project (Capacitor)
  capacitor.config.ts
```

## 4. Useful scripts

Run from the `app` directory:

```bash
bun run dev        # Start dev server
bun run build      # Build for production
bun run start      # Run built app
bun run lint       # Lint code
bun run type-check # TypeScript type checking
```

Capacitor / mobile helpers (if configured):

```bash
bun run cap:sync        # Sync web assets to native projects
bun run cap:open:android
bun run cap:open:ios
bun run cap:run:android
bun run cap:run:ios
```

## 5. Environment for development

For local development you can usually start with:

```bash
cp .env.example .env
```

Then adjust values like:

- `AUTH_SECRET`, `ENCRYPTION_KEY`
- `DATABASE_URL` (for example `./data/zentrio-dev.db`)
- `APP_URL` (for example `http://localhost:3000`)

See [Environment variables](/environment) for all options.

## 6. Contributing

- Open issues and feature requests on GitHub.
- Keep changes small and focused.
- Run lint and type‑check before opening a pull request.

Repository: `https://github.com/mteij/Zentrio`