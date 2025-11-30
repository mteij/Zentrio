# Usage

This page shows how to use Zentrio once it is running, either hosted or self‑hosted.

## 1. Profiles

Profiles let you keep separate Stremio credentials, addons and history.

### Creating a profile

1. Open Zentrio in your browser.
2. Click **New profile**.
3. Enter a name and your Stremio credentials.
4. Save. Zentrio will use this profile when opening Stremio Web.

### Switching profiles

- Use the profile switcher in the header.
- Select the profile you want to use.
- Stremio Web will be opened with that profile’s context.

### Editing or deleting profiles

- Open **Profiles**.
- Click a profile to edit its name or credentials.
- Use the delete action to remove a profile you no longer need.

## 2. Settings

Settings affect how Zentrio behaves for your account.

Typical options include:

- Default profile on startup.
- Whether to enable downloads (if available).
- Language or localization options (if configured).

## 3. Themes

Zentrio supports multiple themes so you can match your setup.

### Switching theme

- Go to **Settings → Theme**.
- Choose one of the built‑in themes (for example `zentrio`, `midnight`, `stremio`).
- Changes apply instantly in the UI.

### Custom themes

Themes are defined as JSON files under the app’s `themes` directory.

To add a custom theme:

1. Create a new JSON file following the structure of an existing theme.
2. Restart the app if needed.
3. Select the theme from the settings screen.

## 4. Mobile and PWA

You can use Zentrio on mobile via Android APK or as a PWA.

### Android app

- Download the latest APK from the [Releases](https://zentrio.eu/releases) page.
- Install it on your device (you may need to enable installs from unknown sources).
- Open the app and log in with your email.

### PWA (Progressive Web App)

- Open Zentrio in your mobile browser.
- Use **Add to Home Screen** from the browser menu.
- Launch it like a native app.

## 5. Where to go next

- To configure your server and environment variables, see [Self hosting with Docker](/self-hosting-docker) and [Environment variables](/environment).
- For common questions and troubleshooting, see [FAQ](/faq).