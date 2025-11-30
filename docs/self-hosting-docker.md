# Self hosting with Docker

Run Zentrio on your own server in a few minutes using Docker. This is the recommended way to self‑host.

## 1. Quick start (5 minutes)

### Prerequisites

- Docker and Docker Compose installed
- Git

### One‑command setup

```bash
mkdir zentrio && cd zentrio

# Download example env file
curl -L https://raw.githubusercontent.com/mteij/Zentrio/main/.env.example -o .env

# Start Zentrio from GHCR
docker run -d --name zentrio ^
  --env-file .env ^
  -p 3000:3000 ^
  -v ./data:/app/data ^
  ghcr.io/michieleijpe/zentrio:latest
```

Zentrio will be available at:

- `http://localhost:3000` on your local machine, or
- `http://<server-ip>:3000` on a remote host.

## 2. Minimal required configuration

Edit your `.env` file before exposing Zentrio to the internet.

### Core secrets

```bash
AUTH_SECRET=change-this-to-a-random-string
ENCRYPTION_KEY=change-this-to-another-random-string
APP_URL=https://yourdomain.com
```

Generate strong values (examples):

```bash
# AUTH_SECRET (base64)
openssl rand -base64 32

# ENCRYPTION_KEY (hex)
openssl rand -hex 32
```

### Core environment variables overview

These are the most important variables for a typical Docker deployment.

#### Core

| Variable        | Required | Default                   | Description                                     |
| -------------- | -------- | ------------------------- | ----------------------------------------------- |
| `AUTH_SECRET`  | Yes      | _none_                    | JWT signing secret for authentication.          |
| `ENCRYPTION_KEY` | Yes    | _none_                    | Key for encrypting sensitive data.              |
| `DATABASE_URL` | Yes      | `./data/zentrio.db`       | SQLite database path / connection string.       |
| `APP_URL`      | No       | `http://localhost:3000`   | Public URL used in links and redirects.         |

#### Server & performance

| Variable           | Required | Default       | Description                                     |
| ----------------- | -------- | ------------- | ----------------------------------------------- |
| `PORT`            | No       | `3000`        | Port Zentrio listens on inside the container.   |
| `NODE_ENV`        | No       | `development` | Set to `production` in production.              |
| `BODY_LIMIT`      | No       | `1048576`     | Max request body size (bytes).                  |
| `REQUEST_TIMEOUT` | No       | `30000`       | Request timeout in milliseconds.                |
| `CACHE_TTL`       | No       | `300`         | General cache time‑to‑live in seconds.          |

#### Security

| Variable               | Required | Default       | Description                                      |
| --------------------- | -------- | ------------- | ------------------------------------------------ |
| `RATE_LIMIT_WINDOW_MS`| No       | `900000`      | Rate limit time window in ms.                    |
| `RATE_LIMIT_LIMIT`    | No       | `100`         | Max requests per IP per window.                  |
| `CORS_ORIGIN`         | No       | `*`           | Allowed CORS origins.                            |
| `SESSION_SECRET`      | No       | _none_        | Session signing secret (if used).                |
| `SESSION_TTL`         | No       | `86400000`    | Session TTL in ms.                               |

#### Email

| Variable        | Required | Default | Description                          |
| -------------- | -------- | ------- | ------------------------------------ |
| `SMTP_HOST`    | No       |         | SMTP server host.                    |
| `SMTP_PORT`    | No       |         | SMTP port (e.g. `587`).              |
| `SMTP_SECURE`  | No       | `false` | Use SSL/TLS.                         |
| `SMTP_USER`    | No       |         | SMTP username.                       |
| `SMTP_PASS`    | No       |         | SMTP password / app password.       |
| `EMAIL_FROM`   | No       |         | From address for outgoing emails.   |

#### Features & logging

| Variable              | Required | Default | Description                                      |
| -------------------- | -------- | ------- | ------------------------------------------------ |
| `DOWNLOADS_ENABLED`  | No       | `false` | Enable downloads feature (if supported).         |
| `NSFW_FILTER_ENABLED`| No       | `false` | Enable NSFW filtering.                           |
| `MOBILE_APPS_ENABLED`| No       | `true`  | Enable mobile app support.                       |
| `LOG_LEVEL`          | No       | `info`  | `error`, `warn`, `info`, `debug`.                |
| `PROXY_LOGS`         | No       | `false` | Enable verbose proxy logs.                       |
| `STREMIO_LOGS`       | No       | `false` | Enable Stremio API logs.                         |
| `DEBUG`              | No       |         | Comma‑separated debug namespaces.               |

For a complete list and detailed explanations, see [Environment variables](/environment).

For configuring Social Login (Google, GitHub, etc.), see [SSO & OIDC Configuration](/sso-oidc).

## 3. docker-compose.yml example

A simple production‑ready compose file using the published GHCR image:

```yaml
version: '3.8'

services:
  zentrio:
    image: ghcr.io/michieleijpe/zentrio:latest
    container_name: zentrio
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

### Running and updating

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f zentrio

# Pull latest image and restart
docker-compose pull zentrio
docker-compose up -d
```

## 4. Reverse proxy (optional)

In production you typically put Zentrio behind Nginx, Traefik or another proxy.

Example Nginx server block:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://zentrio:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Make sure `APP_URL` matches the public URL (for example `https://yourdomain.com`).

## 5. Basic troubleshooting

- Container doesn’t start:
  - Run `docker-compose logs zentrio` and check for misconfigured env vars.
- Database issues:
  - Ensure `./data` is writable by Docker.
  - Verify `DATABASE_URL` points to `/app/data/zentrio.db` (inside the container).
- 502/Bad Gateway via proxy:
  - Check the proxy upstream and that Zentrio runs on port `3000`.

For more detailed configuration options, go to [Environment variables](/environment).