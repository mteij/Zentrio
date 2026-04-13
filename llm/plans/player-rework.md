# Player Rework Plan

Read `llm/README.md`, `llm/domains/native.md`, and `llm/plans/android-tv.md` before executing this plan.

## Goal

One React-driven player UI across all platforms (web, desktop, iOS, Android phone, Android TV).

The playback backend stays platform-specific — ExoPlayer decodes on Android, system decoders on Tauri desktop/iOS, HLS.js on web. Only the control surface is unified.

## Non-Goals

- Do not replace ExoPlayer as the Android decoder. It stays as the playback backend.
- Do not port the player to a separate UI framework.
- Do not create a second player component — `ZentrioPlayer` is the single source of truth for controls.
- Do not change the web or desktop/iOS player paths — they already work correctly.

## Current State

### Rendering stack (Android today)

```
Android Window
  └── Root ViewGroup
        ├── Tauri WebView  (React app — ZentrioPlayer mounted but self-disabled)
        └── ExoPlayer FrameLayout overlay  (elevation=9999f, on top of everything)
              └── PlayerView (SurfaceView + native ExoPlayer controls)
```

`ZentrioPlayer.tsx:171` detects Android with `usesNativePlaybackUi` and disables the React control shell entirely. ExoPlayer's own `PlayerView` renders both video and controls.

### Rendering stack (target)

```
Android Window
  └── Root ViewGroup
        ├── ExoPlayer FrameLayout  (z=0, behind WebView, TextureView for video, no native controls)
        └── Tauri WebView  (transparent background in player mode)
              └── React ZentrioPlayer  (controls + subtitles render over video)
```

ExoPlayer keeps decoding. The WebView sits on top with a transparent background, so the React player shell renders over the video.

## Architecture

### Engine responsibilities (unchanged)

| Engine | Platform | Responsibility |
|--------|----------|---------------|
| `WebPlayerEngine` | Browser | HLS.js + native `<video>` |
| `TauriPlayerEngine` | Desktop, iOS | System decoders via Tauri WebView |
| `HybridPlayerEngine` | Browser (rare codecs) | MSE-based transcoding |
| `AndroidNativePlayerEngine` | Android phone + TV | ExoPlayer bridge via Tauri Channel |

No engine is replaced. `AndroidNativePlayerEngine` gains two capabilities: WebView transparency coordination and sidecar subtitle delivery.

### Why TextureView over SurfaceView

Android's `SurfaceView` renders in a separate hardware compositor layer that does not respect the standard View z-order or elevation system. Overlaying the Tauri WebView on top of a `SurfaceView`-backed ExoPlayer produces a black hole or compositing artifact.

`TextureView` renders as a normal GPU texture in the View hierarchy, respects z-order, and allows the WebView to composite over it correctly. The performance cost is negligible for streaming video at standard bitrates.

## Phases

### Phase 1: ExoPlayer below WebView (Kotlin)

**File:** `ExoPlayerPlugin.kt`

Changes:

1. **Switch to TextureView** — call `setUseTextureView(true)` on `PlayerView` before attaching the player
2. **Disable native controls** — change `useController = true` to `useController = false`; remove all `setShow*Button` calls
3. **Remove elevation** — remove `elevation = 9999f` from the overlay `FrameLayout`
4. **Insert overlay behind WebView** — change `root.addView(overlay)` to `root.addView(overlay, 0)` so it is placed at index 0, behind the Tauri WebView
5. **Add `exo_player_set_webview_transparent` command** — finds the first `WebView` in the root view hierarchy and calls `setBackgroundColor(Color.TRANSPARENT)` or `setBackgroundColor(Color.BLACK)` to toggle player mode
6. **Add `exo_player_add_sidecar_subtitles` command** — accepts an array of `{ url, language, label, mimeType }` objects, pauses, rebuilds the `MediaItem` with `SubtitleConfiguration` entries, seeks back to current position, and resumes
7. **Remove `isTv` from `ExoPlayArgs`** — no longer needed to differentiate controls (both TV and phone now get no native controls)
8. **Increase progress timer to 250ms** — halve the interval from 500ms to 250ms for a smoother React scrubber

Exit criteria:
- ExoPlayer video renders visibly in the background with the WebView layered on top
- No native ExoPlayer controls visible
- Hardware back key still fires `{type: "back"}` event to JS (Kotlin back handler remains)

### Phase 2: AndroidNativePlayerEngine update (TypeScript)

**File:** `app/src/components/player/engines/AndroidNativePlayerEngine.ts`

Changes:

1. **WebView transparency on `loadSource`** — after `invoke('exo_player_play', ...)` resolves, invoke `exo_player_set_webview_transparent({ transparent: true })`
2. **WebView restore on `destroy`** — call `exo_player_set_webview_transparent({ transparent: false })` in `destroy()`
3. **Implement `addSubtitleTracks`** — map `SubtitleTrack[]` to the subtitle config shape and invoke `exo_player_add_sidecar_subtitles`. Map `SubtitleTrack.src` as the URL, infer MIME type from extension (`.vtt` → `text/vtt`, `.srt` → `application/x-subrip`)
4. **Remove `isTv` from play args** — the new Kotlin side no longer uses it for control mode

Exit criteria:
- WebView becomes transparent when playback starts, opaque when player is destroyed
- External subtitle tracks from addons are passed to ExoPlayer and appear in its internal track list

### Phase 3: ZentrioPlayer — remove Android bypass (TypeScript)

**Files:** `ZentrioPlayer.tsx`, `ZentrioPlayer.module.css`, `Player.module.css`

Changes:

1. **Remove `usesNativePlaybackUi`** — delete the flag on line 171 and all branches that skip rendering controls when it is true
2. **Hide the `<video>` element on Android native** — add a CSS class `.androidNativeEngine` to the player container when the active engine is `android-native`. Apply `visibility: hidden` (not `display: none`, to keep layout stable) to the `<video>` element within that class. ExoPlayer renders the video surface; the `<video>` element is unused.
3. **Transparent container on Android native** — add `background: transparent` to the player container under `.androidNativeEngine` so the ExoPlayer video below the WebView is visible
4. **Expose engine type to container** — `usePlayerEngine` already knows `engineTypeRef.current`; surface it as a stable value in the hook return (`activeEngineType: EngineType`) and use it in `ZentrioPlayer` to apply the class
5. **Verify touch gestures** — the existing touch gesture handlers (swipe to seek, swipe up/down for volume) already work on Android via the HTML pointer/touch events; confirm they fire correctly over the transparent WebView

Exit criteria:
- React player controls are visible and functional on Android phone
- Video surface (rendered by ExoPlayer below) shows through the WebView
- Subtitles, audio track menu, find-new-stream, episode nav all work on Android

### Phase 4: Player.tv.tsx — full TV implementation (TypeScript)

**File:** `app/src/pages/streaming/Player.tv.tsx`

Replace the current 8-line stub with a full implementation.

Layout: full-screen, D-pad-first, no touch gesture zones.

Structure:
```
TvFocusProvider
  └── TvFocusZone (full player area)
        ├── Video surface (transparent <div> over ExoPlayer video)
        ├── Controls bar (shown/hidden based on D-pad activity)
        │     ├── TvFocusItem — Back button
        │     ├── TvFocusItem — Seek -10s
        │     ├── TvFocusItem — Play/Pause
        │     ├── TvFocusItem — Seek +10s
        │     ├── TvFocusItem — Subtitles menu
        │     └── TvFocusItem — Episode nav (prev/next)
        ├── Progress bar (D-pad left/right = seek)
        ├── Subtitle/Audio track modal (TvFocusZone)
        └── Next episode popup (TvFocusZone)
```

Key behaviors:
- Controls auto-hide after 4 seconds of D-pad inactivity; any D-pad press shows them
- Select/OK on the video area (when controls hidden) → show controls
- Back button: if controls visible → hide controls; if controls hidden → exit player
- Left/right D-pad on progress bar: seek ±30s per step
- D-pad focus memory: last focused control is restored when controls reappear

Reuse from `ZentrioPlayer`:
- `usePlayerEngine` hook (all engine state and controls)
- Progress saving, Trakt, launcher sync callbacks live in `Player.standard.tsx`'s model; `Player.tv.tsx` consumes the same `PlayerScreenModel` and forwards the same callbacks to `usePlayerEngine`

Exit criteria:
- All core player actions reachable with remote only
- Focus always visible and never trapped
- Subtitles and audio track selection work on TV

### Phase 5: Input handling cleanup (TypeScript)

**File:** `ZentrioPlayer.tsx`

After Phase 3 unblocks Android, audit and gate input handlers by `primaryInput`:

- **Touch swipe gestures** (seek, volume): only activate when `appTarget.primaryInput === 'touch'`
- **Mouse hover controls**: already gated by CSS `:hover`; confirm no pointer event listeners fire on remote/D-pad
- **Keyboard shortcuts** (space = play/pause, arrow keys = seek): keep for `mouse` and `web` targets; skip on TV (TV uses Phase 4's D-pad controls, not the keyboard path)
- **Double-tap to seek**: only on `touch`

This is a refinement pass; no behavioral changes to web or desktop.

### Phase 6: QA matrix

Test each platform through the full playback flow:

| Platform | Engine | UI component | Input |
|----------|--------|--------------|-------|
| Web browser | Web / Hybrid | `ZentrioPlayer` | Mouse + keyboard |
| Desktop (Tauri) | Tauri | `ZentrioPlayer` | Mouse + keyboard |
| iOS | Tauri | `ZentrioPlayer` | Touch gestures |
| Android phone | AndroidNative | `ZentrioPlayer` | Touch gestures |
| Android TV | AndroidNative | `Player.tv.tsx` | D-pad / remote |

For each:
- Cold launch → play → pause → seek → subtitle switch → audio track switch → exit
- Episode navigation (TV series)
- Offline/downloaded content
- Find New Stream
- Next episode auto-play
- Progress is saved and resumes correctly
- Trakt scrobble fires correctly
- Launcher Watch Next entries update (Android TV only)

## File Touch Points

```
app/src-tauri/gen/android/.../ExoPlayerPlugin.kt   ← Phase 1
app/src/components/player/engines/AndroidNativePlayerEngine.ts  ← Phase 2
app/src/components/player/hooks/usePlayerEngine.ts  ← Phase 3 (surface activeEngineType)
app/src/components/player/ZentrioPlayer.tsx         ← Phase 3
app/src/styles/ZentrioPlayer.module.css             ← Phase 3
app/src/pages/streaming/Player.tv.tsx               ← Phase 4
app/src/pages/streaming/Player.tv.module.css        ← Phase 4 (new)
```

## Guardrails

- Never re-introduce `usesNativePlaybackUi` or any equivalent Android-bypass flag.
- Never put D-pad controls in `ZentrioPlayer` — that component owns touch/mouse surfaces; D-pad is in `Player.tv.tsx`.
- Never call `setBackgroundColor` or `setBackgroundResource` on the Tauri WebView from React-land — that is a Kotlin concern, done via the new `exo_player_set_webview_transparent` command.
- Never use `SurfaceView` for ExoPlayer in the React-UI path — always `TextureView`.
- Never add subtitle rendering to a second React layer on Android — deliver subtitles to ExoPlayer via `exo_player_add_sidecar_subtitles` and let ExoPlayer render them natively into its `TextureView`.

## Ordering note

Phases 1–3 are a single atomic change: if Phase 1 is done without Phase 3, ExoPlayer controls disappear and nothing replaces them. Ship Phases 1, 2, and 3 together. Phase 4 (TV) and Phase 5 (input cleanup) can ship independently after.
