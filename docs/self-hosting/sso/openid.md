# OpenID Connect

Zentrio supports multiple generic OpenID Connect (OIDC) providers simultaneously. You can connect any Identity Provider (IdP) that implements the OIDC standard — Authentik, Keycloak, Okta, Dex, etc.

## Multiple providers

Use numbered env vars to configure up to 20 OIDC providers. Each set is independent:

```bash
# Provider 1
OIDC_1_CLIENT_ID=your-client-id
OIDC_1_CLIENT_SECRET=your-client-secret
OIDC_1_ISSUER=https://your-idp.com/application/o/zentrio/
OIDC_1_NAME=My SSO          # Button label shown to users
OIDC_1_ID=my-sso            # Optional slug — determines the callback URL (default: oidc-1)
OIDC_1_ICON=https://your-idp.com/favicon.ico  # Optional icon URL shown on the login button

# Provider 2
OIDC_2_CLIENT_ID=...
OIDC_2_CLIENT_SECRET=...
OIDC_2_ISSUER=https://second-idp.example.com/
OIDC_2_NAME=Company SSO
```

The callback (redirect) URI for each provider is:

```
https://your-zentrio-instance.com/api/auth/callback/<ID>
```

Where `<ID>` is the value of `OIDC_N_ID` (defaults to `oidc-1`, `oidc-2`, etc.).

## Single provider (legacy)

If you only need one OIDC provider, you can use the original single-provider vars:

```bash
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_ISSUER=https://your-idp.com/application/o/zentrio/
OIDC_DISPLAY_NAME=My SSO   # Optional, defaults to "OpenID"
OIDC_ICON=https://your-idp.com/favicon.ico  # Optional
```

The callback URI for the legacy format uses the fixed ID `oidc`:

```
https://your-zentrio-instance.com/api/auth/callback/oidc
```

## Environment variable reference

| Variable | Required | Description |
|---|---|---|
| `OIDC_N_CLIENT_ID` | Yes | OAuth2 client ID |
| `OIDC_N_CLIENT_SECRET` | Yes | OAuth2 client secret |
| `OIDC_N_ISSUER` | Yes | Issuer URL (used to discover endpoints via `/.well-known/openid-configuration`) |
| `OIDC_N_NAME` | No | Display name on the login button (default: `OpenID N`) |
| `OIDC_N_ID` | No | URL-safe slug for the callback path (default: `oidc-N`) |
| `OIDC_N_ICON` | No | URL of an icon/logo to show on the login button |

## Example: Authentik

### 1. Create a provider in Authentik

1. Log in to your Authentik instance as an admin.
2. Go to **Applications** → **Providers**.
3. Create a new **OAuth2/OpenID Provider**:
   - **Name**: Zentrio
   - **Redirect URI**: `https://your-zentrio-instance.com/api/auth/callback/oidc-1`
   - **Client Type**: Confidential
   - **Signing Key**: Select your certificate
4. Note the **Client ID** and **Client Secret**.
5. Go to **Applications** → **Applications** and create a new application linked to this provider.
6. Find your **Issuer URL** — typically `https://authentik.your-domain.com/application/o/zentrio/`.

### 2. Configure Zentrio

```bash
OIDC_1_CLIENT_ID=your-authentik-client-id
OIDC_1_CLIENT_SECRET=your-authentik-client-secret
OIDC_1_ISSUER=https://authentik.your-domain.com/application/o/zentrio/
OIDC_1_NAME=Authentik
OIDC_1_ICON=https://authentik.your-domain.com/static/dist/assets/icons/icon.png
```

Restart Zentrio after changing OIDC configuration.
