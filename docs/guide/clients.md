# Clients

Zentrio can be used from the web app and from native clients.

## Connected Mode

Connected mode is the standard setup. The client signs in to a Zentrio server and uses synced accounts, profiles, settings, and history.

## Guest Mode

Some native clients can also run without a signed-in server account. This is a local-first mode and does not provide the normal synced server experience.

## Native Clients

Desktop and mobile Tauri builds add native capabilities such as:

- downloads
- deep links
- platform-specific playback behavior

Download current builds from the [Zentrio releases page](https://zentrio.eu/releases).

- Windows, macOS, Linux, and Android installers are published there.
- Stable direct links are also available under `https://zentrio.eu/download/:platform`.

## Android TV and Fire TV

Zentrio can be sideloaded on Android TV and Amazon Fire TV devices using the [Downloader app by AFTVnews](https://www.aftvnews.com/downloader/).

1. Install the **Downloader** app from your device's app store.
2. Open Downloader and enter code **3250288**, or paste the URL directly:
   ```
   https://zentrio.eu/download/android
   ```
3. Follow the on-screen prompts to install the APK.
4. On first launch, enter your server URL and use the **Activate Device** flow.
5. Visit `/activate` in a browser, sign in, and enter the 6-digit code shown on your TV.

## Related Docs

- Profiles and user setup: [Accounts and Profiles](/guide/accounts-and-profiles)
- Running your own server: [Self Hosting](/self-hosting/)
