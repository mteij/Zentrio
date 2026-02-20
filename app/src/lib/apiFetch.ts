import { getServerUrl, isTauri } from './auth-client';
import { appMode } from './app-mode';
import { useAuthStore } from '../stores/authStore';

/**
 * Fetch wrapper that prepends the server URL for Tauri apps.
 * In Tauri, relative paths like '/api/...' are converted to absolute URLs
 * pointing to the configured server. In web browsers, relative paths work normally.
 * 
 * Automatically adds X-Guest-Mode header when in guest mode.
 * 
 * @example
 * // In browser: fetches '/api/auth/providers'
 * // In Tauri: fetches 'https://app.zentrio.eu/api/auth/providers'
 * const res = await apiFetch('/api/auth/providers');
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let url = typeof input === 'string' ? input : input.toString();
  
  // If it's a relative path and we're in Tauri, prepend server URL
  if (url.startsWith('/') && isTauri()) {
    const serverUrl = getServerUrl();
    url = `${serverUrl}${url}`;
  }
  
  // Add X-Guest-Mode header when in guest mode
  const headers = new Headers(init?.headers);
  if (appMode.isGuest()) {
    headers.set('X-Guest-Mode', 'true');
  }
  
  // Inject Bearer token if available (for Tauri cross-origin auth)
  if (isTauri()) {
      const state = useAuthStore.getState();
      const token = state.session?.token;
      
      // Enhanced logging for debugging resource loading and auth issues
      console.log('[apiFetch] Request:', url, {
          hasToken: !!token,
          tokenSuffix: token ? `...${token.slice(-6)}` : null,
          isAuthenticated: state.isAuthenticated,
          isLoading: state.isLoading
      });
      
      // Check if init already has a token (e.g. during refresh)
      const authHeader = headers.get('Authorization') || headers.get('authorization');
      const existingAuth = (authHeader || '').replace('Bearer ', '');
      const tokenToUse = existingAuth || token;

      if (tokenToUse) {
          if (!existingAuth) {
             headers.set('Authorization', `Bearer ${tokenToUse}`);
          }
      } else {
          console.warn('[apiFetch] No token available for Tauri request:', url);
      }
      
      // Use Tauri Native Fetch
      // Use Tauri Native Fetch
      try {
        const urlObj = new URL(url, 'http://localhost');
        // Only use WebView fetch for auth endpoints that need cookie-based session
        // In Tauri builds, we DON'T include /api/profiles because it breaks with cookies
        // In browser builds, we DO include it for proper cookie handling
        let isSessionRequest = urlObj.pathname.includes('/auth/session') ||
                                 urlObj.pathname.includes('/auth/get-session') ||
                                 urlObj.pathname.includes('/auth/mobile-callback') ||
                                 urlObj.pathname.includes('/auth/providers');
        
        // Only add /api/profiles to session requests in browser (not Tauri)
        if (!isTauri() && urlObj.pathname.includes('/api/profiles')) {
          isSessionRequest = true;
        }
        
        if (isSessionRequest) {
            console.log('[apiFetch] Using WebView fetch for session:', url);
            // Must use window.fetch here to ensure it uses the browser's native fetch
            // interceptor, bypassing the Tauri Rust HTTP plugin entirely.
            return window.fetch(url, {
                ...init,
                headers,
                credentials: 'include',
            });
        }

        const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
        
        return tauriFetch(url, {
          ...init,
          headers,
        });
      } catch (e) {
        // Fallback to browser fetch if Tauri HTTP plugin fails
      }
  }
  


  return fetch(url, {
    ...init,
    headers,
    credentials: 'include', // Ensure cookies are sent for auth
  });
}

/**
 * Same as apiFetch but returns parsed JSON.
 * Throws if the response is not ok.
 */
export async function apiFetchJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await apiFetch(input, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API request failed: ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}
