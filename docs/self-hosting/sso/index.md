# SSO

Zentrio supports optional social login and OpenID Connect providers for self-hosted deployments.

## Supported Providers

- [Google](/self-hosting/sso/google)
- [GitHub](/self-hosting/sso/github)
- [Discord](/self-hosting/sso/discord)
- [OpenID Connect](/self-hosting/sso/openid)

## Common Requirements

Before configuring a provider:

- make sure `APP_URL` matches the public URL users will visit
- confirm your reverse proxy and HTTPS setup are working
- finish the base sign-in flow first so troubleshooting stays simple

Each provider page lists the required environment variables and callback guidance for that provider.
