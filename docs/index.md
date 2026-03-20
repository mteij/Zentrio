# Overview

Zentrio is a self-hosted streaming platform. These docs are primarily for people running their own instance and for contributors working in the repository.

## Recommended Path

1. Start with [Self Hosting](/self-hosting/) to understand the deployment flow.
2. Follow [Installation](/self-hosting/installation) to get your first instance online.
3. Use [Configuration](/self-hosting/configuration) to set secrets, URLs, email, and integrations.
4. Review [Operations](/self-hosting/operations) before inviting other users.
5. Use the [User Guide](/guide/) to understand accounts, profiles, addons, and clients.
6. Open [Development](/development/) if you are modifying the codebase.

## What You Need To Self-Host

- A machine that can run Docker or Bun
- A TMDB API key
- Secrets for `AUTH_SECRET` and `ENCRYPTION_KEY`
- A public URL and reverse proxy for a production deployment

## Main Guides

### [Self Hosting](/self-hosting/)

Deployment, configuration, operations, reverse proxy, and SSO guidance.

### [User Guide](/guide/)

Accounts, profiles, addons, connected mode, native clients, and downloads.

### [Development](/development/)

Monorepo structure, local setup, and application architecture.

### [Contributing](/contributing)

Contribution workflow and repository expectations.

## Official Hosted Service

If you want to evaluate Zentrio before deploying your own server, use [Zentrio Web](https://zentrio.eu/web). That handoff page makes it clear when you are leaving the docs and opening the official hosted service.

The live API reference for the official hosted service is available at [app.zentrio.eu/api/docs](https://app.zentrio.eu/api/docs).

## Note for Self-Hosters

The official hosted-service legal pages do not automatically apply to independently operated self-hosted deployments. If you run Zentrio for other people, you may need your own terms, privacy notice, and account-deletion process.
