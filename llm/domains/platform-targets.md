# Platform Targets

## Purpose

This file defines platform classification and the product-level behavior differences between web, desktop, mobile, and TV.

## Read This When

Read this when a task depends on target detection, capability checks, TV behavior, native versus browser differences, or platform-specific UX.

## Canonical Truth

- `app/src/lib/app-target.ts` owns target classification
- `app/src/lib/platform-capabilities.ts` owns derived capability decisions
- Raw runtime detection belongs below those layers, not in screens

## Target Matrix

| Target | Kind | Primary input |
| --- | --- | --- |
| Web | `web` | `mouse` |
| Desktop | `desktop` | `mouse` |
| Mobile | `mobile` | `touch` |
| TV | `tv` | `remote` |

## Rules

- Do not replicate target detection logic outside the canonical helpers
- Ask capability questions instead of composing repeated runtime checks in components
- Keep standard-family rendering together when the difference is responsive layout or input affordances
- Split TV rendering when the difference is remote-first navigation and TV-distance readability

## Shared Target Guidance

- Web, desktop, and mobile usually share the standard renderer
- TV should get its own renderer and shell when focus, layout, or navigation materially differs
- Target-specific policy helpers should sit on top of app target and platform capability layers

## TV-Specific Rules

- Prefer explicit focus systems and deterministic back behavior
- Keep launcher publishing in native code
- Do not turn shared components into TV-aware switchboards when a TV shell can own the difference

## See Also

- `llm/patterns/adaptive-screens.md`
- `llm/domains/native.md`
- `llm/domains/streaming.md`
- `llm/plans/android-tv.md`
