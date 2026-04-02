# Streaming

## Purpose

This file covers addon fetching, stream resolution, playback engine ownership, and streaming-specific boundaries.

## Read This When

Read this for addon work, playback behavior, stream loading, subtitle flow, or streaming-specific product changes.

## Canonical Truth

- External addon requests go through `app/src/lib/addon-fetch.ts` or `app/src/lib/addon-client.ts`
- Main stream resolution now happens on the client through `app/src/lib/stream-resolver.ts`
- The legacy server SSE stream endpoint still exists for compatibility
- Playback engine selection lives in `app/src/components/player/engines/factory.ts`

## Addon Boundary

- Do not call addon URLs with raw `fetch()`
- Web tries direct addon fetch first and falls back to `/api/addon-proxy` when CORS blocks it
- Tauri uses direct HTTP for addon URLs
- TMDB addon traffic is special and maps through `/api/tmdb/*`

## Playback Boundary

- Browsers use web or hybrid playback depending on source type
- Desktop native uses the Tauri player engine
- Android and TV use the Android native player engine
- TV versus phone is a control-surface concern, not a separate playback stack by default

## Streaming Rules

- Keep addon transport separate from internal API transport
- Keep playback-engine decisions centralized in the engine factory
- Keep stream resolution and enrichment boundaries explicit
- Prefer shared media logic and target-specific UI shells

## See Also

- `llm/patterns/api-calls.md`
- `llm/domains/platform-targets.md`
- `llm/domains/frontend.md`
- `llm/reference/architecture-full.md`
