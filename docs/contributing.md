# Contributing

Thanks for wanting to improve Zentrio.

## Before You Start

- Read [Development](/development) for local setup.
- Read `llm/ARCHITECTURE.md` if you are changing app structure, routing, services, or native behavior.
- Check open issues or discussions before starting a large refactor.

## Typical Workflow

1. Fork [Mteij/Zentrio](https://github.com/Mteij/Zentrio) or create a branch if you already have write access.
2. Create a focused branch, for example `feature/better-stream-filtering` or `fix/admin-health-docs`.
3. Make the smallest coherent change that solves the problem.
4. Run the relevant checks.
5. Open a PR with context, tradeoffs, and screenshots if the UI changed.

## Checks

From `app/`:

```bash
bun run type-check
bun run test
bun run lint
bun run knip
```

From `docs/` when changing the docs site:

```bash
bun run build
```

## What Good Contributions Look Like

- Thin route handlers, with logic moved into services when reusable
- Reuse of existing client transport helpers, hooks, and UI primitives
- Respect for server/client/native boundaries
- Updates to docs when behavior or setup changes
- Avoiding one-off abstractions when an existing file can be extended cleanly

## Pull Request Notes

Please include:

- what changed
- why it changed
- any migration, env, or deployment impact
- what you tested

If your change affects setup, runtime behavior, or architecture, update the relevant docs in the same PR.
