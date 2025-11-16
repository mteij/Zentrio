# Capacitor Integration for Zentrio

This document explains how Capacitor has been integrated into Zentrio to enable cross-platform compatibility.

## Overview

Capacitor allows Zentrio to run as a native app on iOS, Android, and as a Progressive Web App (PWA) while maintaining a single codebase.

## Project Structure

```
app/
├── capacitor.config.ts     # Capacitor configuration
├── build.js               # Custom build script
├── src/
│   └── services/
│       └── capacitor.ts   # Capacitor service utilities
├── android/               # Android platform code
├── ios/                   # iOS platform code
└── dist/                  # Build output for web assets
```

## Installation

The following Capacitor packages have been installed:

- `@capacitor/core` - Core Capacitor functionality
- `@capacitor/cli` - Command-line interface
- `@capacitor/android` - Android platform support
- `@capacitor/ios` - iOS platform support
- `@capacitor/app` - App-level APIs

## Build Process

The build process has been updated to support Capacitor:

1. **Build Command**: `bun run build`
   - Cleans the `dist` directory
   - Copies static assets to `dist/static`
   - Builds the server with Bun
   - Creates an `index.html` entry point for Capacitor

2. **Capacitor Sync**: `bun run cap:sync`
   - Syncs web assets to native platforms
   - Updates native dependencies

## Available Scripts

```bash
# Build the app for Capacitor
bun run build

# Sync assets to native platforms
bun run cap:sync

# Open Android Studio
bun run cap:open:android

# Open Xcode
bun run cap:open:ios

# Run on Android device/emulator
bun run cap:run:android

# Run on iOS device/simulator
bun run cap:run:ios

# Serve the app locally
bun run cap:serve
```

## Platform-Specific Configuration

### Android
- Debugging enabled in development builds
- HTTPS scheme for secure content
- Cleartext allowed for local development

### iOS
- Debugging enabled in development builds
- HTTPS scheme for secure content
- WebView configuration optimized for the app

## Usage in Code

Use the `CapacitorService` to detect platform and access native functionality:

```typescript
import CapacitorService from './src/services/capacitor';

// Check if running on native platform
if (CapacitorService.isNative()) {
  // Native-specific code
}

// Platform-specific logic
if (CapacitorService.isAndroid()) {
  // Android-specific code
} else if (CapacitorService.isIOS()) {
  // iOS-specific code
}
```

## Development Workflow

1. Make changes to your web code
2. Run `bun run build` to build the web assets
3. Run `bun run cap:sync` to sync changes to native platforms
4. Use `bun run cap:run:android` or `bun run cap:run:ios` to test

## Production Deployment

### Android
1. Run `bun run build`
2. Run `bun run cap:sync`
3. Open Android Studio with `bun run cap:open:android`
4. Build and sign the APK/AAB

### iOS
1. Run `bun run build`
2. Run `bun run cap:sync`
3. Open Xcode with `bun run cap:open:ios`
4. Build and archive the app

## Notes

- The current implementation uses a server-side approach with Hono
- Capacitor wraps the web application in a native WebView
- Static assets are bundled and served from the native app
- The app maintains full functionality across all platforms

## Troubleshooting

### Build Issues
- Ensure all dependencies are installed: `bun install`
- Clean build: Remove `dist` directory and rebuild
- Check that the web server is accessible from the native app

### Platform Issues
- Android: Make sure Android Studio and SDK are installed
- iOS: Make sure Xcode and CocoaPods are installed
- Web: Ensure the server is running and accessible

### Sync Issues
- Run `bun run cap:sync` after making changes
- Check that the `dist` directory exists and contains the latest build
- Verify platform-specific configurations in `capacitor.config.ts`