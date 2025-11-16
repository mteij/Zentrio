import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zentrio.app',
  appName: 'Zentrio',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    cleartext: false,
    allowNavigation: ['*.zentrio.eu', 'zentrio.eu'],
    url: 'https://zentrio.eu'
  },
  plugins: {
    App: {
    }
  },
  android: {
    webContentsDebuggingEnabled: true
  },
  ios: {
    webContentsDebuggingEnabled: true
  }
};

export default config;
