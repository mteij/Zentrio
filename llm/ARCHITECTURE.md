# Zentrio — Architecture Reference

**This document is the authoritative map of the codebase.**
Before creating a new file or utility, check here first — the thing you need probably already exists.
This file is tool-agnostic and applies to all AI assistants (Claude Code, GitHub Copilot, Cursor, Kilo Code, etc.) and human contributors.

---

## What Zentrio Is

A self-hosted streaming platform with a Stremio-compatible addon system. It targets three environments:
- **Web** — React SPA served by the Hono backend
- **Desktop** — Tauri v2 (Windows, macOS, Linux) with the backend as a sidecar binary
- **Mobile** — Tauri v2 Android/iOS

The codebase lives entirely in `app/src/`. All commands run from `app/` using Bun.

---

## Runtime Environments

Two distinct runtime contexts exist in this project. Always know which one you are writing code for.

| Context | Where it runs | Entry point | Logging |
|---|---|---|---|
| **Server** | Bun process (Node-like) | `src/index.ts` | `src/services/logger.ts` |
| **Client** | Browser / Tauri WebView | `src/main.tsx` | `src/utils/client-logger.ts` |

Server code may **never** import browser APIs (`window`, `document`, `localStorage`, `import.meta.env`).
Client code may **never** import `bun:sqlite`, `src/services/envParser.ts`, or any server-only service.

---

## Directory Map

### `src/index.ts` — Backend entry point
Sets up the Hono app: applies middleware (CORS, security headers, rate limiter), mounts all API routers, serves the compiled `dist/` SPA in production, and handles the SPA fallback route. **Do not add business logic here.** Route logic belongs in `src/routes/`, services in `src/services/`.

### `src/main.tsx` + `src/renderer.tsx` — Frontend entry points
`main.tsx` bootstraps React and mounts the app. `renderer.tsx` wraps the `<App>` tree with providers. Do not add routing or page logic here.

### `src/App.tsx` — React router + lazy loading
Defines all client-side routes using React Router v7. All pages are lazy-loaded (`React.lazy`) for code splitting. Add new page routes here.

---

### `src/routes/api/` — Hono API route handlers

Each file is a self-contained Hono router mounted under `/api/*`.

| File | Mounted at | Purpose |
|---|---|---|
| `index.ts` | `/api` | Mounts all sub-routers |
| `auth.ts` | `/api/auth` | Better Auth (email, magic link, OTP, 2FA, SSO) |
| `profiles.ts` | `/api/profiles` | User profiles CRUD |
| `user.ts` | `/api/user` | User settings, TMDB API key |
| `streaming.ts` | `/api/streaming` | Stream URL resolution. Also exposes `POST /api/streaming/filter-enrich` — accepts `{ items: MetaPreview[], profileId: number }`, applies server-side parental filtering + watch history enrichment, returns `{ items: MetaPreview[] }`. Call this after any client-side addon fetch. |
| `addons.ts` | `/api/addons` | Stremio-compatible addon management |
| `lists.ts` | `/api/lists` | Watchlists with sharing |
| `appearance.ts` | `/api/appearance` | Theme/appearance settings |
| `sync.ts` | `/api/sync` | Cloud sync |
| `trakt.ts` | `/api/trakt` | Trakt.tv integration |
| `gateway.ts` | `/api/gateway` | Proxy gateway |
| `admin.ts` | `/api/admin` | Admin panel (RBAC + step-up auth) |
| `avatar.ts` | `/api/avatar` | Avatar generation |
| `proxy.ts` | `/api/addon-proxy` | Thin CORS proxy for external addon URLs (web only — Tauri fetches directly). Accepts `?url=<encoded>`, validates against SSRF, passes response through unchanged. |
| `tmdb-proxy.ts` | `/api/tmdb` | TMDB API proxy — injects the API key server-side so it never reaches the client. Endpoints: `GET /trending`, `GET /trending/:type`, `GET /catalog/:type/:id`, `GET /meta/:type/:id`. |
| `openapi.ts` | `/api/openapi.json` | OpenAPI spec generator (Zod → OpenAPI schema) |
| `openapi-route.ts` | `/api/docs` | Scalar UI + spec endpoint mounting |
| `views.ts` | (non-API) | Server-side redirect routes (e.g. deep link redirects) |

Route handlers call services — they do not contain business logic directly. A route handler should: validate input (Zod), call a service, return a response.

---

### `src/services/` — All backend business logic

#### `src/services/logger.ts`
**The only logging utility for server-side code.** Uses ANSI color codes for terminal output. Import as:
```ts
import { logger } from '@/services/logger'
const log = logger.scope('MyService')
log.info('...') | log.warn('...') | log.error('...')
```
Never use `console.log` in server code.

#### `src/services/auth.ts`
Better Auth configuration and instance. The single place that configures all auth plugins (twoFactor, magicLink, emailOTP, oidcProvider, etc.). Do not add auth logic elsewhere.

#### `src/services/envParser.ts`
Reads and validates environment variables from the `.env` file at `../` (repo root). The only place that touches `process.env` for config. All other code that needs env vars should call `getConfig()` from here.

#### `src/services/encryption.ts`
Encryption/decryption utilities using the `ENCRYPTION_KEY` env var. Use for any sensitive data storage.

#### `src/services/email.ts` + `src/services/email/templates.ts`
`email.ts` — email sending service (Resend or SMTP, configured via env). Use for all outbound email.
`email/templates.ts` — HTML email template definitions. Add new templates here.

#### `src/services/imdb.ts`
IMDb ratings and metadata fetching. Provides supplementary rating data beyond TMDB.

#### `src/services/database.ts`
Standalone barrel-style re-export of the `database/` directory. Prefer importing directly from `@/services/database/connection` or specific files rather than this file.

#### `src/services/sync.ts`
Background sync service. Manages periodic sync jobs.

#### `src/services/avatar.ts`
Avatar generation using DiceBear. Called by the avatar route.

#### `src/services/database/`
SQLite database layer via `bun:sqlite`.

| File | Purpose |
|---|---|
| `connection.ts` | DB initialization, all `CREATE TABLE IF NOT EXISTS` schema definitions, seed data |
| `migrations.ts` | Incremental schema migrations run at startup |
| `addons.ts` | Addon CRUD operations |
| `appearance.ts` | Appearance settings read/write |
| `lists.ts` | Watchlist CRUD + sharing |
| `profile.ts` | User profile CRUD |
| `user.ts` | User-level settings |
| `settings-profile.ts` | Settings profile CRUD |
| `proxy.ts` | Proxy session storage |
| `stream.ts` | Stream cache/history |
| `trakt.ts` | Trakt token storage |
| `watch-history.ts` | Watch history read/write |
| `utils.ts` | Shared DB query helpers |
| `types.ts` | DB row type definitions |
| `index.ts` | Re-exports |

**Schema rule:** All table definitions live in `connection.ts`. Never define a table in a service file. New columns go through `migrations.ts`.

#### `src/services/addons/`
Stremio-compatible addon system.

| File | Purpose |
|---|---|
| `addon-manager.ts` | Addon lifecycle: install, remove, enable/disable, ordering |
| `client.ts` | Fetches catalog/meta/stream responses from addon URLs |
| `zentrio-client.ts` | Client for the Zentrio addon hub |
| `stream-processor.ts` | Normalizes and ranks stream results from multiple addons |
| `stream-cache.ts` | Caches stream results to avoid redundant addon calls |
| `stream-service.ts` | Orchestrates addon calls for stream resolution |
| `meta-service.ts` | Fetches metadata via addons |
| `meta-normalizer.ts` | Normalizes metadata from different addon formats |
| `content-filter.ts` | Filters content based on user preferences |
| `types.ts` | Shared addon type definitions |

#### `src/services/admin/`
Admin-only backend logic.

| File | Purpose |
|---|---|
| `rbac.ts` | RBAC: roles, permissions, role assignment |
| `stepup.ts` | Step-up OTP: generate, verify, invalidate challenges |
| `audit.ts` | Audit log: write and query audit events |

#### `src/services/hybrid-media/`
In-browser media transcoding pipeline using ffmpeg.wasm.

| File | Purpose |
|---|---|
| `HybridEngine.ts` | Orchestrates the full pipeline |
| `Demuxer.ts` | Splits container into A/V streams |
| `VideoRemuxer.ts` | Remuxes video to browser-compatible container |
| `AudioStreamTranscoder.ts` | Transcodes audio stream |
| `ChunkedAudioTranscoder.ts` | Chunked audio transcoding for long files |
| `StreamingAudioTranscoder.ts` | Streaming audio transcoding |
| `TranscoderService.ts` | High-level transcoder API |
| `NetworkReader.ts` | Reads media data from network URLs |
| `types.ts` + `index.ts` | Types and re-exports |

#### `src/services/tmdb/`
TMDB API integration. All TMDB calls go through here.

| File | Purpose |
|---|---|
| `client.ts` | Authenticated TMDB HTTP client (uses per-user API keys) |
| `catalog.ts` | Catalog/list queries |
| `meta.ts` | Movie/show metadata |
| `trending.ts` | Trending content |
| `search.ts` | Search |
| `episodes.ts` | Episode data |
| `genres.ts` / `languages.ts` / `age-ratings.ts` | Reference data |
| `logo.ts` | Content logo fetching |
| `mdblist.ts` | MDBList integration for curated lists |
| `cache.ts` | Response caching layer |
| `utils.ts` + `index.ts` | Utilities and re-exports |

#### `src/services/trakt/`
Trakt.tv integration.

| File | Purpose |
|---|---|
| `client.ts` | Trakt API HTTP client |
| `sync.ts` | Two-way watch history sync |
| `types.ts` + `index.ts` | Types and re-exports |

#### `src/services/downloads/`
| File | Purpose |
|---|---|
| `download-service.ts` | Download queue management (Tauri only) |

---

### `src/middleware/` — Hono middleware

| File | Purpose |
|---|---|
| `security.ts` | CORS, security headers (CSP, HSTS, etc.), rate limiter |
| `admin.ts` | `adminSessionMiddleware`: verifies admin session; `adminStepUpMiddleware`: enforces OTP challenge; `requirePermission(...)`: RBAC check |
| `session.ts` | Session validation for regular user routes |

All admin routes must use: `adminSessionMiddleware` → `requirePermission(...)`. Sensitive admin mutations must also use `adminStepUpMiddleware`.

---

### `src/lib/` — Frontend singletons and core utilities

These are the canonical client-side utilities. Do not duplicate them.

| File | Purpose |
|---|---|
| `auth-client.ts` | Better Auth client singleton with Tauri-aware `safeFetch` (injects Bearer tokens, routes through Tauri HTTP plugin). **The only place that calls Better Auth client methods.** |
| `apiFetch.ts` | Authenticated `fetch` wrapper for backend API calls. Injects Bearer token from auth store. Use this for all `/api/*` calls from client code. |
| `adminApi.ts` | Typed client for all `/api/admin/*` endpoints. Use this for all admin API calls. |
| `app-mode.ts` | Tracks guest vs. connected mode, stored in localStorage. |
| `app-lifecycle.tsx` | App startup logic: version checks, migration, splash screen. |
| `secure-storage.ts` | Abstraction over localStorage/Tauri store for sensitive data. |
| `url.ts` | URL construction utilities. |
| `addon-fetch.ts` | Platform-aware fetch for **external addon URLs**: Tauri → direct HTTP via `@tauri-apps/plugin-http` (no CORS), Web → routes through `/api/addon-proxy`. Use this instead of `apiFetch` when fetching from third-party Stremio addon URLs. |
| `addon-client.ts` | Client-side Stremio addon client (`ClientAddonClient`) with in-memory TTL cache. Use `getAddonClient(manifestUrl)` for a cached instance. `ZENTRIO_TMDB_ADDON = 'zentrio://tmdb-addon'` identifies the built-in TMDB addon — route it to `/api/tmdb/*` instead of fetching directly. |

**Rule:** Never call `fetch('/api/...')` directly in components or hooks. Use `apiFetch` or a typed client.

**Rule for addon fetching:** Use `addon-client.ts` / `addon-fetch.ts` for external Stremio addon URL calls. Never use raw `fetch()` for addon URLs on the client — CORS will block it in the browser. After fetching, call `POST /api/streaming/filter-enrich` to apply server-side parental filtering and watch history enrichment.

---

### `src/stores/` — Zustand global state

| File | Purpose |
|---|---|
| `authStore.ts` | Auth state: current user, session token, auth status. Persisted via localStorage. Source of truth for auth. |
| `downloadStore.ts` | Download queue and progress state (Tauri only). |

Use Zustand only for global client state that multiple unrelated components need. Do not create new stores without a clear need — check if an existing store can be extended.

---

### `src/hooks/` — React hooks

| File | Purpose |
|---|---|
| `usePlayer.ts` | Primary player state hook. Controls playback, volume, seek. |
| `useHybridPlayer.ts` | Manages the hybrid (ffmpeg.wasm) player engine. |
| `useExternalPlayer.ts` | Launches external player apps (VLC, Infuse, etc.) via Tauri. |
| `useSubtitles.ts` | Subtitle track loading and selection. |
| `useStreamLoader.ts` | Fetches and ranks stream sources from addons. |
| `useStreamDisplaySettings.ts` | User preferences for stream display (quality, lang filters). |
| `useLibraryData.ts` | Fetches and caches library (watchlist) data. |
| `useCatalog.ts` | Fetches catalog rows from TMDB/addons. |
| `useMeta.ts` | Fetches content metadata (movie/show details). |
| `useDownloads.ts` | Download queue state and actions. |
| `useAppearanceSettings.ts` | Reads/writes appearance settings. |
| `useLoginBehavior.ts` | Controls login redirect behavior. |
| `useAutoPlay.ts` | Auto-play next episode logic. |
| `useOfflineMode.ts` | Detects and reacts to offline state (Tauri). |
| `useSessionDuration.ts` | Tracks active session duration for analytics. |
| `useContextMenu.ts` | Context menu open/close state. |
| `useScrollRow.ts` | Horizontal scroll behavior for content rows. |
| `useLongPress.ts` | Long-press gesture detection. |

Before creating a new hook, check this list. If a hook with related functionality exists, extend it or compose it.

---

### `src/contexts/` — React contexts

| File | Purpose |
|---|---|
| `CastContext.tsx` | Chromecast session state and controls. |

---

### `src/utils/` — Frontend utility functions

| File | Purpose |
|---|---|
| `api.ts` | API response helpers (`ok()`, `err()`), request metadata extraction. |
| `client-logger.ts` | **The only logging utility for browser/client code.** Uses CSS devtools badge styling. Import as `createLogger('ScopeName')`. Never use `console.log` directly in component/hook code. |
| `performance.ts` | Performance measurement helpers. |
| `toast.ts` | Toast notification helpers (wraps sonner). Use for all user-facing notifications. |
| `route-preloader.ts` | Preloads lazy route chunks on hover/focus. |

---

### `src/pages/` — Page-level React components

Pages are lazy-loaded via `src/App.tsx`. They own layout and data-fetching orchestration for a route, but delegate UI to components and data to hooks.

| Directory | Pages |
|---|---|
| `/` root | `LandingPage`, `SettingsPage`, `ProfilesPage`, `ExploreAddonsPage`, `ShareInvitePage`, `ResetPasswordPage`, `TauriEntryPage` |
| `auth/` | `SignInPage`, `SignUpPage`, `TwoFactorPage` |
| `streaming/` | `Home`, `Explore`, `Catalog`, `Search`, `Details`, `Player`, `Library`, `Downloads`, `StreamingLayout` |
| `admin/` | `AdminLayout`, `DashboardPage`, `UsersPage`, `AuditPage`, `SystemPage` |

---

### `src/components/` — Reusable UI components

#### `auth/`
Auth flow components. `AuthGuards.tsx` contains `ProtectedRoute`, `PublicRoute`, `AdminGuard` — use these for all route protection.

#### `admin/`
`StepUpModal.tsx` — OTP challenge modal for step-up auth. Used inside `StepUpProvider` from `adminApi.ts`.

#### `details/`
Content detail page components: `DetailsHeader`, `EpisodeList`, `StreamSelector`.

#### `downloads/`
Download UI: `DownloadCard`, `DownloadProgress`, `StoragePanel`, `QualityPicker`, `OfflineBanner`.

#### `features/`
Reusable streaming feature components: `ContentCard`, `StreamingRow`, `Hero`, `InfoModal`, `ListSelectionModal`, `ProfileModal`, `SettingsProfileSelector`, `ShareListModal`, `CompactStreamItem`, `LazyCatalogRow`, `SearchCatalogRow`, `StreamRefreshButton`.

#### `layout/`
App shell: `Layout` (main wrapper), `Navbar`, `TitleBar` (Tauri custom title bar), `ErrorBoundary`.

#### `ScrollToTop.tsx` (components root)
Scroll-to-top utility rendered in the router. Not a page or layout component — do not move it into a subdirectory.

#### `library/`
Library (watchlist) UI components.

#### `onboarding/`
`OnboardingWizard` — first-run setup flow.

#### `player/`
Player UI and engine abstraction.

| File | Purpose |
|---|---|
| `ZentrioPlayer.tsx` | Main player component with controls UI |
| `engines/factory.ts` | Creates the correct engine based on platform/stream type |
| `engines/WebPlayerEngine.ts` | HLS.js-based web player |
| `engines/TauriPlayerEngine.ts` | Native Tauri player via shell commands |
| `engines/HybridPlayerEngine.ts` | ffmpeg.wasm hybrid engine |
| `engines/types.ts` | `PlayerEngine` interface — all engines must implement this |
| `hooks/usePlayerEngine.ts` | Manages engine lifecycle |

To add a new player engine: implement `PlayerEngine` interface, add detection logic to `factory.ts`.

#### `settings/`
Settings tab components. Each file corresponds to one settings section tab. Modals for email/password/username changes live in `settings/modals/`.

#### `ui/`
Generic design-system components. Check here before creating any new UI primitive.

- **Buttons/inputs:** `Button`, `Input`, `Toggle`, `DropdownMenu`, `ContextMenu`
- **Overlays:** `Modal`, `ConfirmDialog`, `InputDialog`
- **Loading states:** `LoadingSpinner`, `SkeletonRow`, `SkeletonHero`, `SkeletonDetails`, `SkeletonPlayer`, `SkeletonProfile`, `SkeletonStreamList`
- **Display:** `LazyImage`, `RatingBadge`, `Message`, `BackButton`, `LoadErrorState`, `SplashScreen`

#### `streaming/`
`StreamingLoaders.tsx` (loading skeletons for streaming pages), `TraktRecommendationsRow`.

---

### `src/components/auth/` — Auth components
| File | Purpose |
|---|---|
| `AuthForms.tsx` | Sign-in and sign-up form components |
| `AuthGuards.tsx` | `ProtectedRoute`, `PublicRoute`, `AdminGuard` — route-level access control |
| `ServerSelector.tsx` | Tauri server URL configuration UI |
| `MagicLinkModal.tsx` | Magic link login flow |
| `TwoFactorModal.tsx` / `TwoFactorSetupModal.tsx` | 2FA verification and setup |
| `PasswordResetModal.tsx` | Password reset flow |
| `EmailVerificationModal.tsx` | Email verification prompt (auth flow version — see also `settings/modals/EmailVerificationModal.tsx`) |
| `ModeSelector.tsx` | Guest vs. connected mode selection |
| `ServerConnectionIndicator.tsx` | Shows Tauri backend connection status |

---

## Canonical Patterns

### Logging

**Server code:**
```ts
import { logger } from '@/services/logger'
const log = logger.scope('FeatureName')
log.info('message')
log.error('failed', error)
```

**Client code:**
```ts
import { createLogger } from '@/utils/client-logger'
const log = createLogger('ComponentName')
log.info('message')
```

Never use `console.log`, `console.warn`, or `console.error` directly.

### Server state (data fetching)
Always use **TanStack Query** (`useQuery`, `useMutation`). Never use `useState` + `useEffect` to fetch data.

```ts
const { data, isLoading } = useQuery({
  queryKey: ['key', id],
  queryFn: () => apiFetch(`/api/resource/${id}`),
})
```

### Global client state
Use **Zustand** stores in `src/stores/`. Check existing stores before creating a new one.

### API calls from client
Always use `apiFetch` from `src/lib/apiFetch.ts` for authenticated requests.
Use `adminApi` from `src/lib/adminApi.ts` for admin endpoints.
Never call `fetch` directly in components or hooks.

### Toast notifications
```ts
import { toast } from '@/utils/toast'
toast.success('Saved')
toast.error('Failed to save')
```

### Tauri detection
```ts
import { isTauri } from '@/lib/auth-client'
if (isTauri()) { /* native-only code */ }
```

### Adding a new API route
1. Create or extend a file in `src/routes/api/`
2. Add business logic to `src/services/`
3. Mount the router in `src/routes/api/index.ts`
4. Add types/validation with Zod in the route handler

### Adding a new page
1. Create the page in `src/pages/`
2. Add a lazy route in `src/App.tsx`
3. Add a route guard if authentication is required

### Adding a new settings section
1. Create a component in `src/components/settings/`
2. Add the tab to `src/pages/SettingsPage.tsx`

---

## What NOT to Do

- **Do not create a new logger or logging wrapper.** Both server and client loggers already exist and are complete.
- **Do not use `fetch()` directly.** Use `apiFetch` or a typed client from `src/lib/`.
- **Do not put schema/table definitions anywhere except `src/services/database/connection.ts`.**
- **Do not add auth logic outside `src/services/auth.ts` and `src/lib/auth-client.ts`.**
- **Do not create helper files for one-off operations.** Inline the logic or extend an existing utility.
- **Do not use `useState` + `useEffect` for data fetching.** Use TanStack Query.
- **Do not create new Zustand stores without checking existing ones first.**
- **Do not import server-only code in client code and vice versa.** (No `envParser`, `bun:sqlite`, or `services/` imports in components/hooks.)
- **Do not add `console.log` calls.** Use the appropriate logger.
- **Do not add error handling for states that cannot occur.** Trust internal invariants.
- **Do not add comments explaining what the code does.** Only comment *why* when the reason is non-obvious.

---

## Environment Variables

The `.env` file lives in the **repository root** (not `app/`). `src/services/envParser.ts` reads it via `../` relative to `process.cwd()`. Never hardcode secrets or configuration values — always go through `getConfig()`.

See `.env.example` for the full reference.

---

## Known Duplication / Debt

These are known issues in the codebase that should be resolved, not replicated:

| Issue | Files | Action |
|---|---|---|
| Duplicate component | `src/components/auth/EmailVerificationModal.tsx` and `src/components/settings/modals/EmailVerificationModal.tsx` | Consolidate into one |

Run `bun run knip` from `app/` at any time to surface unused files and exports. The CI quality workflow runs knip automatically on every push/PR.

---

## Multi-Platform Notes

- `isTauri()` — use to gate any native-only behavior
- Tauri backend runs as a sidecar binary; the frontend connects via localhost
- Deep links (`zentrio://`) handle magic link and OAuth callbacks in native apps
- iOS support exists but is currently disabled in Tauri config
- Downloads feature is Tauri-only; web builds hide download UI
