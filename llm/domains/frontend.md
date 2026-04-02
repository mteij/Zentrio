# Frontend

## Purpose

This file covers the React app structure, route screens, shared client layers, stores, hooks, and component boundaries.

## Read This When

Read this for UI work, route changes, client state, or component design decisions.

## Canonical Truth

- Client entrypoints: `app/src/main.tsx` and `app/src/renderer.tsx`
- App orchestration lives in `app/src/App.tsx`
- Shared client transport and runtime helpers live in `app/src/lib/`
- Global state lives in `app/src/stores/`
- Route screens live in `app/src/pages/`
- Reusable UI lives in `app/src/components/`

## App Responsibilities

`app/src/App.tsx` owns:

- React Router route tree
- lazy page loading
- TanStack Query client setup
- native onboarding and connected-vs-guest flow
- deep-link handling for native auth flows
- route protection

## Client Layers

- `app/src/lib/`: API transport, auth client, addon transport, target detection, runtime helpers
- `app/src/stores/`: current global stores such as `authStore.ts` and `downloadStore.ts`
- `app/src/hooks/`: reusable client hooks, especially data and playback hooks
- `app/src/pages/`: route-level screens
- `app/src/components/`: reusable UI and feature components

## Frontend Rules

- Use TanStack Query for server state instead of ad hoc fetch state in components
- Check existing stores and hooks before adding new ones
- Keep route-level orchestration in pages and shared UI in components
- Keep app-wide transport rules in `app/src/lib/`, not spread across feature code

## Adaptive Screen Rule

- Standard web, desktop, and mobile rendering should stay together where practical
- TV-specific rendering should split into a dedicated renderer instead of growing many inline branches
- Read `llm/patterns/adaptive-screens.md` before changing shared standard/TV route composition

## See Also

- `llm/domains/platform-targets.md`
- `llm/domains/streaming.md`
- `llm/patterns/adaptive-screens.md`
- `llm/patterns/api-calls.md`
- `llm/playbooks/add-page.md`
