# 📱 Mobile Apps Guide

Zentrio supports native mobile applications for iOS and Android, allowing you to take your profile management on the go. This guide covers everything you need to know about mobile development and deployment.

## 🎯 Mobile Options

### 📲 Native Apps (Recommended)
- **iOS App**: Native iOS application via App Store
- **Android App**: Native Android application via Play Store
- **Features**: Full native experience, offline support, push notifications

### 🌐 Progressive Web App (PWA)
- **Platform**: All modern browsers
- **Features**: Installable, works offline, app-like experience
- **Setup**: No installation required, just visit zentrio.eu

### 🔧 Custom Builds
- **Platform**: Build your own mobile apps
- **Features**: Custom branding, additional features
- **Requirements**: Development setup and platform accounts

## 📋 What You'll Learn

This guide covers:

1. **[Mobile Setup](setup.md)** - Setting up the mobile development environment
2. **[Android Development](android.md)** - Android-specific setup and deployment
3. **[iOS Development](ios.md)** - iOS-specific setup and deployment
4. **[App Store Deployment](deployment.md)** - Publishing to app stores

## 🏗️ Mobile Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │───▶│   Zentrio API   │───▶│   Stremio API   │
│  (Capacitor)    │    │   (Backend)     │    │   (Streaming)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │
        ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Native Features │    │   SQLite DB     │
│ (Camera, etc.)  │    │  (Profiles)     │
└─────────────────┘    └─────────────────┘
```

### Technology Stack

- **Capacitor**: Cross-platform native app framework
- **WebView**: Web application wrapped in native container
- **TypeScript**: Type-safe development
- **Bun**: Fast JavaScript runtime
- **SQLite**: Local database for profiles

## 🚀 Quick Start

### For Users

1. **iOS Users**: Download from App Store (coming soon)
2. **Android Users**: Download from Play Store (coming soon)
3. **PWA Users**: Visit zentrio.eu and "Add to Home Screen"

### For Developers

```bash
# Clone and setup
git clone https://github.com/MichielEijpe/Zentrio.git
cd Zentrio/app

# Install dependencies
bun install

# Build the app
bun run build

# Sync to mobile platforms
bunx cap sync

# Run on Android
bunx cap run android

# Run on iOS
bunx cap run ios
```

## 📱 Platform Support

### iOS
- **Minimum Version**: iOS 13+
- **Devices**: iPhone, iPad
- **Distribution**: App Store (recommended) or TestFlight
- **Development**: Xcode 14+ required

### Android
- **Minimum Version**: API 21+ (Android 5.0+)
- **Devices**: Phones and tablets
- **Distribution**: Play Store (recommended) or APK
- **Development**: Android Studio required

### PWA
- **Browsers**: Chrome, Safari, Firefox, Edge
- **Requirements**: Modern browser with service worker support
- **Features**: Offline support, installable

## ✨ Mobile Features

### Core Features
- ✅ **Profile Management**: Create and switch profiles
- ✅ **Theme Support**: Multiple built-in themes
- ✅ **Offline Access**: Works without internet
- ✅ **Biometric Auth**: Fingerprint/Face ID
- ✅ **Push Notifications**: Profile updates, alerts

### Platform-Specific Features

#### iOS
- **Face ID/Touch ID**: Biometric authentication
- **iOS Widgets**: Quick profile switching
- **Share Extension**: Share content to Zentrio
- **Siri Shortcuts**: Voice commands

#### Android
- **Fingerprint**: Biometric authentication
- **Widgets**: Home screen widgets
- **Share Intent**: Share content to Zentrio
- **Notifications**: Rich notifications

## 🔧 Development Requirements

### Prerequisites
- **Node.js 18+** and npm/yarn
- **Bun** (recommended runtime)
- **Git** for version control

### Platform-Specific Tools

#### iOS Development
- **macOS** (required for iOS development)
- **Xcode 14+** from Mac App Store
- **Apple Developer Account** ($99/year)
- **iOS Device** or Simulator

#### Android Development
- **Android Studio** from developer.android.com
- **Android SDK** (API 33+ recommended)
- **Java JDK 17+**
- **Android Device** or Emulator

## 📊 Performance Considerations

### Optimization Tips
- **Bundle Size**: Keep web assets minimal
- **Image Optimization**: Compress images for mobile
- **Caching**: Implement proper caching strategies
- **Network**: Optimize API calls and data usage

### Best Practices
- **Lazy Loading**: Load components on demand
- **Code Splitting**: Separate mobile-specific code
- **Memory Management**: Monitor memory usage
- **Battery Life**: Optimize for battery efficiency

## 🔒 Security Considerations

### Mobile Security
- **Certificate Pinning**: Prevent MITM attacks
- **Secure Storage**: Encrypt sensitive data
- **Biometric Auth**: Use platform authentication
- **App Transport Security**: Enforce HTTPS

### Data Protection
- **Local Encryption**: Encrypt stored credentials
- **Secure Communication**: Use HTTPS everywhere
- **Authentication**: Secure session management
- **Privacy**: Respect user privacy settings

## 🆘 Troubleshooting

### Common Issues
- **Build Failures**: Check dependencies and configuration
- **Sync Issues**: Ensure web app is built successfully
- **Platform Errors**: Verify platform-specific setup
- **Performance**: Check bundle size and optimization

### Getting Help
- **Documentation**: [Development Guide](../development/)
- **Issues**: [GitHub Issues](https://github.com/MichielEijpe/Zentrio/issues)
- **Discussions**: [GitHub Discussions](https://github.com/MichielEijpe/Zentrio/discussions)

## 📚 Additional Resources

- **Capacitor Documentation**: [capacitorjs.com](https://capacitorjs.com/docs)
- **Android Developer Guide**: [developer.android.com](https://developer.android.com/guide)
- **iOS Developer Library**: [developer.apple.com](https://developer.apple.com/documentation/)
- **PWA Documentation**: [web.dev/progressive-web-apps](https://web.dev/progressive-web-apps/)

---

Ready to get started with mobile development? Check out our [Mobile Setup Guide](setup.md) to configure your development environment!