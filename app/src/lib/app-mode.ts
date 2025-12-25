/**
 * App Mode Management
 * 
 * Zentrio supports two operating modes:
 * - 'connected': Full features with cloud sync (default, encouraged)
 * - 'guest': Local-only, no account required (Tauri only)
 */

export type AppMode = 'guest' | 'connected';

const STORAGE_KEY = 'zentrio_app_mode';

export const appMode = {
  /**
   * Get the current app mode, or null if not set (first launch)
   */
  get(): AppMode | null {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'guest' || stored === 'connected') {
      return stored;
    }
    return null;
  },

  /**
   * Set the app mode
   */
  set(mode: AppMode): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, mode);
  },

  /**
   * Check if in guest mode
   */
  isGuest(): boolean {
    return this.get() === 'guest';
  },

  /**
   * Check if in connected mode
   */
  isConnected(): boolean {
    return this.get() === 'connected';
  },

  /**
   * Clear the app mode (for testing/reset)
   */
  clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  },

  /**
   * Upgrade from guest to connected mode
   * This preserves local data and enables sync
   */
  upgradeToConnected(): void {
    this.set('connected');
    // Clear the server URL to force server selection
    localStorage.removeItem('zentrio_server_url');
  }
};
