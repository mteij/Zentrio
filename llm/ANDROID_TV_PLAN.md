# Android TV Plan

This plan is for running the existing Android APK on Android TV devices, including Chromecast with Google TV.

It is not a plan for the classic Google Cast sender/receiver flow.
The target is: install the APK on the TV, launch Zentrio there, and keep the codebase structured.

## Goal

Ship a TV-capable Android build without turning the frontend into a pile of `if (isTv)` branches, duplicated pages, or one-off CSS overrides.

## Non-Goals

- Do not build a legacy Chromecast receiver app first.
- Do not fork the whole app into a separate `app-tv/` project.
- Do not duplicate streaming/business logic for TV.

## Status Snapshot

Current implementation status in the repo:

- Phase 0: partially done
  - TV manifest bootstrap and banner resource are in place.
  - TV onboarding now uses a browser-mediated 6-digit pairing flow instead of trying to run the full provider login UX inside the TV app.
  - We still need a full Android TV install and launcher validation pass on emulator or hardware.
- Phase 1: done
  - `app-target` is the canonical target detector.
- Phase 2: partially done
  - `pages/tv/TvHome.tsx` and `components/tv/TvFocusable.tsx` exist.
  - The rest of the core screens still need TV shells or TV-specific hardening.
- Phase 3: partially done
  - basic focusable primitives exist
  - full D-pad traversal and remote-only QA are not finished
- Phase 4: not done enough
  - Android playback now runs through native ExoPlayer on both TV and phone/tablet.
  - Native back is modelled separately from natural media completion in the player engine contract.
  - The Android React player overlay is intentionally disabled while native ExoPlayer controls own the visible transport UI.
  - A richer TV-first custom control surface is still future work if we decide to replace native controls later.
- Phase 5: partially done
  - Watch Next bridge/plugin and deep-link plumbing exist
  - launcher behavior still needs emulator/device validation
- Phase 6: partially done
  - Home has a first TV shell
  - details, search, library, and settings still need more TV work
- Phase 7: not started in a real QA sense
  - we have not yet completed a dedicated emulator or physical-device certification pass

## Current Repo Reality

Useful starting points already exist:

- The Android manifest already includes `LEANBACK_LAUNCHER`.
- The app already has a custom player and a clear player-engine abstraction.
- Styling is already centralized enough to build on: CSS modules plus [`design-system.css`](/Users/Michi/Documents/GitHub/Zentrio/app/src/styles/design-system.css).
- The architecture doc already separates client, server, and native boundaries well.

Main gaps for Android TV right now:

- The React app is still touch/mobile/desktop-first, not D-pad/focus-first.
- The broader player and navigation model are not yet fully structured around remote control input outside the native ExoPlayer surface.
- Details, search, library, settings, and player still need TV-specific hardening.
- Remote compatibility has not been validated on an Android TV emulator or physical device yet.
- TV storage policy still needs deeper native work for external drives and adopted storage.

## Authentication Direction

Android TV should use a browser-mediated pairing flow instead of rendering the full sign-in provider matrix on TV.

Current implementation direction:

- the browser/web app owns the full login UX at `/activate`
- after browser sign-in, the server issues a short-lived 6-digit pairing code
- the TV app only asks for that code and redeems it through `/api/auth`

Why this is the preferred structure:

- it removes OAuth/browser handoff fragility on Google TV
- it keeps TV onboarding visually simple and remote-friendly
- it avoids cramming many SSO providers into a TV-first screen
- it reuses the existing browser auth surface instead of building a second auth stack

## Storage Policy

Android TV should not inherit the same offline-download defaults as phones and tablets.

Recommended product rule:

- keep offline downloads disabled by default on Android TV
- allow enabling them explicitly through the shared settings profile
- keep the decision profile-shared so multiple profiles using the same settings profile behave consistently

This avoids filling limited TV storage by accident while still giving power users a way to opt in.

Current implementation direction:

- the shared settings profile now owns an `offlineDownloads.allowOnTv` style capability flag
- TV UI reads a single capability helper instead of sprinkling `isTv` checks through download buttons and routes
- the Downloads screen should stay hidden or blocked on TV until that shared setting is enabled

External storage note:

- supporting USB drives or adopted storage is worth doing
- the current folder picker may work if Android exposes a writable path
- a proper Android TV external-storage flow is still a native feature, not just a frontend toggle

That future work likely means:

- detecting and listing eligible external storage roots on Android
- validating read/write access before switching the download directory
- handling cases where a drive is unplugged or not mounted on boot
- deciding whether we support only adopted storage, only removable storage, or both

## Recommended Architecture

Use one shared product with a small target layer.

### 1. Keep business logic shared

The following should stay shared across web, mobile, desktop, and TV:

- API calls
- addon resolution
- metadata loading
- auth/session logic
- stream resolution
- player engine selection
- watch progress/history/sync

TV should consume the same hooks and services, not reimplement them.

### 2. Add a target profile layer

Create one canonical target detector in `app/src/lib/`, for example:

- `app/src/lib/app-target.ts`

It should answer questions like:

- `isTv`
- `hasTouch`
- `primaryInput` (`touch` | `mouse` | `remote`)
- `supportsHover`
- `supportsOrientationLock`

Everything TV-specific should depend on this layer instead of hand-rolled checks spread across components.

### 3. Add TV shells, not TV forks

Prefer this structure:

- shared route/business pages stay in `app/src/pages/`
- TV-only route shells live in `app/src/pages/tv/`
- TV-only reusable UI lives in `app/src/components/tv/`

Pattern:

- shared hooks fetch data
- shared feature components render the content model
- TV shells decide layout, focus order, spacing, and remote-friendly controls

This avoids rewriting every page while still keeping TV layout decisions out of mobile/desktop components.

### 4. Centralize TV styling tokens

Do not add random `style={{}}` fixes or one-off per-page TV CSS.

Instead:

- add TV spacing/focus/scale variables to [`design-system.css`](/Users/Michi/Documents/GitHub/Zentrio/app/src/styles/design-system.css)
- keep TV component CSS local to `components/tv/` or `pages/tv/`
- add shared focus tokens once and reuse them everywhere

Examples of TV-only tokens:

- focus ring color
- focus scale amount
- card gap
- row height
- safe area padding
- overscan-safe margins

### 5. Treat focus/navigation as a first-class system

Android TV is D-pad first.
Do not bolt keyboard handlers onto random pages.

Build a small focus/navigation layer:

- focusable card/button primitives
- row/grid focus management
- back-button handling rules
- modal focus trapping
- initial-focus rules per screen

This should be the main architectural investment, because it is what prevents spaghetti later.

### 6. Keep the player architecture, add a TV control surface

Do not create a second playback stack for TV.

Instead:

- keep using the existing player engine abstraction
- keep Android playback on the shared `AndroidNativePlayerEngine`
- treat TV vs phone/tablet as a control-mode difference, not a playback-engine difference
- add a TV-friendly player shell/control layer only if native ExoPlayer controls stop being sufficient
- disable touch-only gestures on TV
- map remote buttons to player actions in one place

The player should become target-aware at the control layer, not split into unrelated playback implementations unless a real platform limit forces it.

### 7. Use launcher-standard integrations, not launcher-specific hacks

For launchers like Projectivy, the right integration path is the standard Android TV launcher surfaces:

- Watch Next / Continue Watching
- preview channels
- preview programs

We should not build a Projectivy-only integration first.
Instead, publish standard Android TV programs so any launcher that respects those surfaces can pick them up.

Important boundary:

- the source-of-truth for playback progress stays in Zentrio shared services
- publishing Home/Watch Next rows happens in the Android native layer

That means:

- React decides what the user is watching and the current progress
- shared services persist that progress
- an Android-specific bridge publishes or updates launcher entries

## Launcher Integration Strategy

The first launcher integration we should support is Continue Watching.

Reason:

- it is the highest-value launcher surface for a streaming app
- it maps directly to existing Zentrio watch progress/history data
- it improves both stock Android TV launchers and launcher alternatives that honor Android TV discovery APIs

Recommended implementation model:

### 1. Publish Watch Next entries from Android native code

Use Android TV Home APIs through `TvContractCompat` / `WatchNextProgram`.

This should live in Android-specific native code, not in random frontend utilities.

Likely implementation location:

- a new Android plugin/bridge adjacent to the existing immersive mode plugin
- Kotlin on the Android side
- exposed to TypeScript through a narrow command/plugin API

### 2. Keep one shared Continue Watching payload

Define one canonical app-level payload for launcher publishing, for example:

- internal content ID
- content type
- title
- description
- poster/background image
- deeplink intent URI
- duration
- playback position
- season/episode metadata when relevant
- last engagement timestamp
- watch-next type (`continue`, later possibly `next episode`)

This payload should be assembled from existing shared content/progress state, then handed to the native bridge.

### 3. Trigger launcher updates from canonical progress events

Do not update launcher rows from many screens independently.

Prefer a single launcher sync service that reacts to:

- playback start
- progress checkpoint updates
- playback stop/pause
- completion
- next episode transition
- removing an item from continue watching

### 4. Deep links must reopen the exact item

Launcher entries must open the app back into the correct content and resume context.

That means the launcher bridge needs stable deep links back into:

- movie details/player
- episode player
- continue playback position where applicable

### 5. Add channels later, after Watch Next works

Order of launcher work:

1. Watch Next / Continue Watching
2. one preview channel for recommended or recently added content
3. richer preview programs only after the basics are stable

This keeps the initial launcher integration useful without widening scope too early.

## Delivery Phases

### Phase 0: Android TV bootstrap

Make the APK recognizable and launchable as a TV app.

Tasks:

- update [`AndroidManifest.xml`](/Users/Michi/Documents/GitHub/Zentrio/app/src-tauri/gen/android/app/src/main/AndroidManifest.xml) to declare `android.hardware.touchscreen` with `required="false"`
- add an Android TV banner asset and wire `android:banner` on the application
- verify the launcher intent setup for TV remains correct
- verify Tauri Android packaging still installs cleanly on TV
- document `adb install` / testing flow for a TV device or emulator
- choose the Android native plugin boundary for launcher publishing so Watch Next does not become ad hoc frontend code

Exit criteria:

- APK installs on Android TV / Chromecast with Google TV
- app appears in the TV launcher
- app starts without touch-only assumptions on first screen

Current status:

- mostly implemented in code
- still blocked on actual Android TV emulator or hardware validation

### Phase 1: Canonical target detection

Add one shared target/capability module.

Tasks:

- create `app-target` detection in `app/src/lib/`
- expose a React hook/provider if needed
- replace ad hoc environment checks where TV logic would otherwise spread

Exit criteria:

- there is one canonical source for `isTv`
- new TV work does not depend on repeated user-agent checks in feature components

Current status:

- implemented

### Phase 2: TV app shell and layout system

Build the TV shell around shared content flows.

Tasks:

- add `pages/tv/` route shells
- add `components/tv/` primitives for navigation rail, rows, cards, dialogs, and focus states
- decide whether TV uses a dedicated entry route or a target-aware route shell around existing pages
- define shared TV design tokens in the design system

Recommended rule:

- page data stays shared
- page composition can differ on TV

Exit criteria:

- Home, details, library, and player can all render through a TV shell
- TV layout decisions live in TV shells/components, not mixed through all shared pages

Current status:

- TV home shell exists
- the rest of the screen set is still in progress

### Phase 3: D-pad and focus system

Make the app operable from a remote.

Tasks:

- implement focusable primitives
- define arrow-key/D-pad movement for rows, carousels, menus, and dialogs
- define default focus per screen
- define Back behavior consistently
- test all major flows without touch or mouse

Exit criteria:

- every visible control on core screens can be reached with a remote
- focus is always visible
- no screen traps the user

Current status:

- reusable focus primitives exist
- end-to-end remote traversal is not finished

### Phase 4: TV player experience

Make playback usable from the couch.

Tasks:

- add remote-friendly player controls
- move player input mapping into one TV control adapter
- disable gesture-based interactions on TV
- review fullscreen/orientation/mobile behavior so TV does not inherit mobile-only logic
- verify subtitle/audio/settings menus are focusable and readable from distance

Exit criteria:

- a user can start, pause, seek, change subtitles, and exit playback with only the remote

Current status:

- partially implemented
- Android playback backend is now the right shape: one native ExoPlayer path for all Android targets
- the remaining work is TV-first UX hardening, remote QA, and deciding whether the native controls are sufficient long-term

### Phase 5: Launcher integrations

Publish Zentrio content to Android TV launcher surfaces in a structured way.

Tasks:

- add a native Android TV launcher bridge/plugin
- define a canonical Continue Watching payload shared by the app
- publish Watch Next entries when playback is in progress
- update playback position and last engagement time as progress changes
- remove or complete entries when playback finishes
- verify launcher entries deep-link back into the correct content
- test on stock Android TV launcher and a launcher like Projectivy

Important note:

- Projectivy-specific behavior should be treated as compatibility testing, not the primary API design
- the primary integration target is the Android TV standard Watch Next / preview program model

Exit criteria:

- Continue Watching appears through launcher surfaces on supported devices/launchers
- selecting a launcher item returns the user to the right movie/episode and resume point
- launcher publishing logic is owned by one Android bridge, not spread across React screens

Current status:

- native/plugin and TypeScript sync path exist
- still needs launcher validation on emulator and hardware

### Phase 6: Core screen hardening

Bring the rest of the app up to TV quality.

Priority order:

1. Home
2. Details
3. Player
4. Search
5. Library
6. Settings

For each screen:

- remove touch-only affordances
- ensure readable typography at TV distance
- ensure cards, rows, and actions have clear focus states
- avoid dense settings layouts copied directly from mobile/desktop

Current status:

- started

### Phase 7: QA and release checklist

Tasks:

- test on Android TV emulator
- test on a physical Chromecast with Google TV / Android TV device
- test cold launch, login, browse, playback, subtitles, back navigation, and error states
- test with poor network conditions
- test with remote only, no mouse/touch
- test Continue Watching / Watch Next behavior after pause, resume, completion, and next episode transitions
- test launcher compatibility on stock launcher plus Projectivy if available

Release gate:

- do not call the target "supported" until the core flows pass on a real device

Current status:

- not started yet

## Concrete File Touch Points

Likely files/directories involved when implementation starts:

- [`AndroidManifest.xml`](/Users/Michi/Documents/GitHub/Zentrio/app/src-tauri/gen/android/app/src/main/AndroidManifest.xml)
- [`tauri.android.conf.json`](/Users/Michi/Documents/GitHub/Zentrio/app/src-tauri/tauri.android.conf.json)
- [`App.tsx`](/Users/Michi/Documents/GitHub/Zentrio/app/src/App.tsx)
- [`app/src/pages/streaming`](/Users/Michi/Documents/GitHub/Zentrio/app/src/pages/streaming)
- [`ZentrioPlayer.tsx`](/Users/Michi/Documents/GitHub/Zentrio/app/src/components/player/ZentrioPlayer.tsx)
- [`usePlayerEngine.ts`](/Users/Michi/Documents/GitHub/Zentrio/app/src/components/player/hooks/usePlayerEngine.ts)
- [`AndroidNativePlayerEngine.ts`](/Users/Michi/Documents/GitHub/Zentrio/app/src/components/player/engines/AndroidNativePlayerEngine.ts)
- [`design-system.css`](/Users/Michi/Documents/GitHub/Zentrio/app/src/styles/design-system.css)
- [`MainActivity.kt`](/Users/Michi/Documents/GitHub/Zentrio/app/src-tauri/gen/android/app/src/main/java/com/zentrio/mteij/MainActivity.kt)
- [`ExoPlayerPlugin.kt`](/Users/Michi/Documents/GitHub/Zentrio/app/src-tauri/gen/android/app/src/main/java/com/zentrio/mteij/ExoPlayerPlugin.kt)
- [`mod.rs`](/Users/Michi/Documents/GitHub/Zentrio/app/src-tauri/src/plugins/mod.rs)
- `app/src/pages/tv/` (new)
- `app/src/components/tv/` (new)
- `app/src/lib/app-target.ts`
- Android TV launcher bridge/plugin files under `app/src-tauri/`
- shared launcher sync service in `app/src/lib/`

## Guardrails To Prevent Spaghetti

- Never add TV-only styling directly into many unrelated shared components unless the component is truly shared and the style difference is token-based.
- Never introduce page-level business logic duplicates just because the TV layout differs.
- Never scatter `isTv` checks through hooks, services, and feature components when a shell or primitive can own the difference.
- Prefer shared data hooks plus target-specific composition.
- Prefer new TV primitives over patching every existing button/card with special cases.
- Never let launcher publishing logic be called directly from many pages; route it through one canonical sync path.

## Suggested First Milestone

The original first milestone has mostly been crossed. The next useful milestone is:

1. Validate the current Android TV APK end-to-end on emulator and hardware.
2. Confirm Watch Next / Continue Watching behavior on real launcher surfaces.
3. Harden TV details, search, library, and settings navigation for remote-only use.
4. Decide whether the native ExoPlayer control surface is good enough long-term or whether TV should get a custom React control shell on top of the same Android native playback engine.

That keeps the next work focused on validation and UX hardening instead of reopening the playback architecture we just simplified.

## Reference Docs

- Android TV app setup: https://developer.android.com/training/tv/get-started/create
- Android TV navigation: https://developer.android.com/training/tv/start/navigation
- Android TV focus system: https://developer.android.com/design/ui/tv/guides/styles/focus-system
- TV app quality: https://developer.android.com/docs/quality-guidelines/tv-app-quality
- Recommend content on the home screen: https://developer.android.com/training/tv/discovery/recommendations
- Add programs to Watch Next: https://developer.android.com/training/tv/discovery/watch-next-add-programs
- Watch Next attributes: https://developer.android.com/training/tv/discovery/watch-next-programs
- Home screen channels: https://developer.android.com/training/tv/discovery/recommendations-channel.html
