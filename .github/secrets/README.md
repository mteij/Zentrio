# GitHub Secrets for Mobile Builds

This directory documents the GitHub secrets required for building and signing the mobile apps in CI (GitHub Actions).

## Required Secrets

### Android Build Secrets (Release Signing)

Android release artifacts (`app-release.apk`, `.aab`) are signed automatically in CI by the **Build Mobile Apps** workflow ([`.github/workflows/mobile-build.yml`](../workflows/mobile-build.yml)) using the following secrets:

1. **ANDROID_KEYSTORE_BASE64**
   - Base64-encoded contents of the **release keystore**.
   - Used to reconstruct `release.keystore` on the GitHub runner at:
     - `app/android/app/release.keystore`
   - This allows keeping the keystore **out of the repository**.

2. **ANDROID_KEYSTORE_PASSWORD**
   - Password for the release keystore.

3. **ANDROID_KEY_ALIAS**
   - Alias for the release key inside the keystore.
   - Example: `zentrio` or `zentrio-release`.

4. **ANDROID_KEY_PASSWORD**
   - Password for the release key (for the alias above).

These variables are read by:

- The `Configure Android keystore for signing` step in [`mobile-build.yml`](../workflows/mobile-build.yml).
- The `signingConfigs.release` block in [`app/android/app/build.gradle`](../../app/android/app/build.gradle).

> Note: Debug builds use the default Android debug keystore provided by the Android Gradle Plugin and do **not** require secrets.

### iOS Build Secrets

iOS build/signing is currently disabled in CI, but when re-enabled, the following secrets are expected:

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

1. **Generate a release keystore**

   From your local machine:

   ```bash
   keytool -genkey -v \
     -keystore release.keystore \
     -alias zentrio-release \
     -keyalg RSA \
     -keysize 2048 \
     -validity 10000
   ```

   Remember the values you choose for:

   - Keystore password
   - Key alias (e.g. `zentrio-release`)
   - Key password

2. **Base64-encode the release keystore**

   On Linux/macOS/Git Bash:

   ```bash
   base64 -w0 release.keystore > release.keystore.b64
   ```

   On Windows PowerShell:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("release.keystore")) > release.keystore.b64
   ```

   Open `release.keystore.b64` and copy its contents.

3. **Create GitHub secrets**

   In your GitHub repository:

   - Go to **Settings → Secrets and variables → Actions**
   - Add the following repository secrets:

   - `ANDROID_KEYSTORE_BASE64` – contents of `release.keystore.b64`
   - `ANDROID_KEYSTORE_PASSWORD` – release keystore password
   - `ANDROID_KEY_ALIAS` – e.g. `zentrio-release`
   - `ANDROID_KEY_PASSWORD` – release key password

4. **Verify CI integration**

   - Push a commit or trigger the **Build Mobile Apps** workflow manually.
   - In the workflow logs, ensure that:
     - `Configure Android keystore for signing` step runs without errors.
     - `./gradlew assembleRelease` and `./gradlew bundleRelease` complete successfully.
   - Check the GitHub Release: the uploaded `*release*.apk` and `.aab` should now be **signed** and installable.

### iOS Setup (when re-enabled)

1. Set up an Apple Developer account and provisioning profiles.
2. Download provisioning profiles and certificates.
3. Add `ExportOptions.plist` to this directory (or another documented location).
4. Configure the iOS secrets listed above in **Settings → Secrets and variables → Actions**.

## Files in this directory

- `README.md` – this documentation.
- `ExportOptions.plist` – (optional, iOS only) iOS export options configuration, used when iOS CI is enabled.