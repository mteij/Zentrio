# Getting started

Zentrio lets you manage multiple profiles for Stremio Web with separate watch history and settings.

This page helps you get up and running quickly, whether you use the public instance or self-host.

## 1. Choose how you want to run Zentrio

### Option A: Use the hosted instance

- Open `https://zentrio.eu` in your browser.
- Create or open a profile.
- Log in with your email (Magic Link, Password) or Social Login.

_Best if you just want to try Zentrio without running your own server._

### Option B: Self-host with Docker

If you prefer full control and data locality, run Zentrio yourself:

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

Zentrio will be available at `http://localhost:3000` by default.

For a deeper guide and all environment variables, see [Self hosting with Docker](/self-hosting-docker).

## 2. First-time setup

1. Open Zentrio (hosted or self-hosted).
2. Sign in using one of the available methods:
   - **Email**: Enter your email to receive a Magic Link or use a password.
   - **Social**: Use Google, GitHub, Discord, or OIDC (if configured).
3. Create your first profile with your Stremio credentials.

Profiles keep their own Stremio settings, watch history, and addons.

## 3. Next steps

- Learn how to manage profiles and settings in [Usage](/usage).
- Configure your server for production in [Self hosting with Docker](/self-hosting-docker).
- See all configuration options in [Environment variables](/environment).
- Download mobile apps and Android APKs from [Releases](/releases).