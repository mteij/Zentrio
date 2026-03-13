# Zentrio — GitHub Copilot Instructions

**Before writing any code, read [`llm/ARCHITECTURE.md`](../llm/ARCHITECTURE.md).**
It maps every file and directory to its purpose and lists canonical patterns to follow.
If something you need already exists, it is listed there.

## Project Summary

Zentrio is a self-hosted streaming platform (Hono backend + React 19 frontend, Tauri v2 for Desktop/Mobile).
Runtime: Bun. All commands run from `app/`. The `.env` file lives in the **repo root**, not `app/`.

## Key Rules

- **Logging — server:** `import { logger } from '@/services/logger'` → `logger.scope('Name')`
- **Logging — client:** `import { createLogger } from '@/utils/client-logger'` → `createLogger('Name')`
- **Never** use `console.log/warn/error` directly.
- **API calls from client:** use `apiFetch` from `@/lib/apiFetch` or typed clients from `@/lib/adminApi`. Never raw `fetch`.
- **Server state:** TanStack Query (`useQuery`/`useMutation`). Never `useState + useEffect` for fetching.
- **Global state:** Zustand stores in `src/stores/`. Check existing stores before creating new ones.
- **Schema changes:** table definitions go in `src/services/database/connection.ts` only; new columns go through `src/services/database/migrations.ts`.
- **Do not create utility files for one-off operations.** Inline the logic or extend an existing utility.
- **Do not add comments explaining what the code does.** Only comment *why* when non-obvious.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Hono, bun:sqlite, Better Auth |
| Frontend | React 19, React Router v7, TanStack Query, Zustand, Tailwind v4 |
| Native | Tauri v2 (Desktop + Android) |
| Tests | Vitest + happy-dom |
| Build | Vite (frontend), Bun (server bundle) |
