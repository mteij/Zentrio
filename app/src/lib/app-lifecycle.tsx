/**
 * App Lifecycle Handler
 * 
 * Handles app lifecycle events (resume, pause) for Tauri apps.
 * On resume, revalidates the session to ensure it's still valid.
 */

import { useEffect, useRef } from 'react';
import { isTauri } from './auth-client';
import { useAuthStore } from '../stores/authStore';

/**
 * Hook to handle app lifecycle events
 * Call this in your root component to enable session revalidation on app resume
 */
export function useAppLifecycle() {
  const { refreshSession, isAuthenticated } = useAuthStore();
  const lastVisibilityChange = useRef<number>(Date.now());
  const hasCheckedConnectivity = useRef<boolean>(false);

  // Check connectivity on first load (Tauri Android only)
  useEffect(() => {
    if (!isTauri() || !import.meta.env.DEV || hasCheckedConnectivity.current) return;
    hasCheckedConnectivity.current = true;

    const checkConnectivity = async () => {
      try {
        // Try to reach the local dev server
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        await fetch('http://localhost:3000/api/health', {
          signal: controller.signal,
          mode: 'no-cors'
        });
        clearTimeout(timeout);
        console.log('[AppLifecycle] Connectivity check passed');
      } catch (e) {
        console.warn('[AppLifecycle] Connectivity check failed:', e);
        // Only show on Android (mobile Tauri)
        const { type } = await import('@tauri-apps/plugin-os');
        const osType = await type();
        if (osType === 'android') {
          const { toast } = await import('sonner');
          toast.error('Cannot connect to dev server', {
            description: 'Run: bun run android:ports',
            duration: 10000,
          });
        }
      }
    };

    // Delay check slightly to let app initialize
    setTimeout(checkConnectivity, 2000);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const timeSinceLastChange = Date.now() - lastVisibilityChange.current;
        
        // Only revalidate if the app was in background for more than 1 second
        // We check regardless of isAuthenticated to catch SSO logins that happened in browser
        if (timeSinceLastChange > 1000) {
          console.log('[AppLifecycle] App resumed after', Math.round(timeSinceLastChange / 1000), 'seconds, checking session...');
          try {
            const valid = await refreshSession();
            if (valid) {
              console.log('[AppLifecycle] Session valid/restored');
            }
          } catch (e) {
            console.error('[AppLifecycle] Failed to revalidate session:', e);
          }
        }
      }
      lastVisibilityChange.current = Date.now();
    };

    // Listen for visibility changes (app going to background/foreground)
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also listen for Tauri-specific window focus events
    let unlistenFn: (() => void) | null = null;
    
    const setupTauriListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const unlisten = await listen('tauri://focus', async () => {
          const timeSinceLastChange = Date.now() - lastVisibilityChange.current;
          if (timeSinceLastChange > 1000) {
            console.log('[AppLifecycle] Window focused, checking session...');
            await refreshSession();
          }
          lastVisibilityChange.current = Date.now();
        });
        unlistenFn = unlisten;
      } catch (e) {
        console.error('[AppLifecycle] Failed to setup Tauri listener:', e);
      }
    };

    setupTauriListener();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (unlistenFn) unlistenFn();
    };
  }, [refreshSession, isAuthenticated]);
}

/**
 * AppLifecycleProvider component
 * Wrap your app with this to enable lifecycle handling
 */
export function AppLifecycleProvider({ children }: { children: React.ReactNode }) {
  useAppLifecycle();
  return <>{children}</>;
}
