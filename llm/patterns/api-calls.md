# API Calls

## Purpose

This file defines the transport boundary between internal API requests and third-party addon requests.

## Read This When

Read this when adding fetch behavior, client transport helpers, or server communication logic.

## Internal API Calls

- Use `apiFetch` or `apiFetchJson` from `app/src/lib/apiFetch.ts`
- Keep internal API behavior behind the shared client transport layer
- Do not call raw `fetch('/api/...')` from components or hooks

## External Addon Calls

- Use `app/src/lib/addon-client.ts` or `app/src/lib/addon-fetch.ts`
- Do not mix addon fetch logic into internal API helpers
- On web, direct fetch may fall back to `/api/addon-proxy` when CORS blocks the request

## Rules

- Internal backend routes and third-party addon URLs are different transport layers
- Components should consume the transport helpers, not reimplement them
- If a new transport rule affects multiple features, it belongs in `app/src/lib/`

## See Also

- `llm/domains/streaming.md`
- `llm/domains/frontend.md`
- `llm/playbooks/add-route.md`
