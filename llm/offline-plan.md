# Offline Compatibility Plan

## Goal

Make Zentrio behave correctly and gracefully across all platforms when network is unavailable or degraded.
This is not a "full offline app" — it is structured offline resilience that matches each platform's real capabilities.

## Platform Capability Matrix

| Platform | Can play offline? | Can download? | Primary risk |
|---|---|---|---|
| Web | No | No | Slow/dropped connection during browsing |
| Desktop (Tauri) | Yes (downloads) | Yes | User expects downloads to survive network loss |
| Mobile (Tauri) | Yes (downloads) | Yes | Most exposed — mobile networks drop constantly |
| TV (Tauri Android) | Yes (if enabled) | Opt-in | Hotel WiFi, dropped connections |

## Items

### 1. Query cache persistence — all platforms ✅ done
**Files:** `app/src/App.tsx`, `app/package.json`
**Packages:** `@tanstack/react-query-persist-client`, `@tanstack/query-sync-storage-persister`

Persist the TanStack Query in-memory cache to `localStorage` so stale data is shown immediately on reconnect or app reload instead of loading spinners.

Config:
- `maxAge: 24h` — don't show data older than a day
- `buster: __APP_VERSION__` — already defined in vite.config.ts, busts cache on deploy
- Opt-out per-query with `meta: { persist: false }` — used for auth session, admin endpoints

Effect: on cold start or reconnect, users see last-known catalog/library while fresh data loads in background. Especially valuable on TV (home screen appears instantly).

### 2. Reliable online detection — all platforms ✅ done
**Files:** `app/src/hooks/useOfflineMode.ts`

Replace bare `navigator.onLine` with a two-stage check:
- `offline` event → trust immediately (false negatives are safe)
- `online` event → verify with `HEAD /api/health` before marking online
- Android/TV: poll every 30s when `navigator.onLine === false` (Android drops without firing `online` event)

The health ping uses a 5s timeout and uses `window.fetch` directly (bypasses Tauri HTTP plugin to avoid token injection overhead on a lightweight check).

### 3. Offline watch progress queue — Tauri only ✅ done
**Files:** `app/src/lib/offline-progress-queue.ts` (new), `app/src/hooks/useOfflineMode.ts`

When a progress POST fails because the device is offline, push the attempt to a `localStorage` queue (`zentrio-progress-queue`). On reconnect, `useOfflineMode` flushes the queue in order.

Guarded with `isTauri()` — web has no offline playback so this never runs there.

Queue entry shape:
```ts
{ profileId: string, imdbId: string, type: string, season?: number, episode?: number, progress: number, duration: number, completed: boolean, timestamp: number }
```

### 4. Offline-aware stream selector — Tauri only ✅ done
**Files:** `app/src/components/details/StreamSelector.tsx`

When `!isOnline` on Tauri:
- If content is already downloaded → skip stream list, show single "Play downloaded version" button
- If not downloaded → replace stream list with "You're offline" message + Download button

Uses data already in `downloadStore` — no new fetching.
Web always shows the regular stream list (web has no offline playback so failing gracefully with the offline banner is sufficient).

### 5. Download badges on catalog cards — Tauri only ✅ done
**Files:** `app/src/components/features/LazyCatalogRow.tsx`

Cross-reference `downloadStore` on `imdbId` to show a small "Downloaded" indicator on cards. Zustand store is already available — subscribe to it.

Only rendered when `isTauri()`. No new data fetching.

### 6. Service worker for web app shell — web only ✅ done
**Files:** `app/vite.config.ts`, `app/package.json`
**Package:** `vite-plugin-pwa`

Cache only the app shell (HTML, JS, CSS bundles, fonts) with Workbox. API responses are NOT cached by the SW — the query persister (item 1) handles that layer.

Disabled in Tauri builds via `disable: isTauriBuild` in the plugin config. Tauri serves assets from its own bundle.

The existing `app/public/static/sw.js` unregisters any old SW — it stays as-is for legacy client cleanup.

## What is NOT in scope

- Web downloads (OPFS is not production-ready)
- Runtime API response caching in the service worker (cache invalidation is too fragile)
- Separate offline route tree (against ARCHITECTURE.md rules)
- DRM-aware license pre-fetching (not applicable to Zentrio's addon model)
- IndexedDB directly (the query persister handles this use case without the boilerplate)

## Implementation Order

1. Query cache persistence (highest impact, all platforms)
2. Reliable online detection (fixes silent failures on mobile/TV)
3. Offline watch progress queue (critical for downloaded content)
4. Offline-aware stream selector (fixes most confusing failure mode)
5. Download badges (discoverability)
6. Service worker for web (web resilience)
