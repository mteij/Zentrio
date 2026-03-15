# Zentrio - Architecture Reference

This file is the current source-of-truth map of the repository.
Read it before adding new files, helpers, routes, or platform abstractions.

It is written for both humans and coding assistants.

## What Zentrio Is

Zentrio is a self-hosted streaming platform built around:

- a React frontend
- a Bun + Hono backend
- a Tauri v2 native shell for desktop and mobile
- a Stremio-compatible addon ecosystem

The project currently supports three product shapes:

- Web: React SPA served by the Bun/Hono server
- Desktop: Tauri app with a Rust shell and a bundled Bun sidecar in production
- Mobile: Tauri Android/iOS shell plus the same React app and Rust command layer

## Current Architecture Snapshot

Zentrio is in a hybrid phase. The important boundaries are:

- First-party state stays trusted on the backend: auth, profiles, settings, history, admin, sync, analytics, filtering, and secret-backed integrations.
- Third-party addon fetching increasingly happens on the client:
  - Tauri uses direct HTTP for external addon URLs.
  - Web tries direct fetch first and falls back to `/api/addon-proxy` when CORS blocks the addon.
- Stream resolution for the main playback flow is now client-side through `src/lib/stream-resolver.ts`.
- The legacy server-driven SSE endpoint `/api/streaming/streams-live` still exists for compatibility and gateway forwarding.
- Native connected mode also has a local-only read gateway at `/api/gateway/*` so the sidecar can proxy selected read routes to a remote server.

Alpha rule: the client, Bun server, and native shell are expected to move together. Do not optimize for backward compatibility over code clarity unless the task explicitly requires it.

## Repo Layout

Top-level directories:

| Path | Purpose |
| --- | --- |
| `app/` | Main product code: frontend, backend, native shell |
| `docs/` | Public VitePress documentation site |
| `landing/` | Marketing/landing site |
| `llm/` | Internal contributor/assistant reference docs |

Operational rules:

- App commands run from `app/`.
- The root `.env` file lives in the repository root, not `app/`.
- Docker and repo-level orchestration live at the repository root.

## Runtime Boundaries

There are three real execution contexts in this repo.

| Context | Runs where | Main entry point | Logging |
| --- | --- | --- | --- |
| Server | Bun process | `app/src/index.ts` | `app/src/services/logger.ts` |
| Client | Browser or Tauri WebView | `app/src/main.tsx` | `app/src/utils/client-logger.ts` |
| Native | Rust/Tauri host | `app/src-tauri/src/lib.rs` | Rust `println!` / Tauri event flow |

Hard boundary rules:

- Server code must not depend on browser globals like `window`, `document`, `localStorage`, or `import.meta.env`.
- Client code must not import Bun-only modules like `bun:sqlite` or server-only services like `src/services/envParser.ts`.
- Native Rust code owns Tauri commands, OS integration, downloads, and plugin registration. Do not reimplement those concerns in TypeScript.

## App Entry Points

### `app/src/index.ts`

Backend bootstrap.

Responsibilities:

- loads env from the repo root via `initEnv()`
- initializes IMDb and background sync services
- applies middleware for CORS, security headers, body limits, rate limiting, and optional request logging
- records client platform hints for admin analytics using the `X-Zentrio-Client` header
- serves built assets and SPA fallbacks
- mounts `/api/*` routers and non-API view routes

Non-goal:

- business logic does not belong here

### `app/src/main.tsx` and `app/src/renderer.tsx`

Frontend bootstrapping only.

- `main.tsx` mounts React
- `renderer.tsx` wires providers around the app tree

Do not put app-specific data flow or route behavior here.

### `app/src/App.tsx`

Client router and high-level app orchestration.

Key responsibilities:

- React Router route tree
- lazy loading for page-level code splitting
- TanStack Query client setup
- Tauri onboarding and connected-vs-guest mode flow
- deep link handling for native auth flows
- route protection via auth/admin guards

## Route Layer

All Bun API routers live in `app/src/routes/api/`.
Each file should validate input, call services, and return a response.
Do not bury business rules directly in route handlers if a reusable service is the better home.

### `app/src/routes/api/index.ts`

Mounts the API surface and also owns:

- `GET /api`
- `GET /api/health`
- OpenAPI generation
- Scalar docs at `/api/docs`

### Route Map

| File | Mount | Purpose |
| --- | --- | --- |
| `auth.ts` | `/api/auth` | Better Auth flows plus native/mobile helper endpoints like provider discovery, identify, link proxy, and mobile callback handling |
| `profiles.ts` | `/api/profiles` | Profile CRUD plus per-profile proxy/filter settings |
| `user.ts` | `/api/user` | Settings profiles, user settings, linked accounts, TMDB key, email/password/username/account management |
| `streaming.ts` | `/api/streaming` | Streaming settings, dashboard data, details, catalog/search, progress/history, subtitles, stream endpoints, IntroDB segment fetch/submit, filter-enrich |
| `addons.ts` | `/api/addons` | Addon install/remove/list, enable/disable/reorder per settings profile |
| `lists.ts` | `/api/lists` | Watchlists and sharing |
| `appearance.ts` | `/api/appearance` | Appearance settings |
| `sync.ts` | `/api/sync` | Native/cloud sync config plus sync token, push, and pull endpoints |
| `trakt.ts` | `/api/trakt` | Trakt availability, auth flows, sync, recommendations, scrobble, and check-in |
| `gateway.ts` | `/api/gateway` | Local-sidecar-only read gateway that forwards selected remote read routes for connected Tauri mode |
| `admin.ts` | `/api/admin` | Admin status/setup, stats, charts, platform analytics, users, audit log, and step-up verification |
| `avatar.ts` | `/api/avatar` | Avatar generation |
| `proxy.ts` | `/api/addon-proxy` | Thin SSRF-guarded compatibility proxy for external addon URLs |
| `tmdb-proxy.ts` | `/api/tmdb` | Internal TMDB-addon facade; keeps API keys server-side |
| `openapi.ts` | `/api/openapi.json` support | OpenAPI schema definitions and generation helpers |
| `openapi-route.ts` | shared helper | Route tagging and OpenAPI helper utilities |

### Non-API routes

| File | Purpose |
| --- | --- |
| `app/src/routes/views.ts` | Redirect-style view routes and deep-link oriented server responses |

### Important Streaming Endpoints

`streaming.ts` is one of the most important files in the backend. It currently exposes:

- `/settings`
- `/streams/:type/:id`
- `/streams-live/:type/:id`
- `/subtitles/:type/:id`
- `/search`
- `/search-catalogs`
- `/catalog`
- `/catalog-items`
- `/progress`
- `/progress/:type/:id`
- `/series-progress/:id`
- `/mark-watched`
- `/mark-season-watched`
- `/mark-series-watched`
- `/mark-episodes-before`
- `/details/:type/:id`
- `/filters`
- `/dashboard`
- `/filter-enrich`
- `/segments`
- `/segments/submit`

Notes:

- `/streams-live` is a compatibility path, not the preferred new client architecture.
- `/filter-enrich` is the server-side parental-filter and watch-history enrichment pass for client-fetched catalog data.
- `/segments` fetches IntroDB data server-side and caches it in SQLite.
- `/segments/submit` submits IntroDB segments with the API key stored in streaming settings.

### Important Admin Endpoints

`admin.ts` currently includes:

- `/status`
- `/setup`
- `/me`
- `/stats`
- `/activity/live`
- `/dashboard/charts`
- `/stats/platforms`
- `/system/health`
- `/users`
- `/users/:id`
- `/users/:id/role`
- `/users/:id/ban`
- `/users/:id/unban`
- `/audit`
- `/audit/stats`
- `/audit/verify`
- `/stepup/request`
- `/stepup/verify`
- `/stepup/status`

Admin route rule:

- every protected admin route should go through `adminSessionMiddleware`
- permission-gated routes should also use `requirePermission(...)`
- sensitive mutations should additionally require `adminStepUpMiddleware`

## Middleware

`app/src/middleware/`

| File | Purpose |
| --- | --- |
| `security.ts` | CORS, security headers, body limit, and global rate limiter |
| `session.ts` | Regular session and guest-mode middleware |
| `admin.ts` | Admin session, RBAC enforcement, and step-up checks |

## Service Layer

Server-side business logic lives in `app/src/services/`.

### Core Services

| File | Purpose |
| --- | --- |
| `logger.ts` | Canonical Bun/server logger. Never use `console.log` in server code. |
| `envParser.ts` | Canonical env loader and typed config reader. The only place that should interpret `process.env`. |
| `auth.ts` | Better Auth server configuration and plugin wiring |
| `email.ts` | Outbound email sending |
| `email/templates.ts` | Email HTML templates |
| `encryption.ts` | Secret-backed encryption/decryption helpers |
| `imdb.ts` | IMDb dataset ingest/update logic |
| `sync.ts` | Background sync orchestration |
| `avatar.ts` | DiceBear avatar generation |

### Database Layer

`app/src/services/database/` is the canonical SQLite access layer.

| File | Purpose |
| --- | --- |
| `connection.ts` | DB bootstrap, schema creation, and seed/setup logic |
| `migrations.ts` | Incremental schema migrations |
| `addons.ts` | Addon persistence |
| `appearance.ts` | Appearance settings persistence |
| `lists.ts` | Watchlist persistence |
| `profile.ts` | Profile persistence |
| `settings-profile.ts` | Settings-profile persistence |
| `proxy.ts` | Proxy session persistence |
| `stream.ts` | Streaming settings/cache/history persistence |
| `trakt.ts` | Trakt account and sync-state persistence |
| `watch-history.ts` | Watch history persistence |
| `user.ts` | User/account persistence |
| `utils.ts` | DB helpers |
| `types.ts` | DB row types |
| `index.ts` | Re-exports |

Schema rule:

- tables and indexes belong in `connection.ts`
- schema changes should go through `migrations.ts`

### Addon Services

`app/src/services/addons/`

| File | Purpose |
| --- | --- |
| `addon-manager.ts` | High-level orchestration for catalog/meta/stream/subtitle queries and addon lifecycle |
| `client.ts` | Server-side Stremio addon client |
| `zentrio-client.ts` | Zentrio addon hub client |
| `stream-service.ts` | Server-side stream orchestration |
| `stream-processor.ts` | Filtering, scoring, dedupe, and ordering logic for streams |
| `stream-cache.ts` | Stream cache used by legacy server-side flow |
| `meta-service.ts` | Metadata fetching |
| `meta-normalizer.ts` | Metadata normalization |
| `content-filter.ts` | Parental filtering and content enrichment |
| `types.ts` | Shared addon types |

### TMDB Services

`app/src/services/tmdb/`

These back Zentrio's internal TMDB addon and related metadata helpers.

| File | Purpose |
| --- | --- |
| `client.ts` | TMDB HTTP client and key validation |
| `catalog.ts` | Catalog queries |
| `meta.ts` | Detailed metadata |
| `trending.ts` | Trending feeds |
| `search.ts` | Search |
| `episodes.ts` | Episode metadata |
| `genres.ts`, `languages.ts`, `age-ratings.ts` | Reference data |
| `logo.ts` | Logo/artwork helpers |
| `mdblist.ts` | MDBList-backed curated feeds |
| `cache.ts` | TMDB cache layer |
| `utils.ts`, `index.ts` | Utilities and exports |

### Trakt Services

`app/src/services/trakt/`

| File | Purpose |
| --- | --- |
| `client.ts` | Trakt API client |
| `sync.ts` | Pull/push watch history synchronization |
| `types.ts`, `index.ts` | Types and exports |

### Admin Services

`app/src/services/admin/`

| File | Purpose |
| --- | --- |
| `rbac.ts` | Roles, permissions, and permission caching |
| `stepup.ts` | OTP challenge lifecycle |
| `audit.ts` | Audit log write/query/verification |

### Client-Side Media Pipeline

These live under `app/src/services/hybrid-media/` but run in the client bundle.
They are not Bun server services.

| File | Purpose |
| --- | --- |
| `HybridEngine.ts` | Orchestrates in-browser fallback playback/transcoding |
| `Demuxer.ts` | Splits source streams |
| `VideoRemuxer.ts` | Browser-compatible video remuxing |
| `AudioStreamTranscoder.ts` | Audio transcoding |
| `ChunkedAudioTranscoder.ts` | Chunked long-form audio transcoding |
| `StreamingAudioTranscoder.ts` | Progressive audio transcoding |
| `TranscoderService.ts` | Higher-level transcoder interface |
| `NetworkReader.ts` | Fetch/stream media data |
| `types.ts`, `index.ts` | Shared types and exports |

### Frontend-Only Download Service

`app/src/services/downloads/download-service.ts`

- client adapter around native Tauri download commands
- does not own the actual download engine

## Frontend Canonical Layers

### `app/src/lib/`

Shared client singletons and transport utilities.

| File | Purpose |
| --- | --- |
| `auth-client.ts` | Better Auth client singleton, Tauri-aware fetch behavior, auth/session helpers, `isTauri()` |
| `apiFetch.ts` | Canonical client wrapper for `/api/*` requests |
| `adminApi.ts` | Typed admin API wrapper and step-up UI integration |
| `addon-fetch.ts` | External addon fetch transport: Tauri direct HTTP, web direct fetch first, proxy fallback second |
| `addon-client.ts` | Cached client-side addon client and `ZENTRIO_TMDB_ADDON` routing |
| `stream-resolver.ts` | Canonical client-side progressive stream resolver |
| `secure-storage.ts` | Sensitive storage abstraction |
| `app-mode.ts` | Guest vs connected mode state |
| `app-lifecycle.tsx` | App startup and lifecycle wrappers |
| `url.ts` | API URL helpers and allowlisted route helpers |
| `topStreamCache.ts` | Top-stream caching helpers |
| `tauri-player-mode.ts` | Tauri playback mode helpers |

Rules:

- do not call `/api/*` with raw `fetch()` from components or hooks
- use `apiFetch`/`apiFetchJson` for internal API routes
- use `addon-client.ts` or `addon-fetch.ts` for third-party addon URLs

### `app/src/stores/`

Global client state via Zustand.

| File | Purpose |
| --- | --- |
| `authStore.ts` | Auth/session state |
| `downloadStore.ts` | Native download queue/progress state |

### `app/src/hooks/`

Key hooks already exist for most reusable concerns.

Important ones:

| File | Purpose |
| --- | --- |
| `useStreamLoader.ts` | Progressive stream loading UI state using the client resolver |
| `useCatalog.ts` | Catalog fetching for internal TMDB and external addons |
| `useMeta.ts` | Detailed metadata loading |
| `useDownloads.ts` | Native download state/actions |
| `usePlayer.ts` | Main player state |
| `useHybridPlayer.ts` | Hybrid playback pipeline |
| `useExternalPlayer.ts` | External player launch |
| `useSubtitles.ts` | Subtitle loading/selection |
| `useLibraryData.ts` | Library/watchlist data |
| `useAppearanceSettings.ts` | Appearance settings |
| `useLoginBehavior.ts` | Login redirect behavior |
| `useOfflineMode.ts` | Native offline-state handling |

Before adding a new hook, check whether one of these should be extended instead.

### `app/src/utils/`

| File | Purpose |
| --- | --- |
| `client-logger.ts` | Canonical client logger |
| `toast.ts` | Canonical toast wrapper |
| `performance.ts` | Perf event recording helpers |
| `route-preloader.ts` | Route-chunk preloading |
| `api.ts` | Shared API response helpers used on the server side |

### `app/src/pages/`

Route-level React components.

Groups:

- root: landing/settings/profiles/share/reset/explore-addons/native entry
- `auth/`: sign in, sign up, two-factor
- `streaming/`: home, explore, catalog, search, details, player, library, downloads, shared layout
- `admin/`: dashboard, users, audit, system, shared layout

### `app/src/components/`

Reusable UI and feature components.

Important areas:

| Directory | Purpose |
| --- | --- |
| `auth/` | Auth forms, guards, native server selector, 2FA, magic link, auth mode UI |
| `admin/` | Admin step-up modal |
| `details/` | Details page building blocks |
| `downloads/` | Native download UI |
| `features/` | Catalog rows, cards, hero, profile/list modals |
| `layout/` | Navbar, title bar, app shell, error boundary |
| `library/` | Watchlist/library UI |
| `onboarding/` | Native first-run setup |
| `player/` | Zentrio player UI, engines, and player hooks |
| `settings/` | Settings sections and settings modals |
| `streaming/` | Streaming-page specific helpers/loaders |
| `ui/` | Generic primitives and skeleton/loading components |

## Native Layer

Everything under `app/src-tauri/` is the native shell.

### `app/src-tauri/src/lib.rs`

Main Tauri entry point.

Responsibilities:

- registers plugins
- initializes native download storage and queue manager
- exposes Tauri commands
- registers deep-link behavior
- spawns the Bun sidecar in desktop production builds

### `app/src-tauri/src/downloads/`

Native offline download implementation.

| File | Purpose |
| --- | --- |
| `manager.rs` | Queue orchestration |
| `db.rs` | Native download DB access |
| `file_store.rs` | Download directory resolution and storage layout |
| `hls.rs` | HLS download handling |
| `subtitles.rs` | Subtitle persistence/helpers |
| `events.rs` | Download event payloads |
| `notifier.rs` | Native notifications |
| `mod.rs` | Module exports |

This is the real download engine. The TypeScript app only drives it.

### `app/src-tauri/src/plugins/`

Custom native plugins.

Notable file:

- `immersive_mode.rs`: native fullscreen/orientation behavior used on Android

## Canonical Patterns

### Logging

Server:

```ts
import { logger } from '@/services/logger'

const log = logger.scope('Feature')
log.info('message')
log.warn('warning')
log.error('failure', error)
```

Client:

```ts
import { createLogger } from '@/utils/client-logger'

const log = createLogger('Feature')
log.info('message')
```

Do not add new logger abstractions.

### Client API Calls

Internal backend API:

```ts
import { apiFetchJson } from '@/lib/apiFetch'

const data = await apiFetchJson('/api/streaming/dashboard?profileId=1')
```

Admin API:

```ts
import { adminApi } from '@/lib/adminApi'
```

External addon URL:

```ts
import { getAddonClient } from '@/lib/addon-client'
```

Do not mix these layers.

### Data Fetching

Use TanStack Query for server state.
Do not build new `useEffect` + `useState` fetch loops unless there is a clear reason.

### Global State

Use Zustand only for truly cross-cutting client state like auth or downloads.

### Database Changes

When you need schema changes:

1. update `services/database/connection.ts` if it is part of the baseline schema
2. add the migration logic in `services/database/migrations.ts`
3. keep query logic inside the database service layer

### New API Routes

When adding a route:

1. add or extend the router under `app/src/routes/api/`
2. keep validation in the route
3. move reusable logic to `app/src/services/`
4. mount it in `app/src/routes/api/index.ts` if it is a new router
5. update OpenAPI helpers if needed

### Addon Boundary

Rules for third-party addons:

- client-side addon requests should go through `addon-client.ts` / `addon-fetch.ts`
- web may fetch direct if CORS permits, otherwise use `/api/addon-proxy`
- after client-side catalog fetches, call `/api/streaming/filter-enrich` when server-side enrichment/filtering is required
- the internal TMDB addon is special: `zentrio://tmdb-addon` maps to `/api/tmdb/*`

## What Not To Do

- Do not create new logging wrappers.
- Do not import server-only modules into client code.
- Do not call raw `fetch('/api/...')` from components or hooks.
- Do not add new DB schema in arbitrary service files.
- Do not put auth configuration outside `services/auth.ts` and `lib/auth-client.ts`.
- Do not duplicate addon transport helpers.
- Do not create new Zustand stores unless existing ones are clearly insufficient.
- Do not treat `/api/gateway` as a general-purpose proxy; it is intentionally local-only and allowlisted.
- Do not assume `/api/streaming/streams-live` is the long-term primary flow.

## Environment and Secrets

The env file lives at the repository root:

- `.env`
- `.env.example`

`app/src/services/envParser.ts` is the only canonical env interpreter.

Important live config groups:

- server: `PORT`, `APP_URL`, `CLIENT_URL`, `DATABASE_URL`
- security: `AUTH_SECRET`, `ENCRYPTION_KEY`, `HEALTH_TOKEN`
- admin: `ADMIN_ENABLED`, `ADMIN_SETUP_TOKEN`, `ANALYTICS_ENABLED`
- email: SMTP/Resend vars plus timeout/backoff tuning
- integrations: `TMDB_API_KEY`, `TRAKT_CLIENT_ID`, `TRAKT_CLIENT_SECRET`, `FANART_API_KEY`, `IMDB_UPDATE_INTERVAL_HOURS`
- tuning: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_LIMIT`, `PROXY_LOGS`, `LOG_LEVEL`

## External Integrations

| Service | Purpose | Notes |
| --- | --- | --- |
| TMDB | Metadata and catalog foundation | Global env key plus optional per-user override |
| Trakt | Sync, recommendations, scrobble, check-in | Per-profile account storage |
| IntroDB | Intro/recap/outro timestamps | Read via backend, cached in SQLite; submit via stored API key |
| MDBList | Curated lists for TMDB-backed catalogs | Routed through TMDB service layer |
| Fanart.tv | Artwork/logos | Optional API key |
| IMDb dataset | Ratings | Downloaded/updated locally |
| DiceBear | Avatar generation | Local library |
| Better Auth | Authentication | Core auth system across web and native |

## Known Debt / Watchouts

These are current realities. Do not copy them blindly into new code.

| Issue | Notes |
| --- | --- |
| Mixed streaming architecture | Client-side stream resolution is primary, but server SSE and gateway compatibility paths still exist |
| Duplicate email verification modal concepts | Auth flow and settings flow still have separate components |
| Some user-route behavior is legacy-shaped | `user.ts` still carries a broad compatibility surface for older frontend expectations |
| Native and hosted flows are tightly coupled | Connected Tauri mode, sidecar gateway, and remote sync all assume coordinated changes |

## Quick Decision Guide

If you are deciding where code belongs:

- New Bun API behavior: `app/src/routes/api/` + `app/src/services/`
- New client transport helper: probably `app/src/lib/`
- New reusable UI: `app/src/components/`
- New route screen: `app/src/pages/` + `app/src/App.tsx`
- New native capability: `app/src-tauri/src/`
- Public docs: `docs/`
- Internal assistant/contributor reference: `llm/`

When in doubt, extend an existing layer instead of inventing a new one.
