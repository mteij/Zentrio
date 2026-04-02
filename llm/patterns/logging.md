# Logging

## Purpose

This file defines the only supported logging patterns in the repo.

## Read This When

Read this when adding or changing logging in server or client code.

## Canonical Truth

- Server logging uses `app/src/services/logger.ts`
- Client logging uses `app/src/utils/client-logger.ts`

## Rules

- Server code: `import { logger } from '@/services/logger'`
- Client code: `import { createLogger } from '@/utils/client-logger'`
- Do not add new logger abstractions
- Do not use raw `console.*` as the normal logging path

## See Also

- `llm/core/rules.md`
- `llm/domains/backend.md`
- `llm/domains/frontend.md`
