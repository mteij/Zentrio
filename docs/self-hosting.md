# Self-Hosting

The recommended way to run Zentrio is via Docker.

## Quick Start

Run the following command to start a complete instance:

```bash
docker run -d --name zentrio \
  -e AUTH_SECRET=$(openssl rand -base64 32) \
  -e ENCRYPTION_KEY=$(openssl rand -hex 32) \
  -e DATABASE_URL="file:/app/data/zentrio.db" \
  -p 3000:3000 \
  -v ./data:/app/data \
  ghcr.io/michieleijpe/zentrio:latest
```

Your instance will be available at `http://localhost:3000`.

## Configuration

Configure Zentrio using environment variables.

### Core Variables

| Variable         | Description                          | Required | Default                 |
| :--------------- | :----------------------------------- | :------- | :---------------------- |
| `AUTH_SECRET`    | Secret for JWT signing.              | Yes      | -                       |
| `ENCRYPTION_KEY` | 32-byte hex key for data encryption. | Yes      | -                       |
| `DATABASE_URL`   | SQLite connection string.            | Yes      | `./data/zentrio.db`     |
| `APP_URL`        | Public URL of your instance.         | No       | `http://localhost:3000` |

### Email (SMTP)

Required for password resets and invitations.

| Variable     | Description                                   |
| :----------- | :-------------------------------------------- |
| `SMTP_HOST`  | Hostname of your SMTP provider.               |
| `SMTP_PORT`  | Port (e.g., 587 or 465).                      |
| `SMTP_USER`  | SMTP username.                                |
| `SMTP_PASS`  | SMTP password.                                |
| `EMAIL_FROM` | Sender address (e.g., `noreply@example.com`). |

### Social Login (SSO)

Zentrio supports OIDC for social login.

See the specific guides for setting up each provider:

- [Google](./self-hosting/sso/google.md)
- [Discord](./self-hosting/sso/discord.md)
- [GitHub](./self-hosting/sso/github.md)
- [Authentik](./self-hosting/sso/authentik.md)

Supported providers: `GOOGLE`, `GITHUB`, `DISCORD`, `AUTHENTIK`. Prefix variables with `AUTH_{PROVIDER}_`.

## Docker Compose

For production, use `docker-compose.yml`:

```yaml
services:
  zentrio:
    image: ghcr.io/michieleijpe/zentrio:latest
    container_name: zentrio
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - AUTH_SECRET=change_me
      - ENCRYPTION_KEY=change_me
      - DATABASE_URL=file:/app/data/zentrio.db
    volumes:
      - ./data:/app/data
```

## Reverse Proxy

If running behind Nginx, ensure you pass the correct headers:

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
