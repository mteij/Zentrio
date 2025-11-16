# 📱 Mobile Apps

Zentrio supports native mobile applications for iOS and Android using Capacitor. This guide covers building, configuring, and deploying mobile apps.

## 🏗️ Mobile Architecture

### Cross-Platform Approach

Zentrio uses **Capacitor** to wrap the web application in a native container:

- **Single Codebase**: Web app runs in native WebView
- **Native Features**: Access to device capabilities
- **App Store Distribution**: Native apps for iOS and Android
- **Performance**: Near-native performance with web technologies

### Platform Support

- **iOS**: iPhone and iPad (iOS 13+)
- **Android**: Phones and tablets (API 21+ / Android 5.0+)
- **PWA**: Installable web app for all platforms

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** and **npm/yarn**
- **Android Studio** (for Android development)
- **Xcode** (for iOS development, macOS only)
- **Capacitor CLI**

### Installation

```bash
# Install Capacitor CLI globally
npm install -g @capacitor/cli

# Navigate to app directory
cd app

# Install dependencies
bun install

# Build the web app
bun run build

# Initialize Capacitor (if not already done)
npx cap init "Zentrio" "com.zentrio.app"

# Add platforms
npx cap add android
npx cap add ios
```

---

## 🤖 Android Development

### Environment Setup

1. **Install Android Studio** from [developer.android.com](https://developer.android.com/studio)
2. **Configure Android SDK**:
   - Open Android Studio
   - Go to Settings → Appearance & Behavior → System Settings → Android SDK
   - Install Android SDK Platform-Tools and Android 13 (API 33) or higher
3. **Set environment variables**:
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
   export ANDROID_HOME=$HOME/Android/Sdk          # Linux
   export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
   ```

### Building for Android

```bash
# Build web assets
bun run build

# Sync assets to Android
npx cap sync android

# Open Android Studio
npx cap open android
```

### Running on Android

#### Using Android Studio

1. Open Android Studio with `npx cap open android`
2. Wait for Gradle sync to complete
3. Select a device or emulator
4. Click the Run button

#### Using Command Line

```bash
# List available devices/emulators
npx cap run android --list

# Run on specific device
npx cap run android --target="device-id"

# Run on emulator
npx cap run android --target="emulator-5554"
```

### Android Configuration

#### App Information

Edit [`app/android/app/build.gradle`](../app/android/app/build.gradle):

```gradle
android {
    defaultConfig {
        applicationId "com.zentrio.app"
        minSdkVersion 21
        targetSdkVersion 33
        versionCode 1
        versionName "1.0.0"
        multiDexEnabled true
    }
    
    buildTypes {
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

#### App Icons and Splash

Replace icons in [`app/android/app/src/main/res/`](../app/android/app/src/main/res/):

- `mipmap-*/ic_launcher.png` - App icons
- `drawable-*/splash.png` - Splash screens

#### Permissions

Add permissions in [`app/android/app/src/main/AndroidManifest.xml`](../app/android/app/src/main/AndroidManifest.xml):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

---

## 🍎 iOS Development

### Environment Setup

1. **Install Xcode** from Mac App Store (Xcode 14+)
2. **Install CocoaPods**:
   ```bash
   sudo gem install cocoapods
   ```
3. **Install iOS dependencies**:
   ```bash
   cd app/ios/App
   pod install
   ```

### Building for iOS

```bash
# Build web assets
bun run build

# Sync assets to iOS
npx cap sync ios

# Open Xcode
npx cap open ios
```

### Running on iOS

#### Using Xcode

1. Open Xcode with `npx cap open ios`
2. Select a target device or simulator
3. Click the Run button

#### Using Command Line

```bash
# List available devices
npx cap run ios --list

# Run on specific simulator
npx cap run ios --target="iPhone 14"

# Run on connected device
npx cap run ios --target="device-name"
```

### iOS Configuration

#### App Information

Edit [`app/ios/App/App/Info.plist`](../app/ios/App/App/Info.plist):

```xml
<key>CFBundleDisplayName</key>
<string>Zentrio</string>
<key>CFBundleVersion</key>
<string>1.0.0</string>
<key>CFBundleShortVersionString</key>
<string>1.0.0</string>
```

#### App Icons and Splash

Replace assets in [`app/ios/App/App/Assets.xcassets/`](../app/ios/App/App/Assets.xcassets/):

- `AppIcon.appiconset/` - App icons
- `Splash.imageset/` - Splash screens

#### Capabilities

Enable capabilities in Xcode:

1. Open project in Xcode
2. Select app target
3. Go to "Signing & Capabilities"
4. Add capabilities like Background Modes, Push Notifications, etc.

---

## 🔧 Capacitor Configuration

### Main Configuration

Edit [`app/capacitor.config.ts`](../app/capacitor.config.ts):

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zentrio.app',
  appName: 'Zentrio',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: true,
    allowNavigation: ['*'],
    url: 'http://localhost:3000',  // Development
    // url: 'https://your-domain.com',  // Production
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#0366d6",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#999999",
      splashFullScreen: true,
      splashImmersive: true,
      layoutName: "launch_screen",
      useDialog: true
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#0366d6'
    },
    App: {
      appendUserAgent: 'ZentrioMobile/1.0'
    }
  }
};

export default config;
```

### Environment-Specific Configs

Create different configs for development and production:

```typescript
// capacitor.config.dev.ts
export const devConfig: CapacitorConfig = {
  ...config,
  server: {
    ...config.server,
    url: 'http://localhost:3000',
    cleartext: true
  }
};

// capacitor.config.prod.ts
export const prodConfig: CapacitorConfig = {
  ...config,
  server: {
    ...config.server,
    url: 'https://your-domain.com',
    cleartext: false
  }
};
```

---

## 📦 Building for Production

### Android Release Build

1. **Generate signing key**:
   ```bash
   keytool -genkey -v -keystore zentrio-release.keystore -alias zentrio -keyalg RSA -keysize 2048 -validity 10000
   ```

2. **Configure signing** in [`app/android/app/build.gradle`](../app/android/app/build.gradle):
   ```gradle
   android {
       signingConfigs {
           release {
               storeFile file('zentrio-release.keystore')
               storePassword 'your-store-password'
               keyAlias 'zentrio'
               keyPassword 'your-key-password'
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               minifyEnabled true
               proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
           }
       }
   }
   ```

3. **Build APK**:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

4. **Build AAB** (recommended for Play Store):
   ```bash
   cd android
   ./gradlew bundleRelease
   ```

### iOS Release Build

1. **Open in Xcode**: `npx cap open ios`
2. **Select target**: Choose your app target
3. **Set configuration**: Select "Release"
4. **Archive**: Product → Archive
5. **Distribute**: Organizer → Distribute App

---

## 🚀 App Store Deployment

### Google Play Store

1. **Create Google Play Developer account** ($25 one-time fee)
2. **Create application** in Play Console
3. **Upload APK/AAB**:
   ```bash
   # Upload to Google Play Console
   # Path: android/app/build/outputs/bundle/release/app-release.aab
   ```
4. **Complete store listing**:
   - App description
   - Screenshots
   - App icons
   - Content rating
5. **Submit for review**

### Apple App Store

1. **Create Apple Developer account** ($99/year)
2. **Create app ID** in Developer Portal
3. **Create provisioning profiles**
4. **Upload build** via Xcode Organizer
5. **Complete App Store Connect**:
   - App information
   - Pricing and availability
   - App metadata
   - Screenshots and previews
6. **Submit for review**

---

## 🔌 Native Plugins

### Installing Plugins

```bash
# Install plugin
npm install @capacitor/camera
npx cap sync

# Use in code
import { Camera, CameraResultType } from '@capacitor/camera';

const photo = await Camera.getPhoto({
  resultType: CameraResultType.Uri
});
```

### Common Plugins for Zentrio

#### Camera and Photos
```bash
npm install @capacitor/camera @capacitor/photos
```

#### File System
```bash
npm install @capacitor/filesystem
```

#### Network Status
```bash
npm install @capacitor/network
```

#### Push Notifications
```bash
npm install @capacitor/push-notifications
```

#### Device Information
```bash
npm install @capacitor/device
```

### Custom Plugins

Create custom native functionality:

```typescript
// src/plugins/CustomPlugin.ts
import { registerPlugin } from '@capacitor/core';

export interface CustomPluginPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
}

const CustomPlugin = registerPlugin<CustomPluginPlugin>('CustomPlugin');

export default CustomPlugin;
```

---

## 🎨 UI/UX Considerations

### Mobile-First Design

- **Touch-friendly buttons** (minimum 44px)
- **Readable text** (minimum 16px)
- **Proper spacing** for touch targets
- **Responsive layouts** for different screen sizes

### Platform-Specific Guidelines

#### Android Material Design
- Follow Material Design principles
- Use Android navigation patterns
- Implement proper theming

#### iOS Human Interface Guidelines
- Follow iOS design patterns
- Use native iOS components
- Implement proper navigation

### Performance Optimization

```typescript
// Optimize images for mobile
const optimizedImage = await optimizeForMobile(imageUrl);

// Lazy loading for better performance
const LazyComponent = lazy(() => import('./HeavyComponent'));

// Use web workers for heavy computations
const worker = new Worker('/workers/heavy-task.js');
```

---

## 🐛 Testing Mobile Apps

### Device Testing

```bash
# Test on connected Android device
npx cap run android --target="device-id"

# Test on connected iOS device
npx cap run ios --target="device-name"
```

### Emulator/Simulator Testing

```bash
# List available Android emulators
emulator -list-avds

# Start specific emulator
emulator -avd Pixel_4_API_33

# List iOS simulators
xcrun simctl list devices

# Boot specific simulator
xcrun simctl boot "iPhone 14"
```

### Debugging

#### Android Debugging

1. **Chrome DevTools**:
   - Open Chrome
   - Navigate to `chrome://inspect`
   - Select your app

2. **Android Studio Logcat**:
   - View logs in Android Studio
   - Filter by your app package

#### iOS Debugging

1. **Safari Web Inspector**:
   - Enable Web Inspector in iOS Settings
   - Open Safari → Develop → [Device] → [App]

2. **Xcode Console**:
   - View console logs in Xcode
   - Debug native crashes

---

## 📊 Analytics and Monitoring

### Firebase Analytics

```bash
npm install @capacitor-firebase/analytics
```

```typescript
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';

await FirebaseAnalytics.logEvent({
  name: 'profile_created',
  params: { method: 'email' }
});
```

### Crash Reporting

```bash
npm install @capacitor-firebase/crashlytics
```

```typescript
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';

await FirebaseCrashlytics.recordException({
  message: 'Something went wrong',
  stacktrace: 'Error stack trace'
});
```

---

## 🔧 Troubleshooting

### Common Issues

#### Build Failures

```bash
# Clean and rebuild
cd android && ./gradlew clean && cd .. && npx cap sync android

# Clear Gradle cache
cd android && ./gradlew cleanBuildCache
```

#### White Screen on Launch

1. Check `webDir` in capacitor.config.ts
2. Verify build output exists
3. Check console logs for errors

#### Network Issues

```bash
# Check network security config
# Add android:usesCleartextTraffic="true" for HTTP in development
```

#### Plugin Not Working

```bash
# Resync plugins
npx cap sync

# Reinstall platforms
npx cap rm android
npx cap add android
```

### Getting Help

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Studio Help](https://developer.android.com/studio)
- [Xcode Documentation](https://developer.apple.com/xcode/)
- [GitHub Issues](https://github.com/MichielEijpe/Zentrio/issues)

---

## 📚 Additional Resources

- [Capacitor Getting Started](https://capacitorjs.com/docs/getting-started)
- [Android Developer Guide](https://developer.android.com/guide)
- [iOS Developer Library](https://developer.apple.com/documentation/)
- [Progressive Web Apps](https://web.dev/progressive-web-apps/)

For mobile-specific issues, check the [Development Guide](development) or open an issue on GitHub.