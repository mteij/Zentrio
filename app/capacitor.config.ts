import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zentrio.app',
  appName: 'Zentrio',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: true,
    allowNavigation: ['*.zentrio.eu', 'zentrio.eu', 'localhost', '127.0.0.1'],
    url: 'https://zentrio.eu'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#141414",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      spinnerStyle: "large",
      spinnerColor: "#e50914"
    }
  },
  android: {
    webContentsDebuggingEnabled: false,
    allowMixedContent: false,
    captureInput: true,
    appendUserAgent: " ZentrioMobile"
  },
  ios: {
    webContentsDebuggingEnabled: false,
    appendUserAgent: " ZentrioMobile",
    // iOS WebView settings
    scrollEnabled: true
    // Enable scrolling for better UX
  }
};

export default config;
