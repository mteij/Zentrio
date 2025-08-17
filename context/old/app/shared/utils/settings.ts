/**
 * Utility functions for managing user settings in localStorage
 */

export interface UserSettings {
  enableAddonOrderUserscript: boolean;
  autoLogin: 'none' | 'last' | 'profile';
  autoLoginProfileId: string | null;
}

const SETTINGS_KEYS = {
  ADDON_ORDER_USERSCRIPT: 'enableAddonOrderUserscript',
  AUTO_LOGIN: 'autoLogin',
  AUTO_LOGIN_PROFILE_ID: 'autoLoginProfileId'
} as const;

/**
 * Gets a setting value from localStorage
 */
export function getSetting<K extends keyof UserSettings>(
  key: K,
  defaultValue: UserSettings[K]
): UserSettings[K] {
  if (typeof window === 'undefined') return defaultValue;
  
  try {
    const settingKey = getSettingKey(key);
    const value = localStorage.getItem(settingKey);
    
    if (value === null) return defaultValue;
    
    // Handle boolean settings
    if (typeof defaultValue === 'boolean') {
      return (value === 'true') as UserSettings[K];
    }
    
    return value as UserSettings[K];
  } catch {
    return defaultValue;
  }
}

/**
 * Sets a setting value in localStorage
 */
export function setSetting<K extends keyof UserSettings>(
  key: K,
  value: UserSettings[K]
): void {
  if (typeof window === 'undefined') return;
  
  try {
    const settingKey = getSettingKey(key);
    localStorage.setItem(settingKey, String(value));
  } catch (error) {
    console.error('Failed to save setting:', key, error);
  }
}

/**
 * Removes a setting from localStorage
 */
export function removeSetting<K extends keyof UserSettings>(key: K): void {
  if (typeof window === 'undefined') return;
  
  try {
    const settingKey = getSettingKey(key);
    localStorage.removeItem(settingKey);
  } catch (error) {
    console.error('Failed to remove setting:', key, error);
  }
}

/**
 * Gets all user settings as an object
 */
export function getAllSettings(): Partial<UserSettings> {
  if (typeof window === 'undefined') return {};
  
  return {
    enableAddonOrderUserscript: getSetting('enableAddonOrderUserscript', false),
    autoLogin: getSetting('autoLogin', 'none'),
    autoLoginProfileId: getSetting('autoLoginProfileId', null)
  };
}

/**
 * Maps our setting keys to localStorage keys for consistency
 */
function getSettingKey(key: keyof UserSettings): string {
  const keyMap: Record<keyof UserSettings, string> = {
    enableAddonOrderUserscript: SETTINGS_KEYS.ADDON_ORDER_USERSCRIPT,
    autoLogin: SETTINGS_KEYS.AUTO_LOGIN,
    autoLoginProfileId: SETTINGS_KEYS.AUTO_LOGIN_PROFILE_ID
  };
  
  return keyMap[key];
}