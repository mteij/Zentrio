# LLM Guide

## Purpose

This is the entrypoint for AI instructions in this repository.
Read this file first, then load only the documents relevant to the task.

## Mandatory First Reads

1. `llm/core/rules.md`
2. `llm/core/repo-map.md`

Use `llm/reference/architecture-full.md` only when you need deeper background, full route maps, or detailed platform tables.

## Task Routing

- UI, routes, components, React state: `llm/domains/frontend.md`
- Backend routes, services, auth, admin: `llm/domains/backend.md`
- Tauri, Rust, plugins, native integration: `llm/domains/native.md`
- Web/Desktop/Mobile/TV behavior: `llm/domains/platform-targets.md`
- Addons, playback, stream resolution: `llm/domains/streaming.md`
- Adaptive standard/TV page split: `llm/patterns/adaptive-screens.md`
- Internal API and addon transport: `llm/patterns/api-calls.md`
- Database schema and migrations: `llm/patterns/database-changes.md`
- Logging rules: `llm/patterns/logging.md`

## Playbooks

- New API route: `llm/playbooks/add-route.md`
- New route screen or page split: `llm/playbooks/add-page.md`
- New Tauri command or plugin surface: `llm/playbooks/add-tauri-command.md`
- Schema update: `llm/playbooks/modify-schema.md`

## Structure Rules

- `llm/core/` holds repo-wide rules and layout truth
- `llm/domains/` holds bounded product areas
- `llm/patterns/` holds cross-cutting implementation rules
- `llm/playbooks/` holds repeatable workflows
- `llm/reference/` holds deep background docs
- `llm/plans/` holds temporary plans, not stable policy

## Maintenance Rules

- Keep one fact in one canonical file
- Link to other docs instead of restating them
- Keep non-reference files short and task-focused
- Promote stable guidance out of `llm/plans/`
- Delete completed plans unless they still guide active work

## Compatibility

`llm/ARCHITECTURE.md` remains as a compatibility stub that points here and to the full reference.
