# Add Route

## Use When

Use this when adding a new backend API route or extending an existing router.

## Read First

- `llm/core/rules.md`
- `llm/domains/backend.md`
- `llm/patterns/api-calls.md`

## Steps

1. Add or extend the router under `app/src/routes/api/`
2. Keep validation in the route layer
3. Move reusable business logic into `app/src/services/`
4. Mount the router in `app/src/routes/api/index.ts` if it is new
5. Update any client transport or query usage to consume the route through shared helpers

## Done When

- the route is mounted correctly
- validation lives in the route layer
- reusable logic lives in services
- client callers use shared transport helpers
