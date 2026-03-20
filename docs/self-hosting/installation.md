<script setup>
import dockerComposeFile from '../../docker-compose.yml?raw'
</script>

# Installation

The repository already contains a root-level `docker-compose.yml` that matches the current image layout and volume paths, so that is the easiest starting point.

## Recommended: Docker Compose

From the repository root:

1. Copy `.env.example` to `.env`.
2. Fill in your secrets and API keys.
3. Start the stack with `docker compose up -d`.

Current `docker-compose.yml` from the repository root:

<RepoCodeBlock language="yaml" :code="dockerComposeFile" />

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

## After Installation

- Continue with [Configuration](/self-hosting/configuration) to set the instance URLs, email, and integrations.
- Review [Reverse Proxy](/self-hosting/reverse-proxy) before exposing the server publicly.
