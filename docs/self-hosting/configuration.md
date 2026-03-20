<script setup>
import envExampleFile from '../../.env.example?raw'
</script>

# Configuration

The `.env` file lives in the repository root, not `app/`.

## Current `.env.example`

This example file is loaded directly from the repository root so the docs stay in sync with the real setup file:

<RepoCodeBlock language="dotenv" :code="envExampleFile" />

## Required Configuration

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

## Integrations

| Variable | Default | Description |
| --- | --- | --- |
| `TRAKT_CLIENT_ID` | - | Enables Trakt auth and sync |
| `TRAKT_CLIENT_SECRET` | - | Trakt secret |
| `FANART_API_KEY` | - | Optional artwork and logos |
| `IMDB_UPDATE_INTERVAL_HOURS` | `24` | IMDb ratings refresh interval |

## Logging and Rate Limiting

| Variable | Default | Description |
| --- | --- | --- |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `PROXY_LOGS` | `true` | Enables the Hono request logger |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window in milliseconds |
| `RATE_LIMIT_LIMIT` | `500` | Max requests per window per IP |

Set both rate-limit variables to `0` to disable the global limiter.

## Next Step

Once configuration is in place, review [Operations](/self-hosting/operations) to prepare the instance for real users.
