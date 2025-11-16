# Scripts for Zentrio Development

This folder contains scripts to help with the development and deployment of Zentrio on different platforms.

## Available Scripts

### Build Script
- **`build.js`** - Main build script that creates the dist folder with all necessary assets for Capacitor
  - Cleans the dist directory
  - Copies static assets
  - Builds the server with Bun
  - Creates an index.html entry point for Capacitor

### iOS Scripts
- **`run-ios-simulator.sh`** - (macOS only) Builds and runs Zentrio on iOS Simulator
  - Checks for Xcode and CocoaPods installation
  - Builds the web app
  - Installs iOS dependencies
  - Syncs with Capacitor
  - Runs on iOS Simulator

- **`run-ios.bat`** - (Windows) Prepares the iOS project and opens Xcode
  - Note: iOS development requires a Mac with Xcode
  - This script helps prepare the project on Windows before transferring to Mac

## Usage

### Standard Capacitor Commands (Recommended)
Instead of using the platform-specific scripts, you can use the standard Capacitor commands defined in package.json:

```bash
# Build the app
bun run build

# Sync with native platforms
bun run cap:sync

# Open Android Studio
bun run cap:open:android

# Open Xcode
bun run cap:open:ios

# Run on Android
bun run cap:run:android

# Run on iOS
bun run cap:run:ios
```

### Platform-Specific Scripts
If you prefer the convenience scripts:

**On macOS:**
```bash
# Run on iOS Simulator
./scripts/run-ios-simulator.sh
```

**On Windows (for Android):**
```bash
# Note: Android scripts have been removed in favor of standard Capacitor commands
# Use: bun run cap:run:android
```

**On Windows (preparing for iOS):**
```bash
# Prepare iOS project (then transfer to Mac)
scripts\run-ios.bat
```

## Removed Scripts

The following Android batch scripts have been removed as they're redundant with the standard Capacitor CLI commands:
- `run-android-studio.bat` - Use `bun run cap:open:android` instead
- `run-android.bat` - Use `bun run cap:run:android` instead
- `run-zentrio-android.bat` - Use `bun run cap:run:android` instead

## Notes

- The standard Capacitor commands (`bun run cap:*`) are the recommended approach
- Platform-specific scripts are provided for convenience but may not cover all use cases
- iOS development requires a Mac with Xcode installed
- Android development requires Android Studio and SDK