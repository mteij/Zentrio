# Development

Work on Zentrio locally.

## Prerequisites

- **Runtime**: [Bun](https://bun.sh) (recommended) or Node.js 18+.
- **Database**: SQLite (built-in).

## Setup

```bash
git clone https://github.com/mteij/Zentrio.git
cd Zentrio/app
bun install
```

Start the development server:

```bash
bun run dev
```

The app will open at `http://localhost:3000`.

## Commands

Run these from the `app` directory:

| Command              | Description               |
| :------------------- | :------------------------ |
| `bun run dev`        | Start the dev server.     |
| `bun run build`      | Build for production.     |
| `bun run start`      | Run the production build. |
| `bun run lint`       | Run ESLint.               |
| `bun run type-check` | Run TypeScript checks.    |

## Mobile Development

Mobile apps are built with Tauri.

```bash
bun run tauri dev       # Desktop dev
bun run tauri android dev # Android dev
bun run tauri ios dev     # iOS dev
```
