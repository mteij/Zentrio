# Backend

## Purpose

This file covers Bun server architecture, route boundaries, services, auth, admin, and database ownership.

## Read This When

Read this for API routes, server-side business logic, auth flows, admin work, or server integrations.

## Canonical Truth

- Backend entrypoint: `app/src/index.ts`
- API routers live in `app/src/routes/api/`
- Reusable server business logic lives in `app/src/services/`
- Database access lives in `app/src/services/database/`
- Better Auth server configuration lives in `app/src/services/auth.ts`

## Route Layer

- Each route file should validate input, call services, and return a response
- Business logic should not accumulate in route handlers when it can live in a reusable service
- New routers must be mounted in `app/src/routes/api/index.ts`

Key routers:

- `auth.ts`: Better Auth plus native and TV helper endpoints
- `profiles.ts`: profile CRUD and profile-linked settings
- `user.ts`: account and settings profile behavior
- `streaming.ts`: streaming settings, catalogs, history, subtitles, streams
- `addons.ts`: addon install, remove, enable, disable, reorder
- `sync.ts`, `trakt.ts`, `gateway.ts`, `admin.ts`: supporting backend surfaces

## Service Layer

- `logger.ts`: canonical server logger
- `envParser.ts`: env loading and typed config
- `auth.ts`: Better Auth wiring and plugins
- `services/addons/`: addon management and stream processing
- `services/database/`: schema, migrations, and query helpers

## Database Rules

- Baseline schema belongs in `connection.ts`
- Schema changes go through `migrations.ts`
- Query logic stays inside the database layer
- Do not place ad hoc SQL in unrelated services or UI code

## Auth And Admin Rules

- Better Auth is the canonical auth system
- Frontend auth access should go through the auth client, not custom ad hoc fetch code
- Admin routes are protected by admin middleware and permission checks
- Sensitive admin actions rely on step-up auth, not custom per-route exceptions

## TV Auth Rule

- TV should not host full provider-based OAuth flows in the WebView
- Browser login at `/activate` owns the sign-in UX
- The backend issues and redeems pairing codes through `/api/auth`

## See Also

- `llm/patterns/api-calls.md`
- `llm/patterns/database-changes.md`
- `llm/playbooks/add-route.md`
- `llm/playbooks/modify-schema.md`
