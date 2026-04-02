# Native

## Purpose

This file covers the Tauri host, Rust-owned behavior, native plugins, and mobile or desktop native integration boundaries.

## Read This When

Read this for Tauri commands, sidecar behavior, Android or iOS native integration, plugin work, downloads, or OS-level features.

## Canonical Truth

- Native entrypoint: `app/src-tauri/src/lib.rs`
- Native Rust owns command registration, plugin registration, deep links, and OS integration
- Desktop production builds spawn the Bun sidecar from the native layer
- Native downloads belong in `app/src-tauri/src/downloads/`

## Native Boundaries

- Tauri commands belong in Rust or native plugin code, not in arbitrary TypeScript wrappers
- Android playback belongs in the ExoPlayer plugin path
- Android TV launcher publishing belongs in the Android launcher plugin
- Do not reimplement OS integration in TypeScript when a native boundary already exists

## Multi-Environment Behavior

- Tauri apps run the same React app with a native host around it
- Native auth flows rely on deep links such as `zentrio://`
- Platform-specific host decisions should surface through canonical helpers instead of scattered runtime checks

## When Adding Native Capability

- Put the real capability in the native layer
- Expose a narrow command or plugin API to TypeScript
- Keep client code focused on calling that API, not reproducing the native logic

## See Also

- `llm/domains/platform-targets.md`
- `llm/playbooks/add-tauri-command.md`
- `llm/reference/architecture-full.md`
- `llm/plans/android-tv.md`
