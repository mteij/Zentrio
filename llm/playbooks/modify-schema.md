# Modify Schema

## Use When

Use this when changing database tables, columns, indexes, or migration behavior.

## Read First

- `llm/core/rules.md`
- `llm/domains/backend.md`
- `llm/patterns/database-changes.md`

## Steps

1. Update the baseline schema in `app/src/services/database/connection.ts` when appropriate
2. Add migration logic in `app/src/services/database/migrations.ts`
3. Keep query helpers in the database layer
4. Update route or service callers to use the database layer instead of duplicating SQL

## Done When

- new installs get the right schema
- existing installs migrate safely
- callers use shared database-layer helpers
