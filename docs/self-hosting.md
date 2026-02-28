# Self-Hosting

## Docker

```bash
docker run -d --name zentrio \
  -e AUTH_SECRET=$(openssl rand -base64 32) \
  -e ENCRYPTION_KEY=$(openssl rand -hex 32) \
  -e TMDB_API_KEY="your-tmdb-api-key" \
  -e DATABASE_URL="file:/app/data/zentrio.db" \
  -p 3000:3000 \
  -v ./data:/app/data \
  ghcr.io/michieleijpe/zentrio:latest
```

## Docker Compose

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
      - TMDB_API_KEY=your-tmdb-api-key
      - DATABASE_URL=file:/app/data/zentrio.db
    volumes:
      - ./data:/app/data
```

## Environment Variables

### Required

- `AUTH_SECRET`: Secret for JWT signing (Required).
- `ENCRYPTION_KEY`: 32-byte hex key for data encryption (Required).
- `TMDB_API_KEY`: API key for TMDB (Required).

### Server (Optional)

- `PORT`: Server port. Default: `3000`
- `APP_URL`: Public URL. Default: `http://localhost:3000`
- `CLIENT_URL`: Client URL. Default: `http://localhost:5173`
- `DATABASE_URL`: SQLite connection string. Default: `./data/zentrio.db`

### Email (Optional)

**SMTP**:

- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`

**Resend**:

- `RESEND_API_KEY`

### Social Login / SSO (Optional)

- **Google**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` ([Docs](./self-hosting/sso/google.md))
- **GitHub**: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` ([Docs](./self-hosting/sso/github.md))
- **Discord**: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` ([Docs](./self-hosting/sso/discord.md))
- **OIDC**: `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_ISSUER`, `OIDC_DISPLAY_NAME` ([Docs](./self-hosting/sso/openid.md))

### Integrations (Optional)

- **Trakt**: `TRAKT_CLIENT_ID`, `TRAKT_CLIENT_SECRET`

## Reverse Proxy (Nginx)

```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```
