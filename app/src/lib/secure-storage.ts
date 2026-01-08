/**
 * Secure Storage Service
 * 
 * Uses Tauri's store plugin for secure storage on mobile/desktop,
 * falls back to localStorage for web.
 * 
 * This is more secure than localStorage because:
 * - Data is stored in app-private storage (not accessible to browser extensions)
 * - On Android, data is stored in app's internal storage
 * - Persists across app restarts
 */

import { isTauri } from './auth-client';

// Type for stored auth data
interface StoredAuthData {
  user: any;
  session: any;
  lastActivity: number;
}

// Cache the store instance
let storeInstance: any = null;

/**
 * Get the Tauri store instance (lazy loaded)
 */
async function getStore() {
  if (storeInstance) return storeInstance;
  
  if (!isTauri()) return null;
  
  try {
    const { load } = await import('@tauri-apps/plugin-store');
    storeInstance = await load('auth-store.json');
    return storeInstance;
  } catch (e) {
    console.error('[SecureStorage] Failed to load store:', e);
    return null;
  }
}

/**
 * Save auth data to secure storage
 */
export async function saveAuthData(data: StoredAuthData): Promise<void> {
  if (!isTauri()) {
    // Web fallback - use localStorage
    localStorage.setItem('zentrio-auth-storage', JSON.stringify({ state: data }));
    return;
  }

  try {
    const store = await getStore();
    if (store) {
      await store.set('auth', data);
      await store.save();
      console.log('[SecureStorage] Auth data saved');
    }
  } catch (e) {
    console.error('[SecureStorage] Failed to save:', e);
    // Fallback to localStorage
    localStorage.setItem('zentrio-auth-storage', JSON.stringify({ state: data }));
  }
}

/**
 * Load auth data from secure storage
 */
export async function loadAuthData(): Promise<StoredAuthData | null> {
  if (!isTauri()) {
    // Web fallback - use localStorage
    try {
      const stored = localStorage.getItem('zentrio-auth-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.state || null;
      }
    } catch (e) {
      console.error('[SecureStorage] Failed to parse localStorage:', e);
    }
    return null;
  }

  try {
    const store = await getStore();
    if (store) {
      const data = await store.get('auth') as StoredAuthData | null;
      console.log('[SecureStorage] Auth data loaded:', !!data);
      return data || null;
    }
  } catch (e) {
    console.error('[SecureStorage] Failed to load:', e);
  }
  
  // Fallback to localStorage migration
  try {
    const stored = localStorage.getItem('zentrio-auth-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      const data = parsed.state;
      // Migrate to secure storage
      if (data) {
        await saveAuthData(data);
        console.log('[SecureStorage] Migrated from localStorage to secure storage');
      }
      return data || null;
    }
  } catch (e) {
    console.error('[SecureStorage] Migration failed:', e);
  }
  
  return null;
}

/**
 * Clear auth data from secure storage
 */
export async function clearAuthData(): Promise<void> {
  if (!isTauri()) {
    localStorage.removeItem('zentrio-auth-storage');
    return;
  }

  try {
    const store = await getStore();
    if (store) {
      await store.delete('auth');
      await store.save();
      console.log('[SecureStorage] Auth data cleared');
    }
  } catch (e) {
    console.error('[SecureStorage] Failed to clear:', e);
  }
  
  // Also clear localStorage (migration cleanup)
  localStorage.removeItem('zentrio-auth-storage');
}
