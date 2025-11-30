// This service is deprecated and will be removed in future versions.
// It is kept for compatibility with existing code that might import it,
// but all functionality is now stubbed or redirected to Tauri equivalents where appropriate.

export class CapacitorService {
  static isNative(): boolean {
    // Check for Tauri environment
    return !!(window as any).__TAURI__;
  }

  static isAndroid(): boolean {
    return false; // Tauri detection would go here if needed
  }

  static isIOS(): boolean {
    return false; // Tauri detection would go here if needed
  }

  static isWeb(): boolean {
    return !this.isNative();
  }

  static getPlatform(): string {
    return this.isNative() ? 'tauri' : 'web';
  }

  /**
   * Get app info for native platforms
   */
  static async getAppInfo() {
    return null;
  }

  /**
   * Exit app for native platforms
   */
  static async exitApp() {
    if (this.isNative()) {
      try {
        const { exit } = await import('@tauri-apps/plugin-process');
        await exit();
      } catch (e) {
        console.error('Failed to exit app:', e);
      }
    }
  }

  /**
   * Check if running on a device
   */
  static isDevice(): boolean {
    return this.isNative();
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
      statusBarStyle: 'default',
      navigationBarStyle: 'default'
    };
  }
}

export default CapacitorService;