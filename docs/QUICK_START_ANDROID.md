---
layout: default
title: Quick Start Android
---

# Quick Start: Running Zentrio on Android Emulator

## 🚀 One-Click Setup

I've created a automated script to get you running quickly:

```cmd
cd app
run-android.bat
```

This script will:
- ✅ Check Java installation
- ✅ Install Android Studio if needed
- ✅ Build the app
- ✅ Start an emulator
- ✅ Deploy Zentrio

## 📋 Manual Steps (if script fails)

### 1. Set Environment Variables
Open Command Prompt as Administrator and run:

```cmd
setx JAVA_HOME "C:\Program Files\Java\jdk-17" /M
setx ANDROID_HOME "%LOCALAPPDATA%\Android\Sdk" /M
setx PATH "%PATH%;%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools" /M
```

### 2. Complete Android Studio Setup
1. Launch Android Studio from Start Menu
2. Complete initial setup (Standard installation)
3. Wait for SDK download to complete
4. Go to Tools → Device Manager
5. Click "Create device"
6. Select Pixel 6 → API 33 → Finish
7. Click the play button to start the emulator

### 3. Run the App
```cmd
cd app
bun run build
bunx cap sync android
bunx cap run android
```

## 🔧 What's Happening Behind the Scenes

The Android setup involves:

1. **Java JDK 17** - Required for Android development
2. **Android Studio** - IDE with SDK and emulator
3. **Android Virtual Device (AVD)** - The emulator
4. **Capacitor** - Bridges web app to native
5. **ADB** - Android Debug Bridge for deployment

## 📱 First Time Setup

If this is your first time setting up Android development:

1. **Java Installation** ✅ (Already done)
2. **Android Studio Installation** 🔄 (Currently downloading)
3. **SDK Setup** - Complete in Android Studio
4. **Emulator Creation** - Create in Android Studio
5. **App Deployment** - Run with Capacitor

## 🐛 Troubleshooting

### "JAVA_HOME not set"
```cmd
# Restart Command Prompt after setting environment variables
echo %JAVA_HOME%
java -version
```

### "No emulators found"
- Open Android Studio
- Tools → Device Manager → Create Device
- Select Pixel 6, API 33+

### "ADB command not found"
```cmd
# Check if Android SDK is installed
dir "%LOCALAPPDATA%\Android\Sdk\platform-tools"
```

### "Gradle build failed"
```cmd
cd android
./gradlew clean
cd ..
bunx cap sync android
```

## 🎯 Success Indicators

You'll know it's working when you see:

1. ✅ Java version output
2. ✅ Android Studio opens
3. ✅ Emulator boots up
4. ✅ App installs and launches
5. ✅ Zentrio appears on emulator screen

## 📞 Need Help?

- Check `ANDROID_SETUP.md` for detailed instructions
- Ensure all environment variables are set
- Restart Command Prompt after environment changes
- Make sure emulator is fully booted before running app

---

**Next Steps:**
1. Wait for Android Studio to finish installing
2. Run `run-android.bat` in the `app` folder
3. Follow the on-screen instructions
4. Enjoy Zentrio on Android! 🎉