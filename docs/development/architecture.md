# Architecture

This is the short version of the repository architecture. For the AI instruction entrypoint, read [`llm/README.md`](https://github.com/Mteij/Zentrio/blob/main/llm/README.md). For the deep internal reference, read [`llm/reference/architecture-full.md`](https://github.com/Mteij/Zentrio/blob/main/llm/reference/architecture-full.md).

## Runtime Contexts

Zentrio has three real execution contexts:

| Context | Entry point | Purpose |
| --- | --- | --- |
| Server | `app/src/index.ts` | API, auth, background work, SPA serving |
| Client | `app/src/main.tsx` | React app in the browser or Tauri WebView |
| Native | `app/src-tauri/src/lib.rs` | Tauri commands, OS integration, downloads, plugins |

Keep those boundaries intact. Server code should not depend on browser globals, client code should not import Bun-only modules, and native behavior belongs in the Tauri layer.

## Core Boundaries

- First-party state stays on the backend.
- Third-party addon fetching is client-first.
- Internal API calls should use `apiFetch` helpers.
- Addon URLs should go through `addon-client.ts` or `addon-fetch.ts`.
- Database schema and queries belong in `app/src/services/database/`.
- Platform detection belongs in `app/src/lib/app-target.ts` and `app/src/lib/platform-capabilities.ts`.

## Where Code Usually Goes

| Change | Place |
| --- | --- |
| New API behavior | `app/src/routes/api/` plus `app/src/services/` |
| Shared client helper | `app/src/lib/` |
| Route screen | `app/src/pages/` |
| Reusable UI | `app/src/components/` |
| Native capability | `app/src-tauri/src/` |
| Public docs | `docs/` |

## Important Files

| Path | Why it matters |
| --- | --- |
| `app/src/index.ts` | Bun server bootstrap |
| `app/src/App.tsx` | Client route tree and top-level orchestration |
| `app/src/routes/api/index.ts` | API router mount point |
| `app/src/lib/apiFetch.ts` | Canonical internal API transport |
| `app/src/lib/addon-fetch.ts` | Canonical addon fetch layer |
| `app/src/lib/stream-resolver.ts` | Client-side stream resolution |
| `app/src-tauri/src/lib.rs` | Native entry point |

## Practical Rules

- Keep route handlers thin.
- Move reusable business logic into services.
- Do not call raw `fetch('/api/...')` from components.
- Do not import server-only modules into client code.
- Do not spread TV- or platform-specific checks through random components.
