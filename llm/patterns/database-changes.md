# Database Changes

## Purpose

This file defines the canonical process for schema changes and database-layer updates.

## Read This When

Read this when adding tables, columns, indexes, or database-backed server behavior.

## Rules

- Baseline schema belongs in `app/src/services/database/connection.ts`
- Migration logic belongs in `app/src/services/database/migrations.ts`
- Query logic belongs in the database service layer
- Do not place schema changes or ad hoc SQL in unrelated files

## Workflow

1. Update `connection.ts` if the baseline schema should include the new shape
2. Add or update migration logic in `migrations.ts`
3. Keep query helpers inside the database layer
4. Update routes or services to consume the database layer instead of inlining SQL

## Done When

- new installs get the correct schema
- existing installs upgrade through migrations
- calling code uses the database layer instead of duplicating queries

## See Also

- `llm/domains/backend.md`
- `llm/playbooks/modify-schema.md`
