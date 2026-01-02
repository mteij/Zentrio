# Authentik SSO

To integrate Authentik, you can use the generic OIDC provider or a specific Authentik integration if available. Zentrio uses standard OpenID Connect.

## Setup Instructions

1.  Log in to your Authentik instance as an admin.
2.  Go to **Applications** > **Providers**.
3.  Create a new **OAuth2/OpenID Provider**.
    - **Name**: Zentrio
    - **Redirect URI/Origin (Regex)**: `https://your-zentrio-instance.com/api/auth/callback/authentik`
    - **Client Type**: Confidential
    - **Signing Key**: Select your certificate
4.  Note the **Client ID** and **Client Secret**.
5.  Go to **Applications** > **Applications**.
6.  Create a new Application.
    - **Name**: Zentrio
    - **Provider**: Select the provider you just created.
7.  Ensure the application is assigned to a policy/flow so users can access it.
8.  You will also need your **Issuer** URL, which is usually `https://authentik.your-domain.com/application/o/zentrio/`. Note that for proper OIDC discovery, the issuer URL should usually be the base URL where `.well-known/openid-configuration` can be found (e.g., `https://authentik.your-domain.com/application/o/zentrio/`).

## Configuration

Add the following to your `.env` file (adjusting for Authentik specific variables if Zentrio supports a generic `AUTH_AUTHENTIK` provider, otherwise you might need to use generic `AUTH_OIDC` variables depending on implementation).

_Assuming Zentrio has an `authentik` provider configured in Auth.js_:

```bash
AUTH_AUTHENTIK_ID=your-client-id
AUTH_AUTHENTIK_SECRET=your-client-secret
AUTH_AUTHENTIK_ISSUER=https://authentik.your-domain.com/application/o/zentrio/
```
