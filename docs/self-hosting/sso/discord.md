# Discord

To enable Discord Sign-In, you need to create an application in the Discord Developer Portal.

## Setup Instructions

1.  Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2.  Click **New Application**.
3.  Give your application a name and accept the terms.
4.  Navigate to the **OAuth2** tab in the sidebar.
5.  Add your redirect URI to the **Redirects** section:
    - `Use your full URL + /api/auth/callback/discord`
    - Example: `https://your-zentrio-instance.com/api/auth/callback/discord`
6.  Click **Save Changes**.
7.  Copy the **Client ID** and **Client Secret** (you may need to click "Reset Secret" to see it).

## Configuration

Add the following to your `.env` file:

```bash
AUTH_DISCORD_ID=your-client-id
AUTH_DISCORD_SECRET=your-client-secret
```
