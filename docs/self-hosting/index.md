# Self Hosting

Zentrio ships as a single Bun server that serves both the API and the web app. These docs are organized for the normal path most self-hosters take: deploy first, configure the instance, then add optional integrations.

## Recommended Order

1. Follow [Installation](/self-hosting/installation) to get a working instance online.
2. Use [Configuration](/self-hosting/configuration) to set secrets, URLs, email, and integrations.
3. Review [Operations](/self-hosting/operations) before inviting other users.
4. Put the app behind a proxy with [Reverse Proxy](/self-hosting/reverse-proxy).
5. Add optional identity providers from [SSO](/self-hosting/sso/).

## Before You Start

For a normal deployment, you should have:

- Docker or Bun available on the host
- a TMDB API key
- an `AUTH_SECRET`
- an `ENCRYPTION_KEY`
- a public URL for your instance if you plan to expose it outside your network

## Quick Start

1. Copy `.env.example` to `.env`.
2. Set `APP_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, and `TMDB_API_KEY`.
3. Start the stack with `docker compose up -d`.
4. Open your `APP_URL`, create the first account, and verify the instance is reachable through your reverse proxy.

## Legal Note for Self-Hosters

The legal pages published at `https://zentrio.eu/tos`, `https://zentrio.eu/privacy`, and `https://zentrio.eu/account-deletion` apply to the official hosted Zentrio service operated by the project maintainers.

If you run your own Zentrio server for other people, you may need your own terms, privacy notice, retention policy, and account-deletion process for that deployment. You are responsible for the data handling, integrations, and compliance posture of your own instance.
