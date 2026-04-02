# Zentrio - Architecture Reference

Read `llm/README.md` first.

This file is the deep reference, not the primary instruction flow.

This file is the current source-of-truth map of the repository.
Read it before adding new files, helpers, routes, or platform abstractions.

It is written for both humans and coding assistants.

## What Zentrio Is

Zentrio is a self-hosted streaming platform built around:

- a React frontend
- a Bun + Hono backend
- a Tauri v2 native shell for desktop and mobile
- a Stremio-compatible addon ecosystem

The project currently supports four product shapes:

- Web: React SPA served by the Bun/Hono server
- Desktop: Tauri app with a Rust shell and a bundled Bun sidecar in production
- Mobile: Tauri Android/iOS shell plus the same React app and Rust command layer
- TV: Android TV / Chromecast with Google TV - the same Tauri Android app with TV-specific UI and remote-navigation primitives; not a separate product

## Current Architecture Snapshot

Zentrio is in a hybrid phase. The important boundaries are:

- First-party state stays trusted on the backend: auth, profiles, settings, history, admin, sync, analytics, filtering, and secret-backed integrations.
- Third-party addon fetching increasingly happens on the client:
  - Tauri uses direct HTTP for external addon URLs.
  - Web tries direct fetch first and falls back to `/api/addon-proxy` when CORS blocks the addon.
- Stream resolution for the main playback flow is now client-side through `app/src/lib/stream-resolver.ts`.
- The legacy server-driven SSE endpoint `/api/streaming/streams-live` still exists for compatibility and gateway forwarding.
- Native connected mode also has a local-only read gateway at `/api/gateway/*` so the sidecar can proxy selected read routes to a remote server.

Alpha rule: the client, Bun server, and native shell are expected to move together. Do not optimize for backward compatibility over code clarity unless the task explicitly requires it.

## Platform Targets

All target classification is owned by `app/src/lib/app-target.ts`. Nothing else should replicate platform detection logic.

| Target | `AppTargetKind` | How detected | Primary input |
| --- | --- | --- | --- |
| Web | `web` | Not Tauri, not TV UA | `mouse` |
| Desktop | `desktop` | Tauri + not Android/iOS | `mouse` |
| Mobile | `mobile` | Tauri + Android or iOS | `touch` |
| TV | `tv` | Tauri + native `getEnvironment` -> `isTv: true`; fallback: TV UA or Tauri+Android+no-hover+wide viewport | `remote` |

The native `plugin:tv-launcher|getEnvironment` command is invoked at startup in `hydrateNativeAppTarget()` from `app/src/main.tsx`. It returns `{ isTv: boolean }`. All target heuristics are overridden by this value when available.

Derived capability questions belong in `app/src/lib/platform-capabilities.ts`.
Examples:

- `shouldShowTitleBar`
- `shouldUseTvHome`
- `canUseRemoteNavigation`
- `supportsTouchGestures`

Components should ask capability questions instead of composing raw target checks inline.

### Google TV development environment

- Emulator: AVD named `ZentrioGoogleTV` running Android TV image
- Logical CSS viewport: about `960x540px` (`1920x1080` at `2x` device pixel ratio)
- Key consequence: Tailwind `xl:` breakpoints never activate on TV; TV layouts need explicit TV CSS, not desktop breakpoint assumptions
- Dev script: `app/scripts/google-tv.ps1 -Action dev|build|install|logcat`
- In dev mode the onboarding defaults to `http://localhost:3000` and `/activate` points to `http://localhost:5173/activate`

## Platform Request Flow Matrix

### Authentication

| Platform | Flow |
| --- | --- |
| Web | Better Auth cookie/session; browser handles OAuth redirects natively |
| Desktop | Better Auth with Bearer token persisted in localStorage; deep links (`zentrio://`) receive OAuth callbacks |
| Mobile | Same as Desktop |
| TV | Device-link pairing only - user visits `/activate` on any browser, signs in, receives a 6-digit code; TV onboarding redeems that code. No browser OAuth in the TV WebView. |

### API calls

| Platform | Route | Notes |
| --- | --- | --- |
| Web (dev) | `/api/*` -> Vite proxy -> Hono :3000 | Two-server dev model |
| Web (prod) | `/api/*` -> same Hono process | Hono serves `dist/` and API from one process |
| Desktop (dev) | direct to Hono sidecar on localhost | `apiFetch` resolves base URL from local state |
| Desktop (prod) | same, Bun sidecar bundled inside `.app`/`.exe` | sidecar spawned by `lib.rs` |
| Mobile | same as Desktop | |
| TV | same as Desktop; remote reads may use `/api/gateway/*` | gateway is local-only and allowlisted |

### Addon fetching

| Platform | Strategy |
| --- | --- |
| Web | Direct fetch first; fall back to `/api/addon-proxy` when CORS blocks the addon |
| Desktop | Direct HTTP via Tauri HTTP plugin |
| Mobile | Same as Desktop |
| TV | Same as Desktop |

All external addon requests go through `app/src/lib/addon-fetch.ts`.
Do not call addon URLs with raw `fetch()`.

### Static assets

| Platform | Behavior |
| --- | --- |
| Web | Served from `public/` by Vite (dev) or Hono static handler (prod) |
| Desktop / Mobile / TV | Shared client assets should resolve through canonical helpers such as `app/src/lib/brand-assets.ts`, which build URLs from `import.meta.env.BASE_URL`. Do not scatter hardcoded `"/static/..."` strings through the client. |

### Playback engine

Engine selection lives in `app/src/components/player/engines/factory.ts`.

| Platform | Source type | Engine | Reason |
| --- | --- | --- | --- |
| Web | HLS `.m3u8` | `WebPlayerEngine` -> HLS.js | Browsers lack native HLS |
| Web | MP4 / WebM | `WebPlayerEngine` -> native `<video>` | |
| Web | MKV / unknown | `HybridPlayerEngine` | Browser fallback/transcoding path |
| Desktop | Any | `TauriPlayerEngine` | System decoders |
| Mobile iOS | Any | `TauriPlayerEngine` | AVFoundation |
| Mobile Android | Any | `AndroidNativePlayerEngine` | ExoPlayer overlay |
| TV | Any | `AndroidNativePlayerEngine` | Same ExoPlayer path; TV vs phone is a UI/control concern, not a separate playback stack |

Important player contract notes:

- Android playback is delegated through the native `plugin:exo-player` bridge.
- Native player back is surfaced to TypeScript as `close`, not `ended`.
- `ZentrioPlayer` disables the React transport UI on Tauri Android because the native ExoPlayer overlay owns the visible control surface there.

## Adaptive Screen Architecture

The current frontend direction is:

- one route URL per feature
- one shared screen-model hook per route
- one standard renderer for web/desktop/mobile
- one TV renderer for Android TV

Canonical file pattern:

- `<Page>.tsx` or `<Page>Route.tsx` = route wrapper only
- `<Page>.model.ts` = shared data, derived state, and route actions
- `<Page>.standard.tsx` = web/desktop/mobile renderer
- `<Page>.tv.tsx` = Android TV renderer

Route wrapper rule:

- call the shared `use<Page>ScreenModel()`
- render `AdaptiveScreen`
- do not bury large `isTv` branches inside the page body

This keeps fetching, mutations, navigation rules, and derived state shared while letting composition differ by surface.

### Standard vs TV design split

Treat the UI as two design families, not four:

- Standard family: web browser, desktop Tauri, phone, and tablet
- TV family: Android TV / Google TV when `canUseRemoteNavigation === true`

Standard-family rules:

- desktop, mobile web, and Tauri mobile share the `StandardView`
- differences inside the standard family should usually be responsive layout, touch affordances, safe-area handling, or titlebar behavior
- do not fork separate route trees for web vs desktop vs mobile unless the product flow truly differs

TV-family rules:

- TV gets its own `TvView`
- TV composition is remote-first: explicit focus zones, large targets, deterministic back behavior, and readable spacing at distance
- TV owns its shell through `TvPageScaffold` rather than inheriting the standard navbar/layout
- TV pages should use `TvFocusScope`, `TvFocusZone`, `TvFocusItem`, `TvShelf`, `TvGrid`, `TvActionStrip`, and `TvDialog`

Design-boundary rule:

- use shared models and shared backend contracts
- separate the renderers
- avoid making every shared component "TV-aware"

If a page starts accumulating many `isTv` branches, stop and split it into `.standard.tsx` and `.tv.tsx` instead.

### Adaptive UI layer

| File | Purpose |
| --- | --- |
| `app/src/components/tv/AdaptiveScreen.tsx` | Route boundary that selects `StandardView` vs `TvView` |
| `app/src/components/tv/TvFocusContext.tsx` | TV focus provider, scopes, zones, items, D-pad movement, and back-key handling |
| `app/src/components/tv/TvPageScaffold.tsx` | Shared Android TV shell: sticky rail, header, content area, shelves, grids, dialogs |
| `app/src/components/tv/TvRailMenu.tsx` | Left sidebar navigation rail for TV pages |
| `app/src/components/tv/TvFocusable.tsx` | Single focusable element wrapper |
| `app/src/components/tv/TvMediaShelf.tsx` | Scrollable horizontal media shelf |
| `app/src/components/tv/TvPosterActionDialog.tsx` | Modal action dialog triggered from a poster/card |
| `app/src/pages/streaming/StreamingTvScaffold.tsx` | Streaming-specific TV page wrapper: rail navigation, profile switcher, downloads indicator |
| `app/src/pages/streaming/Home.tsx` + `Home.model.ts` + `Home.standard.tsx` + `Home.tv.tsx` | Canonical adaptive split for a streaming page |
| `app/src/pages/ProfilesPage.tsx` + `ProfilesPage.model.ts` + `ProfilesPage.standard.tsx` + `ProfilesPage.tv.tsx` | Canonical adaptive split for a non-streaming page |
| `app/src/pages/SettingsPage.tsx` + `SettingsPage.model.ts` + `SettingsPage.standard.tsx` + `SettingsPage.tv.tsx` | Adaptive settings surface |
| `app/src/pages/ActivateDevicePage.tsx` | Web page at `/activate` used by TV pairing |
| `app/src-tauri/gen/android/app/src/main/java/com/zentrio/mteij/TvLauncherPlugin.kt` | Native Android plugin exposing `getEnvironment` and launcher integration |
| `app/src-tauri/gen/android/app/src/main/java/com/zentrio/mteij/ExoPlayerPlugin.kt` | Native Android ExoPlayer plugin |

## Repo Layout

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
- Native Rust code owns Tauri commands, OS integration, downloads, and plugin registration.
- Android TV launcher integrations such as Watch Next / Continue Watching are OS integration and stay in the native layer.

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

Business logic does not belong here.

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
- Tauri onboarding and connected-vs-guest flow
- deep link handling for native auth flows
- route protection via auth/admin guards

## Route Layer

All Bun API routers live in `app/src/routes/api/`.
Each file should validate input, call services, and return a response.
Do not bury business rules directly in route handlers if a reusable service is the better home.

### Route map

| File | Mount | Purpose |
| --- | --- | --- |
| `auth.ts` | `/api/auth` | Better Auth flows plus native/mobile/TV helper endpoints |
| `profiles.ts` | `/api/profiles` | Profile CRUD plus per-profile proxy/filter settings |
| `user.ts` | `/api/user` | Settings profiles, user settings, account management |
| `streaming.ts` | `/api/streaming` | Streaming settings, dashboard, details, catalog/search, progress/history, subtitles, streams, IntroDB endpoints, filter-enrich |
| `addons.ts` | `/api/addons` | Addon install/remove/list, enable/disable/reorder per settings profile |
| `lists.ts` | `/api/lists` | Watchlists and sharing |
| `appearance.ts` | `/api/appearance` | Appearance settings |
| `sync.ts` | `/api/sync` | Native/cloud sync config plus sync token, push, and pull endpoints |
| `trakt.ts` | `/api/trakt` | Trakt availability, auth flows, sync, recommendations, scrobble, check-in |
| `gateway.ts` | `/api/gateway` | Local-sidecar-only read gateway |
| `admin.ts` | `/api/admin` | Admin status/setup, stats, charts, users, audit log, step-up verification |
| `avatar.ts` | `/api/avatar` | Avatar generation |
| `proxy.ts` | `/api/addon-proxy` | Thin SSRF-guarded compatibility proxy |
| `tmdb-proxy.ts` | `/api/tmdb` | Internal TMDB-addon facade |

### TV authentication rule

- Android TV should not own full OAuth or SSO browser flows in the WebView
- the browser/web app handles sign-in at `/activate`
- the backend issues and redeems short-lived pairing codes in `/api/auth`
- the TV onboarding screen redeems a code instead of launching provider-specific browser flows directly

## Service Layer

Server-side business logic lives in `app/src/services/`.

### Core services

| File | Purpose |
| --- | --- |
| `logger.ts` | Canonical Bun/server logger |
| `envParser.ts` | Canonical env loader and typed config reader |
| `auth.ts` | Better Auth server configuration and plugin wiring |
| `email.ts` | Outbound email sending with provider fallback |
| `encryption.ts` | Secret-backed encryption/decryption helpers |
| `imdb.ts` | IMDb dataset ingest/update logic |
| `sync.ts` | Background sync orchestration |
| `avatar.ts` | DiceBear avatar generation |

### Database layer

`app/src/services/database/` is the canonical SQLite access layer.

Rules:

- tables and indexes belong in `connection.ts`
- schema changes go through `migrations.ts`
- query logic stays in the database service layer

### Addon services

`app/src/services/addons/`

Important files:

- `addon-manager.ts`
- `client.ts`
- `zentrio-client.ts`
- `stream-service.ts`
- `stream-processor.ts`
- `meta-service.ts`
- `meta-normalizer.ts`
- `content-filter.ts`

### Client-side media pipeline

These live under `app/src/services/hybrid-media/` but run in the client bundle.
They are not Bun server services.

### Native download engine

The real download engine lives under `app/src-tauri/src/downloads/`.
The TypeScript app only drives it.

## Frontend Canonical Layers

### `app/src/lib/`

Shared client singletons and transport utilities.

Important files:

- `auth-client.ts`
- `apiFetch.ts`
- `adminApi.ts`
- `addon-fetch.ts`
- `addon-client.ts`
- `stream-resolver.ts`
- `secure-storage.ts`
- `app-mode.ts`
- `runtime-env.ts`
- `app-target.ts`
- `platform-capabilities.ts`
- `offline-downloads.ts`
- `tv-launcher.ts`
- `brand-assets.ts`
- `url.ts`

Rules:

- do not call `/api/*` with raw `fetch()` from components or hooks
- use `apiFetch` / `apiFetchJson` for internal API routes
- use `addon-client.ts` or `addon-fetch.ts` for third-party addon URLs
- platform or target detection helpers belong here when they influence app composition across multiple screens

### `app/src/stores/`

Global client state via Zustand.

Current real stores:

- `authStore.ts`
- `downloadStore.ts`

### `app/src/hooks/`

Check existing hooks before adding a new one.
Important ones include:

- `useStreamLoader.ts`
- `useCatalog.ts`
- `useMeta.ts`
- `useDownloads.ts`
- `usePlayer.ts`
- `useHybridPlayer.ts`
- `useExternalPlayer.ts`
- `useSubtitles.ts`
- `useLibraryData.ts`
- `useAppearanceSettings.ts`
- `useLoginBehavior.ts`
- `useOfflineMode.ts`

### `app/src/pages/`

Route-level React components.

Groups:

- root pages such as landing, profiles, settings, native entry, addon explore
- `auth/`
- `streaming/`
- `admin/`

Adaptive route rule:

- route-specific TV renderers live next to their route files as `.tv.tsx`
- standard renderers live next to them as `.standard.tsx`
- shared models live next to them as `.model.ts`
- avoid reviving a separate `/tv/*` route tree for main app screens

### `app/src/components/`

Reusable UI and feature components.

Important areas:

- `auth/`
- `details/`
- `downloads/`
- `features/`
- `layout/`
- `library/`
- `onboarding/`
- `player/`
- `settings/`
- `streaming/`
- `tv/`
- `ui/`

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

### Native plugin boundaries

- Android TV launcher publishing belongs in the Android launcher plugin
- Android playback belongs in the ExoPlayer plugin
- downloads belong in native Rust

Do not reimplement those concerns in TypeScript.

## Canonical Patterns

### Logging

Server:

```ts
import { logger } from '@/services/logger'
```

Client:

```ts
import { createLogger } from '@/utils/client-logger'
```

Do not add new logger abstractions.

### Streaming UI buttons

Three tiers. Do not invent new shapes outside these.

| Tier | Radius | Classes | Used for |
| --- | --- | --- | --- |
| Primary | pill (50px+) | per-page `.playBtn`, `.backBtn` | Play, Back — the one main CTA on a page |
| Secondary | 8px rounded rect | `.actionBtn` (+ `.actionBtnDanger` modifier) in `Streaming.module.css` | Download, Share, Leave, Storage & Settings — utility actions with a label |
| Icon-only | circle (50%) | per-page `.iconBtn` | Compact auxiliary actions with no label |

Rules:

- Import `styles` from `../../styles/Streaming.module.css` and use `styles.actionBtn` / `styles.actionBtnDanger` for secondary buttons.
- Do not use inline `style` props for buttons visible at the page level.
- Primary pill buttons stay per-page because their sizing and weight vary by context.
- The secondary class sets the visual language (8px radius, muted background, labeled). State modifiers (active, done) are added per-page via additional classes.

### Client API calls

Internal backend API:

```ts
import { apiFetchJson } from '@/lib/apiFetch'
```

External addon URL:

```ts
import { getAddonClient } from '@/lib/addon-client'
```

Do not mix these layers.

### Target-specific UI

When supporting a new surface such as Android TV:

- keep services, routes, and data hooks shared unless the backend contract truly changes
- add one canonical target/capability helper in `app/src/lib/` instead of repeated environment checks
- prefer target-specific shells and renderers over forking entire feature flows
- keep styling differences token-driven where possible; do not spread one-off target overrides through many files
- if storage or download behavior differs by target, put the policy in shared helpers and let screens consume that capability

Design rule of thumb:

- if the difference is mouse vs touch vs desktop chrome, keep it in the `StandardView`
- if the difference is remote-first navigation and TV-distance readability, move it into a `TvView`

Practical rule:

- `runtime-env.ts` owns raw runtime/container detection
- `app-target.ts` owns canonical target classification
- `platform-capabilities.ts` owns derived UI/product capability decisions
- feature policy helpers such as `offline-downloads.ts` should sit on top of those layers instead of re-checking globals in screens

### Launcher integrations

For Android TV launcher surfaces such as Continue Watching / Watch Next:

- keep underlying progress/history state in shared app services
- publish to Android TV home surfaces through one native Android bridge/plugin
- treat compatibility with alternate launchers as a consequence of supporting Android TV standard discovery APIs, not as separate custom integrations

### Database changes

When you need schema changes:

1. update `services/database/connection.ts` if it is part of the baseline schema
2. add migration logic in `services/database/migrations.ts`
3. keep query logic inside the database service layer

### New API routes

When adding a route:

1. add or extend the router under `app/src/routes/api/`
2. keep validation in the route
3. move reusable logic to `app/src/services/`
4. mount it in `app/src/routes/api/index.ts` if it is a new router

### Addon boundary

Rules for third-party addons:

- client-side addon requests go through `addon-client.ts` / `addon-fetch.ts`
- web may fetch direct if CORS permits, otherwise use `/api/addon-proxy`
- after client-side catalog fetches, call `/api/streaming/filter-enrich` when server-side enrichment/filtering is required
- the internal TMDB addon is special: `zentrio://tmdb-addon` maps to `/api/tmdb/*`

## What Not To Do

- Do not create new logging wrappers.
- Do not import server-only modules into client code.
- Do not call raw `fetch('/api/...')` from components or hooks.
- Do not add DB schema in arbitrary service files.
- Do not duplicate addon transport helpers.
- Do not create new Zustand stores unless existing ones are clearly insufficient.
- Do not treat `/api/gateway` as a general-purpose proxy.
- Do not turn every shared component into a TV-aware component.

## Environment and Secrets

The env file lives at the repository root:

- `.env`
- `.env.example`

`app/src/services/envParser.ts` is the canonical env interpreter.

Important live config groups:

- server: `PORT`, `APP_URL`, `CLIENT_URL`, `DATABASE_URL`
- security: `AUTH_SECRET`, `ENCRYPTION_KEY`, `HEALTH_TOKEN`
- admin: `ADMIN_ENABLED`, `ADMIN_SETUP_TOKEN`, `ANALYTICS_ENABLED`
- email: SMTP / Resend provider config
- SSO: Google, GitHub, Discord, and multi-OIDC provider config
- integrations: `TMDB_API_KEY`, `TRAKT_CLIENT_ID`, `TRAKT_CLIENT_SECRET`, `FANART_API_KEY`, `IMDB_UPDATE_INTERVAL_HOURS`
- tuning: rate limits, proxy logs, log level

## External Integrations

| Service | Purpose |
| --- | --- |
| TMDB | Metadata and catalog foundation |
| Trakt | Sync, recommendations, scrobble, check-in |
| IntroDB | Intro/recap/outro timestamps |
| MDBList | Curated lists for TMDB-backed catalogs |
| Fanart.tv | Artwork/logos |
| IMDb dataset | Ratings |
| DiceBear | Avatar generation |
| Better Auth | Authentication |

## Quick Decision Guide

If you are deciding where code belongs:

- New Bun API behavior: `app/src/routes/api/` + `app/src/services/`
- New client transport helper: probably `app/src/lib/`
- New reusable UI: `app/src/components/`
- New route screen: `app/src/pages/` + `app/src/App.tsx`
- New native capability: `app/src-tauri/src/`
- Public docs: `docs/`
- Internal contributor/assistant reference: `llm/`

When in doubt, extend an existing layer instead of inventing a new one.
