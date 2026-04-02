# Repo Map

## Purpose

This file maps the main repo directories and where new code usually belongs.

## Read This When

Read this when deciding where a change should live.

## Top-Level Directories

| Path | Purpose |
| --- | --- |
| `app/` | Main product code: frontend, backend, and native shell |
| `docs/` | Public VitePress documentation site |
| `landing/` | Marketing and landing pages |
| `llm/` | Internal AI instruction docs |

## Main Runtime Entry Points

| Context | Entry point | Purpose |
| --- | --- | --- |
| Server | `app/src/index.ts` | Bun server bootstrap |
| Client | `app/src/main.tsx` | React app bootstrap |
| Native | `app/src-tauri/src/lib.rs` | Tauri host bootstrap |

## Where Code Usually Goes

| Change | Place |
| --- | --- |
| New API behavior | `app/src/routes/api/` plus `app/src/services/` |
| Shared client transport/helper | `app/src/lib/` |
| Route-level screen | `app/src/pages/` |
| Reusable UI | `app/src/components/` |
| Global client state | `app/src/stores/` |
| Shared client hook | `app/src/hooks/` |
| Native capability | `app/src-tauri/src/` |
| Public documentation | `docs/` |
| AI instructions | `llm/` |

## Important Anchors

- `app/src/App.tsx`: client route tree and app orchestration
- `app/src/routes/api/index.ts`: API router mount point
- `app/src/lib/apiFetch.ts`: canonical internal API transport
- `app/src/lib/addon-fetch.ts`: canonical external addon fetch layer
- `app/src/lib/app-target.ts`: canonical target classification
- `app/src/lib/platform-capabilities.ts`: derived platform capability decisions
- `app/src-tauri/src/lib.rs`: native plugin and command registration

## Placement Rule

When in doubt, extend an existing layer instead of creating a new one.

## See Also

- `llm/domains/backend.md`
- `llm/domains/frontend.md`
- `llm/domains/native.md`
- `llm/reference/architecture-full.md`
