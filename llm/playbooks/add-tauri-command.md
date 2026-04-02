# Add Tauri Command

## Use When

Use this when introducing a new native capability, plugin call, or Rust-owned command surface.

## Read First

- `llm/core/rules.md`
- `llm/domains/native.md`
- `llm/domains/platform-targets.md`

## Steps

1. Implement the real capability in Rust or native plugin code under `app/src-tauri/`
2. Register the command or plugin in the native layer
3. Expose a narrow TypeScript-facing API for the client to call
4. Keep platform checks and calling semantics in shared helpers instead of scattering them across screens
5. Update the consuming UI or services to use that helper

## Done When

- native logic lives in the native layer
- TypeScript uses a narrow bridge API
- platform-specific calling logic is centralized
