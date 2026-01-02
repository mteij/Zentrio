# OpenID Connect

Zentrio supports generic OpenID Connect (OIDC) providers. This allows you to integrate with any Identity Provider (IdP) that supports the standard.

## Configuration

To configure a generic OIDC provider, add the following to your `.env` file:

```bash
AUTH_OIDC_ID=your-client-id
AUTH_OIDC_SECRET=your-client-secret
AUTH_OIDC_ISSUER=https://your-idp.com/application/o/zentrio/
```

## Example: Authentik

Here is how you can set up Authentik as an OIDC provider for Zentrio.

### Setup Instructions

1.  Log in to your Authentik instance as an admin.
2.  Go to **Applications** > **Providers**.
3.  Create a new **OAuth2/OpenID Provider**.
    - **Name**: Zentrio
    - **Redirect URI/Origin (Regex)**: `https://your-zentrio-instance.com/api/auth/callback/oidc`
    - **Client Type**: Confidential
    - **Signing Key**: Select your certificate
4.  Note the **Client ID** and **Client Secret**.
5.  Go to **Applications** > **Applications**.
6.  Create a new Application.
    - **Name**: Zentrio
    - **Provider**: Select the provider you just created.
7.  Ensure the application is assigned to a policy/flow so users can access it.
8.  You will also need your **Issuer** URL, which is usually `https://authentik.your-domain.com/application/o/zentrio/`.

### Configuration

Add the Authentik details to your `.env` as the OIDC provider:

```bash
AUTH_OIDC_ID=your-authentik-client-id
AUTH_OIDC_SECRET=your-authentik-client-secret
AUTH_OIDC_ISSUER=https://authentik.your-domain.com/application/o/zentrio/
```
