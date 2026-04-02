# Adaptive Screens

## Purpose

This file defines the standard pattern for shared standard and TV route composition.

## Read This When

Read this when adding or refactoring pages that serve both standard and TV surfaces.

## Canonical File Pattern

- `<Page>.tsx` or `<Page>Route.tsx`: route wrapper only
- `<Page>.model.ts`: shared data, derived state, and route actions
- `<Page>.standard.tsx`: web, desktop, mobile renderer
- `<Page>.tv.tsx`: TV renderer

## Rules

- Route wrappers should call the shared screen model and render the adaptive boundary
- Keep fetching, mutations, navigation rules, and derived state in the model
- Keep standard-family rendering together unless product flow truly differs
- Move remote-first layout and focus behavior into the TV renderer
- If a page starts growing many `isTv` branches, split it instead of extending the inline branching

## Design Boundary

- Share models and backend contracts
- Separate renderers
- Avoid making every reusable component TV-aware

## TV Composition Guidance

- Prefer TV scaffolds, focus scopes, zones, grids, shelves, and dialogs
- Keep TV shell decisions out of the standard navbar and layout where possible

## See Also

- `llm/domains/frontend.md`
- `llm/domains/platform-targets.md`
- `llm/playbooks/add-page.md`
