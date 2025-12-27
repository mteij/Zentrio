# Trakt Integration

Zentrio integrates with [Trakt.tv](https://trakt.tv) to sync your watch history and provide personalized recommendations. Each profile can connect to its own Trakt account.

## Features

- **Two-Way Sync**: Your watch history syncs bidirectionally between Zentrio and Trakt
- **Personalized Recommendations**: Get movie and show recommendations on your Explore page
- **Profile-Level Connections**: Each profile can have its own Trakt account
- **Multiple Auth Methods**: Sign in via OAuth redirect or device code (for Tauri/TV)

## Self-Hosting Setup

To enable Trakt integration on your self-hosted instance:

### 1. Create a Trakt API Application

1. Go to [trakt.tv/oauth/applications](https://trakt.tv/oauth/applications)
2. Sign in with your Trakt account
3. Click **"New Application"**
4. Fill in the application details:

   - **Name**: Your Zentrio instance name (e.g., "My Zentrio")
   - **Description**: Optional
   - **Redirect URI**: Add both:
     - `https://your-domain.com/api/trakt/callback` (for web)
     - `zentrio://trakt/callback` (for Tauri desktop app)
   - **Javascript Origins**: Leave empty
   - **Permissions**: `/checkin` and `/scrobble`

5. Click **"Save App"**

### 2. Configure Environment Variables

Copy the **Client ID** and **Client Secret** from your Trakt application and add them to your environment:

```env
# Trakt Integration
TRAKT_CLIENT_ID=your_client_id_here
TRAKT_CLIENT_SECRET=your_client_secret_here
```

### 3. Restart Your Instance

After adding the environment variables, restart your Zentrio instance for the changes to take effect.

## User Guide

### Connecting Your Trakt Account

1. Navigate to **Settings** → **Integrations** (or **Linked Accounts**)
2. Find the **Trakt.tv** section
3. Click **"Connect Trakt"**
4. Choose your preferred authentication method:

#### Option A: Sign in with Trakt (Recommended for Browser)

- Click **"Sign in with Trakt"**
- You'll be redirected to Trakt's authorization page
- Authorize the application
- You'll be redirected back, now connected

#### Option B: Device Code (For Tauri/TV/Limited Input)

- Click **"Use Device Code"**
- A code will appear (e.g., `ABC123XY`)
- Go to [trakt.tv/activate](https://trakt.tv/activate) on any device
- Enter the code and authorize
- The app will automatically detect authorization

### Watch History Sync

Once connected, your watch history syncs automatically:

- **Real-time Scrobbling**: When you watch something, Trakt tracks your playback in real-time
  - Scrobble starts when playback begins
  - Scrobble stops when you finish or navigate away
  - If you watch 80%+ of a video, Trakt automatically marks it as watched
- **Sync TO Trakt**: When you watch something in Zentrio, it's marked as watched on Trakt
- **Sync FROM Trakt**: Items you mark as watched on Trakt appear in your Zentrio history
- **Automatic Sync**: Happens on app launch and periodically in the background
- **Manual Sync**: Click "Sync Now" in settings to force an immediate sync

### Sync Settings

You can customize sync behavior in Settings → Integrations:

| Setting                  | Description                               |
| ------------------------ | ----------------------------------------- |
| Enable automatic sync    | Toggle automatic background sync          |
| Sync my watches to Trakt | Enable two-way sync (disable for one-way) |

### Recommendations

After connecting Trakt, personalized recommendations appear on your Explore page:

- **Recommended Movies for You**: Based on your Trakt movie history
- **Recommended Shows for You**: Based on your Trakt show history

Recommendations are powered by Trakt's algorithm and improve as you rate and watch more content on Trakt.

### Disconnecting

To disconnect your Trakt account:

1. Go to **Settings** → **Integrations**
2. Click **"Disconnect"** next to Trakt
3. Confirm the disconnection

> **Note**: Disconnecting removes the connection from this profile only. Your Trakt data remains on Trakt's servers, and you can reconnect at any time.

## Multiple Profiles

Each Zentrio profile can connect to a different Trakt account:

- Profile A → Trakt User 1
- Profile B → Trakt User 2
- Profile C → Trakt User 1 (same as Profile A)

This is useful for families or households where each member has their own Trakt account and viewing preferences.

## Troubleshooting

### "Trakt Integration Not Available"

Your Zentrio instance doesn't have Trakt configured. If self-hosting, ensure you've added the `TRAKT_CLIENT_ID` and `TRAKT_CLIENT_SECRET` environment variables.

### "Authorization Failed"

- Ensure you authorized the correct Trakt application
- Check that your redirect URIs are configured correctly
- Try disconnecting and reconnecting

### "Sync Failed"

- Check your internet connection
- Trakt may be temporarily unavailable
- Try the "Sync Now" button in settings
- Check the browser console for detailed error messages

### Device Code Expired

Device codes expire after 10 minutes. If the code expires, click "Get New Code" to generate a fresh code.
