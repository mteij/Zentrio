import { isTauri } from './auth-client';
import { appMode } from './app-mode';
import { useAuthStore } from '../stores/authStore';
import { recordPerfEvent } from '../utils/performance';
import { resolveAppUrl, isGatewayResolvedUrl, toDirectRemoteUrl } from './url';

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
  const method = (init?.method || 'GET').toUpperCase()
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
  let url = typeof input === 'string' ? input : input.toString();
  
  // Resolve relative app routes (supports local gateway routing in Tauri when enabled)
  if (url.startsWith('/')) {
    url = resolveAppUrl(url)
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
      
      // Check if init already has a token (e.g. during refresh)
      const authHeader = headers.get('Authorization') || headers.get('authorization');
      const existingAuth = (authHeader || '').replace('Bearer ', '');
      const tokenToUse = existingAuth || token;

      if (tokenToUse) {
          if (!existingAuth) {
             headers.set('Authorization', `Bearer ${tokenToUse}`);
          }
      } else if (!appMode.isGuest()) {
          // Only warn when not in guest mode — guest mode has no token by design
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
            const res = await window.fetch(url, {
                ...init,
                headers,
                credentials: 'include',
            });
            recordPerfEvent('api_request', {
              url,
              method: init?.method || 'GET',
              status: res.status,
              durationMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt),
              transport: 'webview-fetch',
              isTauri: true
            })
            return res
        }

        const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
        
        const res = await tauriFetch(url, {
          ...init,
          headers,
        });
        if (res.status >= 500 && isGatewayResolvedUrl(url) && method === 'GET') {
          const fallbackUrl = toDirectRemoteUrl(url)
          const fallbackRes = await tauriFetch(fallbackUrl, {
            ...init,
            headers,
          })
          recordPerfEvent('api_request', {
            url: fallbackUrl,
            method,
            status: fallbackRes.status,
            durationMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt),
            transport: 'tauri-http-plugin-gateway-fallback',
            isTauri: true
          })
          return fallbackRes
        }
        recordPerfEvent('api_request', {
          url,
          method,
          status: res.status,
          durationMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt),
          transport: 'tauri-http-plugin',
          isTauri: true
        })
        return res
      } catch (e) {
        if (isGatewayResolvedUrl(url) && method === 'GET') {
          const fallbackUrl = toDirectRemoteUrl(url)
          try {
            const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
            const fallbackRes = await tauriFetch(fallbackUrl, {
              ...init,
              headers,
            })
            recordPerfEvent('api_request', {
              url: fallbackUrl,
              method,
              status: fallbackRes.status,
              durationMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt),
              transport: 'tauri-http-plugin-gateway-catch-fallback',
              isTauri: true
            })
            return fallbackRes
          } catch {
            // Last-resort: fall through to browser fetch using direct remote URL.
            url = fallbackUrl
          }
        }

        recordPerfEvent('api_request_error', {
          url,
          method: init?.method || 'GET',
          durationMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt),
          isTauri: true,
          message: e instanceof Error ? e.message : String(e)
        })
        // Fallback to browser fetch if Tauri HTTP plugin fails
      }
  }
  


  const res = await fetch(url, {
    ...init,
    headers,
    credentials: 'include', // Ensure cookies are sent for auth
  });
  recordPerfEvent('api_request', {
    url,
    method: init?.method || 'GET',
    status: res.status,
    durationMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt),
    transport: 'fetch',
    isTauri: isTauri()
  })
  return res
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
