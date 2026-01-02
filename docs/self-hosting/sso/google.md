# Google SSO

To enable Google Sign-In, you need to create a project in the Google Cloud Console.

## Setup Instructions

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project or select an existing one.
3.  Navigate to **APIs & Services** > **OAuth consent screen**.
    - select **External** (unless you are a Google Workspace user and want to restrict to your organization).
    - Fill in the required application details.
4.  Navigate to **Credentials**.
5.  Click **Create Credentials** > **OAuth client ID**.
6.  Select **Web application** as the application type.
7.  Add your application's redirect URI to **Authorized redirect URIs**:
    - `Use your full URL + /api/auth/callback/google`
    - Example: `https://your-zentrio-instance.com/api/auth/callback/google`
8.  Click **Create**.
9.  Copy the **Client ID** and **Client Secret**.

## Configuration

Add the following to your `.env` file:

```bash
AUTH_GOOGLE_ID=your-client-id
AUTH_GOOGLE_SECRET=your-client-secret
```
