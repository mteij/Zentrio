Welcome to release `v0.6.1` of Zentrio. This patch is headlined by Intro skipping powered by IntroDB, with supporting improvements across streaming and playback, the app interface, and the desktop runtime that make playback and day-to-day usage feel more complete.

## Highlights
- TV playback can now surface skip controls for intros, recaps, and outros using IntroDB segment data.
- Streaming and playback picked up the most visible polish in this release.
- Interface polish picked up the most visible polish in this release.
- Desktop runtime polish was a major focus for fixes and day-to-day reliability.

### Intro skipping powered by IntroDB
Zentrio now fetches episode segment timings from IntroDB, caches them server-side, and feeds them into the player so users can skip intros, recaps, and outros more cleanly. Streaming settings also expose controls for unconfirmed segments, and contributors can submit better timings directly from the app with an IntroDB API key.

### Streaming and playback
This release puts visible polish into streaming and playback. The busiest files were `app/src/components/player/ZentrioPlayer.tsx`, `app/src/components/settings/StreamingSettings.tsx`, and `app/src/routes/api/streaming.ts`, so users should notice a cleaner or more predictable experience in those surfaces.

### Interface polish
This release puts visible polish into the app interface. The busiest files were `app/src/styles/ZentrioPlayer.module.css`, so users should notice a cleaner or more predictable experience in those surfaces.

## What's Changed
### Features
- Added IntroDB-backed segment support so TV episodes can offer skip intro, recap, and outro controls, with caching and in-app contribution support.

### Fixes
- Desktop runtime polish: reliability work landed around the desktop runtime.
- Backend service reliability: reliability work landed around backend services.
- Core app behavior: reliability work landed around core product flows.

### UI / UX
- Streaming and playback: visible polish touched streaming and playback.
- Interface polish: visible polish touched the app interface.

### Under the Hood
- Release tooling: internal work tightened up release delivery.
- Architecture updates: internal work tightened up documentation.

## Contributors
Thanks to @mteij.

Full Changelog: https://github.com/mteij/Zentrio/compare/v0.6.0...v0.6.1