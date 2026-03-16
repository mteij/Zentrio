# Self Hosting

Zentrio ships as a single Bun server that serves both the API and the web app.

The repository already contains a root-level `docker-compose.yml` that matches the current image layout and volume paths, so that is the easiest starting point.

## Recommended: Docker Compose

From the repository root:

1. Copy `.env.example` to `.env`.
2. Fill in your secrets and API keys.
3. Start the stack with `docker compose up -d`.

Current compose file:

```yaml
services:
  zentrio:
    image: ${IMAGE_NAME:-ghcr.io/michieleijpe/zentrio:latest}
    build:
      context: ./app
      dockerfile: Dockerfile
    env_file:
      - .env
    environment:
      - PORT=${PORT:-3000}
      - DATABASE_URL=/data/zentrio.db
    ports:
      - "${HOST_PORT:-3000}:${PORT:-3000}"
    volumes:
      - zentrio_data:/data
    restart: unless-stopped
```

This stores the SQLite database in the named Docker volume `zentrio_data`.

## Direct Docker Run

If you prefer a single container command:

```bash
docker run -d \
  --name zentrio \
  -p 3000:3000 \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  -e TMDB_API_KEY="your-tmdb-api-key" \
  -e DATABASE_URL="/data/zentrio.db" \
  -v zentrio_data:/data \
  ghcr.io/michieleijpe/zentrio:latest
```

## Required Configuration

The `.env` file lives in the repository root, not `app/`.

At minimum, configure:

| Variable | Description |
| --- | --- |
| `AUTH_SECRET` | Secret used by Better Auth for session signing |
| `ENCRYPTION_KEY` | Secret used to encrypt sensitive data at rest |
| `TMDB_API_KEY` | Required for TMDB-backed metadata and catalogs |

Recommended production values:

```bash
openssl rand -base64 32
openssl rand -hex 32
```

## Core Server Settings

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port inside the container or process |
| `APP_URL` | `http://localhost:3000` | Public URL of your Zentrio server |
| `CLIENT_URL` | `http://localhost:5173` | Trusted frontend origin for local dev and auth redirects |
| `DATABASE_URL` | `./data/zentrio.db` | SQLite path. In Docker, map this to a persistent volume. |
| `NODE_ENV` | `development` | Set to `production` outside local dev |

## Email

Email is optional, but features like magic links, verification, password flows, and admin step-up work better with it configured.

You can configure SMTP, Resend, or both. In `EMAIL_PROVIDER=auto`, Zentrio prefers SMTP and falls back to Resend when SMTP is unavailable or failing.

### SMTP

| Variable | Default | Description |
| --- | --- | --- |
| `EMAIL_HOST` | - | SMTP host |
| `EMAIL_PORT` | `587` | SMTP port |
| `EMAIL_SECURE` | `false` | Use `true` for implicit TLS, usually port 465 |
| `EMAIL_USER` | - | SMTP username |
| `EMAIL_PASS` | - | SMTP password |
| `EMAIL_FROM` | `noreply@zentrio.app` | Sender address |

### SMTP URL

| Variable | Description |
| --- | --- |
| `SMTP_URL` | Full SMTP connection string, for example `smtp://user:pass@host:587` |

### Resend

| Variable | Description |
| --- | --- |
| `RESEND_API_KEY` | Resend API key |

Shared email tuning:

| Variable | Default | Description |
| --- | --- | --- |
| `EMAIL_PROVIDER` | `auto` | `auto`, `smtp`, or `resend`. `auto` prefers SMTP, then Resend |
| `EMAIL_SMTP_TIMEOUT_MS` | `8000` | SMTP connect/request timeout |
| `EMAIL_SEND_TIMEOUT_MS` | `10000` | Overall send timeout |
| `EMAIL_PROVIDER_BACKOFF_MS` | `300000` | How long a failed provider stays deprioritized before being preferred again |

## Admin and Health

| Variable | Default | Description |
| --- | --- | --- |
| `ADMIN_ENABLED` | `false` in code | Enables the admin console. The provided `.env.example` turns this on for easier first-time setup. |
| `ADMIN_SETUP_TOKEN` | - | Optional claim token for the first superadmin |
| `ANALYTICS_ENABLED` | `true` when admin is enabled | Aggregate platform/browser analytics in admin |
| `HEALTH_TOKEN` | - | Bearer token that unlocks internal health stats |

### First-time admin setup

1. Set `ADMIN_ENABLED=true`.
2. Restart the server.
3. Sign in.
4. Open `/admin`.
5. Claim superadmin access.

If `ADMIN_SETUP_TOKEN` is set, the setup flow also requires that token.

### Health endpoint

`GET /api/health` always returns safe public stats.

If you send:

```http
Authorization: Bearer <HEALTH_TOKEN>
```

the response also includes internal details like memory and active-session stats.

## Social Login / SSO

| Provider | Variables | Guide |
| --- | --- | --- |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | [Google guide](./self-hosting/sso/google.md) |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | [GitHub guide](./self-hosting/sso/github.md) |
| Discord | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | [Discord guide](./self-hosting/sso/discord.md) |
| OpenID Connect | `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_ISSUER`, `OIDC_DISPLAY_NAME` | [OIDC guide](./self-hosting/sso/openid.md) |

## Integrations

| Variable | Default | Description |
| --- | --- | --- |
| `TRAKT_CLIENT_ID` | - | Enables Trakt auth and sync |
| `TRAKT_CLIENT_SECRET` | - | Trakt secret |
| `FANART_API_KEY` | - | Optional artwork/logos |
| `IMDB_UPDATE_INTERVAL_HOURS` | `24` | IMDb ratings refresh interval |

## Logging and Rate Limiting

| Variable | Default | Description |
| --- | --- | --- |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `PROXY_LOGS` | `true` | Enables the Hono request logger |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window in milliseconds |
| `RATE_LIMIT_LIMIT` | `500` | Max requests per window per IP |

Set both rate-limit variables to `0` to disable the global limiter.

## Reverse Proxy

### Nginx

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

### Caddy

```txt
zentrio.example.com {
    reverse_proxy localhost:3000
}
```

## Notes for Native Clients

- Native Tauri clients can connect to a hosted Zentrio server in connected mode.
- Some native-only features, especially downloads, are not available from the web build.
- The local sidecar gateway is intentionally local-only; do not try to expose `/api/gateway` publicly behind your proxy.
