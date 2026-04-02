# Core Rules

## Purpose

This file contains repository-wide engineering rules that apply to nearly every task.

## Read This When

Read this before making code changes.

## Canonical Truth

- App commands run from `app/`
- The root `.env` file lives in the repository root, not `app/`
- Web, server, and native code are separate runtime contexts
- Prefer extending existing layers over inventing new ones

## Rules

- Use `llm/README.md` as the instruction entrypoint
- Keep route handlers thin and move reusable business logic into services
- Do not call raw `fetch('/api/...')` from components or hooks
- Do not import server-only modules into client code
- Do not create new logger abstractions
- Do not duplicate addon transport helpers
- Do not add database schema outside `app/src/services/database/`
- Do not create new Zustand stores unless existing stores are clearly insufficient
- Do not treat `/api/gateway` as a general-purpose proxy
- Do not turn every shared component into a TV-aware component
- Prefer target-specific shells and renderers over broad `isTv` branching
- Prefer clean in-place changes before introducing new files or layers

## Runtime Boundaries

- Server code must not depend on `window`, `document`, `localStorage`, or `import.meta.env`
- Client code must not import Bun-only modules such as `bun:sqlite`
- Native Rust owns Tauri commands, OS integration, downloads, and plugin registration

## See Also

- `llm/core/repo-map.md`
- `llm/domains/backend.md`
- `llm/domains/frontend.md`
- `llm/domains/native.md`
