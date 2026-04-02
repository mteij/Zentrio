# Add Page

## Use When

Use this when adding a new route-level screen or refactoring a route into a cleaner page structure.

## Read First

- `llm/core/rules.md`
- `llm/domains/frontend.md`
- `llm/domains/platform-targets.md`
- `llm/patterns/adaptive-screens.md`

## Steps

1. Put the route-level screen in `app/src/pages/`
2. Keep route orchestration at the page layer and reusable UI in `app/src/components/`
3. If the page serves both standard and TV surfaces, use the shared model plus `.standard.tsx` and `.tv.tsx` split
4. Keep data loading and route actions in the shared model when the backend contract is shared
5. Mount or update the route in `app/src/App.tsx`

## Done When

- the route is mounted
- page responsibilities are clear
- standard and TV rendering are split only when needed
- shared data logic is not duplicated across renderers
