# Operations

This page covers the parts of running a Zentrio instance that matter after the server is online.

## Production Checklist

- Set a stable `APP_URL` that matches the URL users will visit
- Persist `DATABASE_URL` on a volume or durable disk
- Put the app behind a reverse proxy with HTTPS
- Configure email if you want magic links, verification, or password reset flows
- Enable admin access only when you actually need it
- Add SSO providers only after the base login flow works

## Admin and Health

| Variable | Default | Description |
| --- | --- | --- |
| `ADMIN_ENABLED` | `false` in code | Enables the admin console. The provided `.env.example` turns this on for easier first-time setup. |
| `ADMIN_SETUP_TOKEN` | - | Optional claim token for the first superadmin |
| `ANALYTICS_ENABLED` | `true` when admin is enabled | Aggregate platform and browser analytics in admin |
| `HEALTH_TOKEN` | - | Bearer token that unlocks internal health stats |

### First-Time Admin Setup

1. Set `ADMIN_ENABLED=true`.
2. Restart the server.
3. Sign in.
4. Open `/admin`.
5. Claim superadmin access.

If `ADMIN_SETUP_TOKEN` is set, the setup flow also requires that token.

### Health Endpoint

`GET /api/health` always returns safe public stats.

If you send:

```http
Authorization: Bearer <HEALTH_TOKEN>
```

the response also includes internal details like memory and active-session stats.

## Notes for Native Clients

- Native Tauri clients can connect to a hosted Zentrio server in connected mode.
- Some native-only features, especially downloads, are not available from the web build.
- The local sidecar gateway is intentionally local-only; do not try to expose `/api/gateway` publicly behind your proxy.
