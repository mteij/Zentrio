# Downloads Feature — Zentrio Design Plan

> **Decisions locked in:** Background downloads with OS notifications ✓ · HLS & DASH support ✓ · Custom storage location ✓ · Guest profiles can download ✓ · Stream source = same `http`/`debrid` URLs resolved by `StreamProcessor` ✓

A Netflix-inspired offline downloads system for the Zentrio Tauri app. The focus is on per-profile isolation, seamless offline playback, and clean UX — not visual cloning of Netflix.

---

## Philosophy & Inspiration from Netflix

Netflix's download model is worth studying, not for its look, but for its product decisions:

| Netflix decision                          | Why it's smart                              | Zentrio equivalent                              |
| ----------------------------------------- | ------------------------------------------- | ----------------------------------------------- |
| Per-profile download storage              | Prevents kids from deleting dad's shows     | Isolated download DBs per profile               |
| Quality selector (Standard / Higher)      | User controls storage vs. quality tradeoff  | Quality picker at download time                 |
| "Smart Downloads"                         | Auto-delete watched eps, auto-download next | Smart Downloads toggle per-profile              |
| Expiry on DRM content                     | Content licensing enforcement               | N/A (user's own addons — no expiry needed)      |
| "Downloads for you" row                   | Surfaced recommendations for downloading    | "Recommended to Download" row on Downloads page |
| Download progress inline on content cards | Ambient awareness of downloads              | Badge/ring progress overlay on cards            |
| Offline-only mode option                  | Forces offline content instead of streaming | Offline mode toggle in settings                 |

---

## Where to Put the Downloads Menu

### Decision: **A 5th Navbar item — `Downloads`**

The current Navbar has 4 items: **Home · Explore · Library · Search**. Downloads should live as a **permanent 5th tab** using the `Download` icon from `lucide-react`.

**Why not elsewhere?**

| Alternative            | Problem                                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Inside Library tab     | Downloads are not the same mental model as a watchlist/library. Library = "things I want to watch". Downloads = "things I can watch offline". |
| Settings sub-page      | Users won't find it when offline; too buried.                                                                                                 |
| Profile avatar menu    | Obscures discoverability; too many sub-actions already.                                                                                       |
| Floating action button | Non-standard, clashes with the nav paradigm.                                                                                                  |

**Navbar order:** Home · Explore · Library · **Downloads** · Search

The active indicator sliding animation in `Navbar.tsx` (`--active-index` CSS var) will accommodate the 5th item with zero styling changes to the animation logic.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Front-end (React/TS)                    │
│                                                         │
│  DownloadsPage  ←→  useDownloadStore (Zustand)          │
│                          ↕                              │
│            DownloadService (services/downloads/)        │
│  - enqueue / pause / resume / cancel / delete           │
│  - Tauri invoke calls to Rust                           │
└────────────────────────────┬────────────────────────────┘
                             │  tauri::invoke / tauri::event
┌────────────────────────────▼────────────────────────────┐
│              Tauri Rust Backend (src-tauri/src)          │
│                                                         │
│  download_manager.rs  — queue, async tokio worker pool  │
│  hls_dash_fetcher.rs  — HLS/DASH segment merging        │
│  download_db.rs       — SQLite per-profile metadata     │
│  download_events.rs   — progress, OS notifications      │
│  file_manager.rs      — paths, integrity, cleanup       │
│                                                         │
│  ↕ Continues running when app is backgrounded/minimized │
└─────────────────────────────────────────────────────────┘
                             │
                    Local Filesystem
        <os_data_dir>/zentrio/downloads/<profileId>/
        OR <custom_path>/zentrio/downloads/<profileId>/
```

---

## Data Model

### Download Record (SQLite, per-profile)

```typescript
interface DownloadRecord {
  id: string; // uuid
  profileId: number | string; // string for guest ('guest')
  mediaType: "movie" | "series";
  mediaId: string; // TMDB or addon ID
  episodeId?: string; // for series
  title: string;
  episodeTitle?: string; // "S1E3 - The Rains of Castamere"
  season?: number;
  episode?: number;
  posterPath: string; // cached locally
  backdropPath?: string; // cached locally
  status: DownloadStatus;
  progress: number; // 0-100
  quality: DownloadQuality;
  filePath: string; // absolute local path
  fileSize: number; // bytes (estimated if HLS/DASH)
  downloadedBytes: number;
  addedAt: number; // timestamp
  completedAt?: number;
  lastWatchedAt?: number;
  watchedPercent: number; // 0-100, for Smart Downloads
  streamUrl: string; // http/debrid URL from StreamProcessor
  streamFormat: "direct" | "hls" | "dash"; // detected from URL/Content-Type
  addonId: string; // which addon provided the stream
}

type DownloadStatus =
  | "queued"
  | "downloading"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

type DownloadQuality = "standard" | "higher" | "best";
```

---

## Feature Breakdown

### 1. Download Initiation

**Streams used:** The download engine takes the **same `http`/`debrid` stream URLs** resolved by `StreamProcessor` that are used for normal playback. The top-scored stream matching the quality preference is selected automatically.

**From the Details page** (movies & series):

- Movie: A `Download` button alongside `Watch` and `Trailer` CTA buttons.
- Series: A per-episode download icon in the episode list. Series Season download: a "Download Season" button that queues all episodes.
- Quality picker sheet appears before queuing (Standard ~720p · Higher ~1080p · Best = source quality). Last choice is remembered per-profile.
- **Guests** can download — their downloads use `profileId: 'guest'` and are stored under `/downloads/guest/`.

**From Content Cards** (on Home / Explore):

- Long-press context menu gains a **"Download"** option.

---

### 2. Downloads Page (`/streaming/:profileId/downloads`)

```
┌─────────────────────────────────────────────────────┐
│  Downloads                    [Manage Storage ⚙]    │
├─────────────────────────────────────────────────────┤
│  In Progress (2)                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ 🎬 Breaking Bad • S5E14 - Ozymandias  [===75%]│  │
│  │    Higher Quality • ~1.3 GB            [Pause]│  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │ 🎬 Oppenheimer                        [===42%]│  │
│  │    Standard Quality • ~600 MB          [Pause]│  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  Ready to Watch (6)                  [Sort ▾]       │
│  ┌────────────────────────────────────────────╮    │
│  │ [poster] Breaking Bad   S5 (3 episodes)   │    │
│  │          Higher • 3.9 GB        [▶] [···] │    │
│  ╰────────────────────────────────────────────╯    │
│  ┌────────────────────────────────────────────╮    │
│  │ [poster] Oppenheimer                      │    │
│  │          Standard • 598 MB      [▶] [···] │    │
│  ╰────────────────────────────────────────────╯    │
│                                                     │
│  Recommended to Download                            │
│  [card] [card] [card] [card] →                     │
└─────────────────────────────────────────────────────┘
```

**Sections:**

- **In Progress** — animated progress bars, pause/resume/cancel per item.
- **Ready to Watch** — grouped: movies flat, series grouped by show (collapsible). Sort by: Date Added · Title · Size.
- **Failed** — shown inline with a retry CTA, auto-collapses when all cleared.
- **Recommended to Download** — a horizontal row of suggested content (based on watchlist / history, computed locally) with a subtle "📥 Download" badge affordance.

---

### 3. Multi-Profile Isolation

- Each profile has a **completely separate download database** and a separate filesystem folder: `~/zentrio/downloads/<profileId>/`.
- The Downloads tab **only shows content for the current profile**. Switching profiles resets the view.
- Storage quota can be set **per-profile** (e.g., profile A gets 20 GB, profile B gets 10 GB). Default: unlimited.
- Profile deletion → all associated downloads and cached artwork are removed.
- **Parental control integration**: if a profile has an age limit set, downloading restricted content is blocked at the UI layer with a clear message.

---

### 4. Download Engine (Rust / Tauri Backend)

**Commands exposed via `tauri::command`:**

```rust
// Queue a new download
fn start_download(payload: StartDownloadPayload) -> Result<String, DownloadError>

// Control
fn pause_download(id: String) -> Result<(), DownloadError>
fn resume_download(id: String) -> Result<(), DownloadError>
fn cancel_download(id: String) -> Result<(), DownloadError>
fn delete_download(id: String) -> Result<(), DownloadError>

// Query
fn get_downloads(profile_id: String) -> Result<Vec<DownloadRecord>, DownloadError>
fn get_download_status(id: String) -> Result<DownloadRecord, DownloadError>

// Storage
fn get_storage_stats(profile_id: String) -> Result<StorageStats, DownloadError>
fn purge_all_downloads(profile_id: String) -> Result<(), DownloadError>
fn set_download_directory(path: String) -> Result<(), DownloadError>
fn get_download_directory() -> Result<String, DownloadError>
```

**Progress events via `tauri::emit_to`:**

```rust
// Emitted while downloading
{ event: "download:progress", payload: { id, progress, downloadedBytes, speed } }

// Emitted on state change
{ event: "download:status", payload: { id, status, filePath? } }

// Emitted on error
{ event: "download:error", payload: { id, error } }
```

**Concurrency:** Maximum **2 simultaneous downloads** (configurable in settings). Remaining items queue automatically.

**HLS / DASH support:**

- The engine inspects the URL or `Content-Type` response header to determine stream format.
- **HLS** (`.m3u8`): Fetches the master playlist → picks the highest bandwidth variant matching quality preference → downloads all `.ts` segments concurrently → merges into a single `.mp4` via remux (no re-encode).
- **DASH** (`.mpd`): Parses the manifest → selects the best video + audio representation → downloads segments → merges.
- **Direct** (`.mp4`, `.mkv`): Downloaded via chunked range requests, resumable.
- Rust crate: `m3u8-rs` for HLS parsing, `dash-mpd` for DASH. Output is always a single `.mp4`.

**Resumable downloads:** The engine uses `Range` HTTP headers to resume interrupted downloads. Partial files are stored as `.zentrio-part` until complete.

---

### 5. Offline Playback

- The `Player.tsx` page already accepts a stream source via route state / query params.
- For downloads, the player receives a `file://` URI pointing to the local `.mp4` / `.mkv` file.
- **No internet required** once the file is complete — the player works fully offline.
- The `Details.tsx` page shows a **"Downloaded"** badge and changes the CTA to **"Play Offline"** when a completed download exists for that content.
- Subtitle files (`.srt` / `.vtt`) are downloaded alongside the video when available.
- Guest profile downloads play back identically to authenticated profile downloads.

---

### 6. Smart Downloads

A per-profile toggle in Settings → Downloads:

> **Smart Downloads** — When you finish an episode, the next one automatically downloads. Watched downloads are removed to free space.

**Logic (runs at app launch and after playback ends):**

1. For each series with completed episodes and `watchedPercent >= 90`:
   - Mark episode as "watched".
   - If Smart Downloads is on: delete the watched episode file.
   - Auto-queue the next episode (same quality preference).
2. If storage is below a configurable threshold (default 500 MB), pause Smart Downloads and notify the user.

---

### 7. Storage Management Panel

Accessible via `[Manage Storage ⚙]` button on the Downloads page.

```
┌─────────────────────────────────────┐
│  Storage   [████████░░░░] 14.2/50GB  │
│  Profile: Alice                      │
│  ─────────────────────────────────── │
│  Downloads     11.8 GB  [Clear all] │
│  Cached Art     2.4 GB  [Clear]     │
│  ─────────────────────────────────── │
│  Smart Downloads        [Toggle ✓]  │
│  Quality Preference     [Higher ▾]  │
│  Download on WiFi only  [Toggle ✓]  │
│  Storage limit          [50 GB ▾]   │
│  Download Location      [Change ▸]  │
│    ~/AppData/Roaming/zentrio/...    │
└─────────────────────────────────────┘
```

**Download Location:** Defaults to the OS app data directory. Users can select a custom folder via a native folder picker (`tauri-plugin-dialog`). The chosen path is persisted in `localStorage` and synced to the Rust side on each app start.

---

### 8. Offline Mode Indicator

- **Network detection** runs continuously via `window.navigator.onLine` + Tauri's network plugin.
- Active downloads are **paused automatically** when offline and **resumed automatically** when the connection returns.
- When offline:
  - A subtle **"Offline"** pill appears in the top-right corner of the navbar.
  - Non-download pages (Home, Explore, Library) show a **"You're offline"** banner with a CTA to go to Downloads.
  - The Downloads page works completely — all data comes from local SQLite.
  - The Player works if stream source is a local `file://` URI.

---

---

## Background Downloads & OS Notifications

### Background Execution

Downloads must continue even when the user switches to another app or minimizes Zentrio. This is handled differently per platform:

| Platform                      | Strategy                                                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Desktop** (Win/macOS/Linux) | Rust `tokio` async worker threads continue running in the background naturally — the Tauri WebView being hidden does not affect them.                 |
| **Android**                   | Use `tauri-plugin-background-service` (or Android `WorkManager` via Tauri JNI bridge) to keep the download worker alive when the app is backgrounded. |
| **iOS**                       | Use `URLSessionDownloadTask` via a native Swift Tauri plugin — iOS's only approved way to background-download.                                        |

### OS Notifications

Download progress and completion are surfaced as **native OS notifications** using `tauri-plugin-notification`:

```
╔══════════════════════════════════════╗
║  Zentrio Downloads                   ║
║  Breaking Bad • S5E14               ║
║  [████████████░░░░░░░░] 75%  1.2MB/s║
╚══════════════════════════════════════╝
```

**Notification events:**

| Trigger                           | Notification                                                 |
| --------------------------------- | ------------------------------------------------------------ |
| Download starts                   | "Downloading: {title}"                                       |
| Every 10% progress (or every 30s) | Updates notification in-place with current % and speed       |
| Download completes                | "✓ Ready to watch: {title}" — tappable, opens Downloads page |
| Download fails                    | "⚠ Download failed: {title} — Tap to retry"                  |
| Queue complete (all done)         | "All downloads complete"                                     |

**Implementation:**

- Desktop: `tauri-plugin-notification` — supports updating an existing notification by ID (avoids spam).
- Android/iOS: Same plugin, which maps to native notification channels/categories.
- **Notification update strategy:** Rather than sending a new notification every few seconds, the Rust layer **updates the same notification** (same notification ID per download job) every 10% or 30s, whichever comes first. On platforms where in-place update isn't supported, the notification is replaced silently.
- The front-end continues to receive `download:progress` events for the in-app progress bars regardless of notification state.

---

## Frontend File Structure

```
app/src/
├── pages/streaming/
│   └── Downloads.tsx              ← Main downloads page
├── components/downloads/
│   ├── DownloadCard.tsx           ← Card for completed downloads
│   ├── DownloadProgress.tsx       ← In-progress item row
│   ├── StoragePanel.tsx           ← Storage management modal
│   ├── QualityPicker.tsx          ← Bottom sheet / modal for quality choice
│   └── OfflineBanner.tsx          ← "You're offline" banner component
├── services/downloads/
│   ├── download-service.ts        ← Tauri invoke wrappers
│   ├── notification-bridge.ts     ← Manages tauri-plugin-notification calls
│   ├── download-db.ts             ← (Rust-side; TS type definitions only)
│   └── offline-detector.ts        ← Network status monitoring hook
├── hooks/
│   └── useDownloads.ts            ← Query + event subscription hook
└── stores/
    └── downloadStore.ts           ← Zustand store for download state
```

---

## Backend File Structure (Rust)

```
app/src-tauri/src/
├── downloads/
│   ├── mod.rs
│   ├── manager.rs        ← Tokio worker pool, queue, pause/resume
│   ├── hls_dash.rs       ← HLS (.m3u8) and DASH (.mpd) segment fetcher/merger
│   ├── db.rs             ← SQLite metadata store (per-profile)
│   ├── events.rs         ← Tauri event emitters + OS notification updates
│   ├── notifier.rs       ← tauri-plugin-notification wrapper (update by ID)
│   └── file_store.rs     ← Path resolution, custom dir, integrity, cleanup
└── lib.rs                ← Register download commands + background service
```

---

## Routing Changes

### `App.tsx`

Add a new route under the streaming layout:

```tsx
<Route path="downloads" element={<StreamingDownloads />} />
```

### `StreamingLayout.tsx`

Add `'downloads'` to the `mainRoutes` array so the navbar is **not hidden** on the Downloads page:

```tsx
const mainRoutes = ["explore", "library", "search", "downloads"];
```

### `Navbar.tsx`

Add Downloads as the 4th item (before Search). The `--active-index` CSS var (`safeActiveIndex`) will correctly compute index 3 for Downloads with no changes to the animation:

```tsx
import { Download } from 'lucide-react'

// Insert between 'library' and 'search' in the items array:
{ to: `/streaming/${profileId}/downloads`, icon: Download, label: 'Downloads', path: '/downloads', ...downloadsPreloader }
```

---

## Offline Behaviour Summary

| Location          | Online                 | Offline                                       |
| ----------------- | ---------------------- | --------------------------------------------- |
| Home / Explore    | Full streaming content | "You're offline" banner + go to Downloads CTA |
| Library           | Watchlist from server  | Degraded (show cached data or empty)          |
| Downloads         | Full feature           | **Full feature** (all local)                  |
| Player (stream)   | Works                  | Error: no connection                          |
| Player (download) | Works                  | **Works** (local file)                        |
| Settings          | Works                  | Partially (no server sync)                    |

---

## Phased Rollout

### Phase 1 — Foundation

- [ ] Rust download engine: direct MP4/MKV chunked download, queue, pause/resume
- [ ] `DownloadRecord` SQLite schema (including `streamFormat` field)
- [ ] OS notifications via `tauri-plugin-notification` (start / progress / complete / fail)
- [ ] Background execution wiring (desktop: automatic; Android/iOS: background service)
- [ ] Basic `Downloads.tsx` page with "In Progress" + "Ready to Watch" sections
- [ ] Navbar: add Downloads tab
- [ ] Quality picker modal
- [ ] Download button on Details page (movies only, direct streams)
- [ ] Guest profile download support

### Phase 2 — HLS / DASH + Series

- [ ] HLS segment fetcher + `.ts` → `.mp4` merger (`hls_dash.rs`)
- [ ] DASH manifest parser + segment merger
- [ ] Auto-detect stream format from URL / `Content-Type`
- [ ] Per-episode download item in Details → Episode list
- [ ] "Download Season" bulk action
- [ ] Series-grouped card layout on Downloads page
- [ ] Smart Downloads toggle + logic

### Phase 3 — Offline UX

- [ ] Offline mode detection + banner + auto-pause/resume downloads
- [ ] "Play Offline" CTA on Details page when download exists
- [ ] Subtitle download support (`.srt` / `.vtt`)
- [ ] Offline mode badge in Navbar

### Phase 4 — Polish & Storage

- [ ] Storage Management panel with custom download location picker
- [ ] Per-profile storage quota
- [ ] "WiFi only" download preference
- [ ] "Recommended to Download" row
- [ ] Progress badge overlay on content cards

---
