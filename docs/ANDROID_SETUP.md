---
layout: default
title: Android Development Setup
---

# Android Development Setup for Zentrio

This guide will help you set up the Android development environment to run Zentrio on an Android emulator.

## Prerequisites

### 1. Install Java Development Kit (JDK)

Android development requires Java 17 or later. We recommend using JDK 17.

**Option A: Download from Oracle**
1. Go to [Oracle JDK Downloads](https://www.oracle.com/java/technologies/downloads/)
2. Download JDK 17 (Windows x64 Installer)
3. Run the installer and note the installation path (usually: `C:\Program Files\Java\jdk-17.x.x.x`)

**Option B: Use Winget (Windows Package Manager)**
```cmd
winget install Oracle.JDK.17
```

### 2. Set JAVA_HOME Environment Variable

1. Press `Windows + R`, type `sysdm.cpl` and press Enter
2. Go to "Advanced" tab → "Environment Variables"
3. Under "System variables", click "New"
4. Variable name: `JAVA_HOME`
5. Variable value: `C:\Program Files\Java\jdk-17.x.x.x` (adjust to your installation path)
6. Click OK
7. Find "Path" variable, click "Edit"
8. Click "New" and add: `%JAVA_HOME%\bin`
9. Click OK on all windows

### 3. Verify Java Installation

Open a new Command Prompt and run:
```cmd
java -version
javac -version
echo %JAVA_HOME%
```

### 4. Install Android Studio

1. Download Android Studio from [https://developer.android.com/studio](https://developer.android.com/studio)
2. Run the installer
3. Launch Android Studio

### 5. Configure Android Studio

1. On first launch, select "Standard" installation
2. Wait for SDK and tools to download
3. Go to File → Settings → Appearance & Behavior → System Settings → Android SDK
4. Ensure you have:
   - Android SDK Platform-Tools
   - Android SDK Command-line Tools
   - At least one Android platform (API 33+ recommended)

### 6. Create Android Virtual Device (AVD)

1. In Android Studio, go to Tools → Device Manager
2. Click "Create device"
3. Select a phone model (e.g., Pixel 6)
4. Select a system image (API 33+)
5. Click "Download" if needed
6. Finish the setup
7. Click the play button to launch the emulator

### 7. Set ANDROID_HOME Environment Variable

1. Find your Android SDK path (usually: `C:\Users\YourUsername\AppData\Local\Android\Sdk`)
2. Add `ANDROID_HOME` environment variable pointing to this path
3. Add `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\tools` to your PATH

## Running Zentrio on Android Emulator

Once setup is complete:

1. **Start the emulator** (from Android Studio Device Manager or command line)
2. **Build and sync the app**:
   ```cmd
   cd app
   bun run build
   bunx cap sync android
   ```
3. **Run on emulator**:
   ```cmd
   bunx cap run android
   ```

## Alternative: Use Android Studio

1. Open Android Studio
2. Click "Open an existing project"
3. Navigate to your project's `android` folder
4. Wait for Gradle sync to complete
5. Select the app module and click the run button

## Troubleshooting

### "JAVA_HOME is not set"
- Ensure JAVA_HOME is set correctly
- Restart your command prompt after setting environment variables

### "Failed to install the following Android SDK packages"
- Open Android Studio SDK Manager and install the required packages

### "emulator: ERROR: x86 emulation currently requires hardware acceleration"
- Enable VT-x in BIOS/UEFI
- Install Intel HAXM or use Windows Hypervisor Platform

### "adb command not found"
- Ensure `%ANDROID_HOME%\platform-tools` is in your PATH
- Restart command prompt

### Gradle build fails
- Try: `cd android && ./gradlew clean`
- Ensure you have enough disk space
- Check your internet connection

## Quick Commands

```cmd
# List available emulators
emulator -list-avds

# Start specific emulator
emulator -avd <avd_name>

# Check connected devices
adb devices

# Install APK manually
adb install app-debug.apk
```

## Development Tips

- Use `bun run dev` to run the web server in development mode
- The app will automatically connect to your local server
- Use Chrome DevTools to debug the WebView (chrome://inspect)
- Enable USB debugging in Android settings for physical device testing