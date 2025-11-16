import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export class CapacitorService {
  static isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  static isAndroid(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  static isIOS(): boolean {
    return Capacitor.getPlatform() === 'ios';
  }

  static isWeb(): boolean {
    return Capacitor.getPlatform() === 'web';
  }

  static getPlatform(): string {
    return Capacitor.getPlatform();
  }

  /**
   * Get app info for native platforms
   */
  static async getAppInfo() {
    if (!this.isNative()) {
      return null;
    }

    try {
      return await App.getInfo();
    } catch (error) {
      console.error('Error getting app info:', error);
      return null;
    }
  }

  /**
   * Exit app for native platforms
   */
  static async exitApp() {
    if (!this.isNative()) {
      return;
    }

    try {
      await App.exitApp();
    } catch (error) {
      console.error('Error exiting app:', error);
    }
  }

  /**
   * Check if running on a device
   */
  static isDevice(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Get platform-specific configurations
   */
  static getPlatformConfig() {
    const platform = this.getPlatform();
    
    return {
      isNative: this.isNative(),
      isAndroid: this.isAndroid(),
      isIOS: this.isIOS(),
      isWeb: this.isWeb(),
      platform,
      // Add platform-specific settings here
      statusBarStyle: this.isIOS() ? 'default' : 'default',
      navigationBarStyle: this.isAndroid() ? 'default' : 'default'
    };
  }
}

export default CapacitorService;