# Self-Hosting

## Docker

```bash
docker run -d --name zentrio \
  -e AUTH_SECRET=$(openssl rand -base64 32) \
  -e ENCRYPTION_KEY=$(openssl rand -hex 32) \
  -e TMDB_API_KEY="your-tmdb-api-key" \
  -e DATABASE_URL="./data/zentrio.db" \
  -e ADMIN_ENABLED=true \
  -p 3000:3000 \
  -v ./data:/app/data \
  ghcr.io/mteij/zentrio:latest
```

## Docker Compose

```yaml
services:
  zentrio:
    image: ghcr.io/mteij/zentrio:latest
    container_name: zentrio
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - AUTH_SECRET=change_me          # openssl rand -base64 32
      - ENCRYPTION_KEY=change_me       # openssl rand -hex 32
      - TMDB_API_KEY=your-tmdb-api-key
      - DATABASE_URL=./data/zentrio.db
      - ADMIN_ENABLED=true
    volumes:
      - ./data:/app/data
```

---

## Environment Variables

> See [`.env.example`](../.env.example) for a ready-to-copy template with all options.

### Required

| Variable | Description |
|---|---|
| `AUTH_SECRET` | Secret for signing session tokens. Generate: `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | 32+ char key for data encryption. Generate: `openssl rand -hex 32` |
| `TMDB_API_KEY` | TMDB API key for media metadata ([get one here](https://www.themoviedb.org/settings/api)) |

### Server

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `APP_URL` | `http://localhost:3000` | Public-facing URL of the server |
| `CLIENT_URL` | `http://localhost:5173` | Frontend URL (used for CORS and OAuth redirects) |
| `DATABASE_URL` | `./data/zentrio.db` | SQLite database path |
| `NODE_ENV` | — | Set to `production` for production deployments |

### Email

Pick **one** provider. Leave all unconfigured to disable email.

**SMTP:**

| Variable | Default | Description |
|---|---|---|
| `EMAIL_HOST` | — | SMTP hostname |
| `EMAIL_PORT` | `587` | SMTP port |
| `EMAIL_SECURE` | `false` | Use TLS (`true` for port 465) |
| `EMAIL_USER` | — | SMTP username |
| `EMAIL_PASS` | — | SMTP password |
| `EMAIL_FROM` | `noreply@zentrio.app` | Sender address |

**SMTP URL** (alternative to individual fields):

| Variable | Description |
|---|---|
| `SMTP_URL` | Full SMTP connection URL, e.g. `smtp://user:pass@host:587` |

**Resend:**

| Variable | Description |
|---|---|
| `RESEND_API_KEY` | [Resend](https://resend.com) API key (free tier: 3 000 emails/month) |

| Variable | Default | Description |
|---|---|---|
| `EMAIL_PROVIDER` | `auto` | Force provider: `auto`, `smtp`, or `resend` |

### Social Login / SSO

| Provider | Variables | Setup Guide |
|---|---|---|
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | [Guide](./self-hosting/sso/google.md) |
| GitHub | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | [Guide](./self-hosting/sso/github.md) |
| Discord | `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | [Guide](./self-hosting/sso/discord.md) |
| OIDC | `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_ISSUER`, `OIDC_DISPLAY_NAME` | [Guide](./self-hosting/sso/openid.md) |

### Admin Console

| Variable | Default | Description |
|---|---|---|
| `ADMIN_ENABLED` | `false` | Enable the admin console |
| `ADMIN_SETUP_TOKEN` | — | Optional token required to claim initial superadmin. If unset, any user can claim on a fresh instance. Generate: `openssl rand -hex 24` |
| `STEP_UP_MAX_AGE_MINUTES` | `10` | How long a step-up verification is valid for sensitive actions |

#### First-time setup

1. Set `ADMIN_ENABLED=true` and restart.
2. Sign in to your account, then navigate to `/admin`.
3. Click **Claim Admin Access** to become the superadmin.
4. The setup endpoint closes permanently — no other user can claim it after you.

Once set up, you can promote other users to `admin`, `moderator`, or `readonly` roles from the admin panel. Each role has different permissions enforced server-side.

### Integrations

| Variable | Default | Description |
|---|---|---|
| `TRAKT_CLIENT_ID` | — | [Trakt](https://trakt.tv/oauth/applications) client ID |
| `TRAKT_CLIENT_SECRET` | — | Trakt client secret |
| `FANART_API_KEY` | — | [Fanart.tv](https://fanart.tv/get-an-api-key/) API key for artwork |
| `IMDB_UPDATE_INTERVAL_HOURS` | `24` | IMDB ratings refresh interval in hours |

### Health Endpoint

`GET /api/health` always returns basic public stats (user count, addon count) — safe for use on a landing page or in Docker healthchecks.

Full internal stats (active sessions, memory usage, watched items) are only included when the request carries a valid token:

```
Authorization: Bearer <HEALTH_TOKEN>
```

| Variable | Default | Description |
|---|---|---|
| `HEALTH_TOKEN` | — | Bearer token that unlocks full internal stats. Generate: `openssl rand -hex 24` |

### Logging & Tuning

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `info` | Log verbosity: `debug`, `info`, `warn`, `error` |
| `PROXY_LOGS` | `true` | Enable Hono request logger (`-->` / `<--` lines) |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min). Set to `0` to disable |
| `RATE_LIMIT_LIMIT` | `500` | Max requests per window per IP. Set to `0` to disable |

---

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

```caddyfile
zentrio.example.com {
    reverse_proxy localhost:3000
}
```
