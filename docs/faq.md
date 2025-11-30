# FAQ

Common questions and quick answers about Zentrio.

## General

### What is Zentrio?

Zentrio is a minimal profile manager for Stremio Web. It lets you create multiple profiles with separate Stremio credentials, addons and history, and then open Stremio Web in the context of a selected profile.

### Do I need to self‑host?

No. You can use the hosted instance at `https://app.zentrio.eu`. Self‑hosting with Docker is available if you want full control over data and configuration.

See [Getting started](/getting-started) for both options.

## Installation & self‑hosting

### How do I deploy Zentrio quickly?

Use Docker with the published GHCR image:

```bash
mkdir zentrio && cd zentrio

# Download example env file
curl -L https://raw.githubusercontent.com/MichielEijpe/Zentrio/main/.env.example -o .env

# Start Zentrio from GHCR
docker run -d --name zentrio \
  --env-file .env \
  -p 3000:3000 \
  -v ./data:/app/data \
  ghcr.io/michieleijpe/zentrio:latest
```

Then open `http://localhost:3000`.

For details and an overview of important environment variables, see [Self hosting with Docker](/self-hosting-docker).

### Which environment variables are required?

You must set at least:

- `AUTH_SECRET`
- `ENCRYPTION_KEY`

It is also recommended to set `APP_URL` in production.

See the full list in [Environment variables](/environment).

## Usage

### How does login work?

Zentrio supports multiple authentication methods:

- **Magic Link**: Enter your email to receive a one-time login link.
- **Password**: Set a password for your account.
- **Social Login**: Sign in with Google, GitHub, Discord, or other OIDC providers (if configured).

### What is a profile?

A profile contains:

- A name
- Stremio credentials
- Per‑profile settings and addons

When you select a profile and open Stremio Web, Zentrio uses that profile’s context.

### Can I remove a profile?

Yes. Open **Profiles**, select the profile, and use the delete action. This only affects Zentrio, not your actual Stremio account.

## Mobile & apps

### Is there an Android app?

Yes. Download the latest APK from the [Releases](https://zentrio.eu/releases) page. Each release shows a direct **Download Android APK** button when an APK asset is available.

### Can I use Zentrio as a PWA?

Yes. Open Zentrio in your browser and use **Add to Home Screen** from the browser menu. It will behave like a lightweight app.

## Troubleshooting

### I see a blank page or error after starting the container

Check container logs:

```bash
docker-compose logs -f zentrio
```

Common issues:

- Missing or invalid `AUTH_SECRET` / `ENCRYPTION_KEY`
- Database path not writable (`DATABASE_URL` / `./data` permissions)
- Proxy misconfiguration when using Nginx / Traefik

### Magic link email doesn’t arrive

- Verify SMTP configuration (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`).
- Check spam folder.
- Try with a different email provider if possible.

## Getting help

- Issues and bug reports: GitHub Issues on the main repository.
- Feature requests and questions: GitHub Discussions.

Repository: `https://github.com/MichielEijpe/Zentrio`