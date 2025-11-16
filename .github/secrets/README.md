# GitHub Secrets for Mobile Builds

This directory contains configuration files and documentation for setting up GitHub secrets required for mobile app builds.

## Required Secrets

### Android Build Secrets

1. **ANDROID_STORE_PASSWORD**
   - Password for the debug keystore
   - Used for signing debug APKs

2. **ANDROID_KEY_ALIAS**
   - Alias for the debug key in the keystore
   - Default: `androiddebugkey`

3. **ANDROID_KEY_PASSWORD**
   - Password for the debug key
   - Usually same as store password

4. **ANDROID_RELEASE_STORE_PASSWORD**
   - Password for the release keystore
   - Used for signing release AABs

5. **ANDROID_RELEASE_KEY_ALIAS**
   - Alias for the release key in the keystore

6. **ANDROID_RELEASE_KEY_PASSWORD**
   - Password for the release key

### iOS Build Secrets

1. **IOS_DEVELOPMENT_TEAM**
   - Apple Developer Team ID
   - Format: `XXXXXXXXXX`

2. **IOS_CODE_SIGN_IDENTITY**
   - Code signing identity
   - Example: `iPhone Distribution`

3. **IOS_PROVISIONING_PROFILE_SPECIFIER**
   - Provisioning profile identifier
   - Example: `com.zentrio.app App Store`

## Setup Instructions

### Android Setup

1. Generate debug keystore (if not exists):
   ```bash
   keytool -genkey -v -keystore debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Generate release keystore:
   ```bash
   keytool -genkey -v -keystore release.keystore -alias zentrio-release -keyalg RSA -keysize 2048 -validity 10000
   ```

3. Add the keystore files to this directory (commit them for debug, keep release secure)

4. Set up GitHub secrets in your repository settings:
   - Go to Settings → Secrets and variables → Actions
   - Add each secret listed above

### iOS Setup

1. Set up Apple Developer account and provisioning profiles
2. Download provisioning profiles and certificates
3. Add ExportOptions.plist to this directory
4. Set up GitHub secrets for iOS signing

## Files in this directory

- `debug.keystore` - Debug signing keystore (can be committed)
- `release.keystore` - Release signing keystore (DO NOT commit, keep secure)
- `ExportOptions.plist` - iOS export options configuration