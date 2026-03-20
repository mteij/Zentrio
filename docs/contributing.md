# Contributing

## Before You Start

- Read [Local Setup](/development/local-setup)
- Read [Architecture](/development/architecture) if you are changing routes, services, platform logic, or native behavior
- Check existing issues or discussions before starting a large refactor

## Workflow

1. Fork [Mteij/Zentrio](https://github.com/Mteij/Zentrio) or create a branch if you already have write access.
2. Make one focused change.
3. Run the relevant checks.
4. Open a PR with enough context for review.

## Checks

From `app/`:

```bash
bun run type-check
bun run test
bun run lint
bun run knip
```

From `docs/`:

```bash
bun run build
```

## Pull Requests

Include:

- what changed
- why it changed
- any env, migration, or deployment impact
- what you tested

If your change affects setup, runtime behavior, or architecture, update the relevant docs in the same PR.
