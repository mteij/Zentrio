# Using Zentrio

Zentrio is a self-hosted streaming app built around profiles, addons, and multi-platform access.

## What It Does

Zentrio gives you:

- separate profiles with their own history and settings
- Stremio-compatible addons for catalogs, metadata, streams, and subtitles
- web, desktop, and mobile clients from the same server
- optional Trakt sync and native downloads on Tauri apps

## How People Usually Use It

### Connected mode

Sign in to a Zentrio server and use your account, profiles, synced settings, and optional integrations like Trakt.

This is the normal web experience.

### Guest mode

Native clients can also run in a lighter local-first mode without a signed-in server account.

## The Main Pieces

### Profiles

Each profile keeps its own:

- continue watching
- content filters
- streaming preferences
- addon setup through its settings profile

### Addons

Zentrio includes a built-in TMDB addon and also supports third-party Stremio-compatible addons by manifest URL.

### Playback

Zentrio can rank streams, load subtitles, remember progress, and show intro/recap/outro skip buttons when segment data is available.

### Native extras

Desktop and mobile Tauri builds add native flows like downloads, deep links, and other platform-specific behavior.

### Downloads

Download the latest native builds from the [Zentrio downloads page](https://zentrio.eu/releases).

- Windows, macOS, Linux, and Android builds are listed there with the current platform-specific installers.
- Stable direct links are also available under `https://zentrio.eu/download/:platform`.

### Android TV and Fire TV

Zentrio can be sideloaded on Android TV and Amazon Fire TV devices using the [Downloader app by AFTVnews](https://www.aftvnews.com/downloader/).

1. Install the **Downloader** app from your device's app store.
2. Open Downloader and enter code **3250288**, or paste the URL directly:
   ```
   https://zentrio.eu/download/android
   ```
3. Follow the on-screen prompts to install the APK.
4. On first launch, enter your server URL and use the **Activate Device** flow. Visit `/activate` in a browser, sign in, and enter the 6-digit code shown on your TV.

## Next Steps

- Want to host your own instance? See [Self Hosting](/self-hosting).
- Want to work on the app? See [Development](/development).
