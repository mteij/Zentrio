# GitHub

To enable GitHub Sign-In, you need to create an OAuth App in your GitHub settings.

## Setup Instructions

1.  Go to **Settings** > **Developer settings** > **OAuth Apps** on GitHub (or [click here](https://github.com/settings/developers)).
2.  Click **New OAuth App**.
3.  Fill in the application details:
    - **Application Name**: Zentrio (or your choice)
    - **Homepage URL**: Your instance URL (e.g., `https://your-zentrio-instance.com`)
    - **Authorization callback URL**: `Use your full URL + /api/auth/callback/github`
      - Example: `https://your-zentrio-instance.com/api/auth/callback/github`
4.  Click **Register application**.
5.  Copy the **Client ID**.
6.  Generate a new **Client Secret** and copy it.

## Configuration

Add the following to your `.env` file:

```bash
AUTH_GITHUB_ID=your-client-id
AUTH_GITHUB_SECRET=your-client-secret
```
