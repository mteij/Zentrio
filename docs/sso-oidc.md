# SSO & OIDC Configuration

Zentrio supports Single Sign-On (SSO) via Google, GitHub, Discord, and any OpenID Connect (OIDC) compatible provider.

## General Configuration

To enable a provider, you simply need to set the corresponding environment variables.

The **Redirect URI** (or Callback URL) for all providers follows this pattern:

```
<APP_URL>/api/auth/callback/<provider>
```

If your `APP_URL` is `https://zentrio.yourdomain.com`, the redirect URIs will be:

- **Google**: `https://zentrio.yourdomain.com/api/auth/callback/google`
- **GitHub**: `https://zentrio.yourdomain.com/api/auth/callback/github`
- **Discord**: `https://zentrio.yourdomain.com/api/auth/callback/discord`
- **OIDC**: `https://zentrio.yourdomain.com/api/auth/callback/oidc`

::: warning Important
Ensure your `APP_URL` environment variable is set correctly (e.g., `https://zentrio.yourdomain.com` or `http://localhost:3000` for local dev).
:::

## Google

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to **APIs & Services > Credentials**.
4. Click **Create Credentials > OAuth client ID**.
5. Application type: **Web application**.
6. Add your **Authorized redirect URI**: `https://your-domain.com/api/auth/callback/google`.
7. Copy the **Client ID** and **Client Secret**.

Add to your `.env`:

```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

## GitHub

1. Go to **Settings > Developer settings > OAuth Apps**.
2. Click **New OAuth App**.
3. **Authorization callback URL**: `https://your-domain.com/api/auth/callback/github`.
4. Register application.
5. Copy the **Client ID** and generate a **Client Secret**.

Add to your `.env`:

```bash
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
```

## Discord

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Create a New Application.
3. Go to **OAuth2**.
4. Add Redirect: `https://your-domain.com/api/auth/callback/discord`.
5. Copy **Client ID** and **Client Secret**.

Add to your `.env`:

```bash
DISCORD_CLIENT_ID=your-client-id
DISCORD_CLIENT_SECRET=your-client-secret
```

## OpenID Connect (OIDC)

You can connect any OIDC provider (Authentik, Keycloak, Auth0, etc.).

Add to your `.env`:

```bash
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_ISSUER=https://your-oidc-provider.com/application/o/zentrio/
OIDC_DISPLAY_NAME=My SSO  # Optional button label
```

The redirect URI will be `https://your-domain.com/api/auth/callback/oidc`.