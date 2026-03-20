# Development

Zentrio is a monorepo with three main workspaces:

- `app/` for the product codebase
- `docs/` for the public documentation site
- `landing/` for the marketing website

If you are working on the app itself, most of your time will be in `app/`.

## Start Here

1. Follow [Local Setup](/development/local-setup) to run the project.
2. Read [Architecture](/development/architecture) before changing routes, services, platform logic, or native behavior.
3. Read [Contributing](/contributing) before opening a PR.

## Stack

- Frontend: React 19, React Router 7, TanStack Query, Zustand, Vite
- Backend: Bun, Hono, SQLite, Better Auth
- Native shell: Tauri v2 with Rust
- Tooling: TypeScript, Vitest, ESLint, Knip
