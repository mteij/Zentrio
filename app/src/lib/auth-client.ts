import { createAuthClient } from "better-auth/client";
import {
  twoFactorClient,
  magicLinkClient,
  emailOTPClient,
} from "better-auth/client/plugins";

// Add TypeScript definition for Tauri internals
declare global {
  interface Window {
    __TAURI_INTERNALS__?: any;
  }
}

export const isTauri = () => {
  return (
    typeof window !== "undefined" && 
    ((window as any).__TAURI_INTERNALS__ !== undefined || (window as any).__TAURI__ !== undefined)
  );
};

/**
 * Get the server URL for API requests.
 * - In Tauri: Uses the stored server URL (or localhost in dev)
 * - In Web: Uses the current origin (same-origin requests)
 */
export const getServerUrl = () => {
  if (typeof window === "undefined") return "http://localhost:3000";

  // In development mode...
  if (import.meta.env.DEV) {
    // In Tauri (desktop or Android), use localhost:3000 directly
    // On Android, this works with ADB reverse port forwarding
    // On desktop, this also works as the server runs locally
    if (isTauri()) {
      return "http://localhost:3000";
    }
    // In web browser dev mode, use same origin (Vite proxy handles /api)
    return window.location.origin;
  }

  if (isTauri()) {
    const stored = localStorage.getItem("zentrio_server_url");
    return stored || "https://app.zentrio.eu";
  }

  // Web mode: use same origin
  return window.location.origin;
};

/**
 * Get the client URL for OAuth callback redirects.
 * This ensures SSO redirects back to the frontend, not the API server.
 */
export const getClientUrl = () => {
  if (typeof window === "undefined") return "http://localhost:5173";

  if (isTauri()) {
    return "tauri://localhost";
  }

  return window.location.origin;
};

// Safe fetch wrapper that uses Tauri HTTP plugin in Tauri context
const safeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    // INTERCEPT MALFORMED REQUESTS
    // better-auth or a plugin sometimes tries to access properties of the fetch options as a URL
    // e.g., 'to-upper-case' when checking method normalization
    if (url.includes('fetch-options/method') || url.endsWith('to-upper-case')) {
        console.warn('[safeFetch] Intercepted internal check request:', url);
        return new Response(JSON.stringify({ success: true }), { 
            status: 200, 
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const headers = new Headers(init?.headers);
    let overrideMethod: any = init ? init.method : undefined;
    
    // WORKAROUND: better-auth sometimes passes a Promise as the method? 
    // We detect this and resolve it if possible, or default to GET.
    if (overrideMethod instanceof Promise) {
        console.warn('[safeFetch] Found Promise in init.method, awaiting usage...');
        try {
            overrideMethod = await overrideMethod;
            console.log('[safeFetch] Resolved method to:', overrideMethod);
        } catch (e) {
            console.error('[safeFetch] Failed to resolve method promise:', e);
            overrideMethod = 'GET';
        }
    } 
    
    if (overrideMethod && typeof overrideMethod === 'object') {
         console.warn('[safeFetch] Invalid method type:', typeof overrideMethod, overrideMethod);
         // Better Fetch might pass an object proxy. Convert it to string so native fetch doesn't throw.
         try {
             const methodObj = overrideMethod;
             overrideMethod = typeof methodObj.toString === 'function' && methodObj.toString() !== '[object Object]' 
                ? methodObj.toString() 
                : (init?.body ? 'POST' : 'GET');
         } catch(e) {
             overrideMethod = init?.body ? 'POST' : 'GET';
         }
    }
    
    if (overrideMethod === '[object Object]' || !overrideMethod) {
         overrideMethod = init?.body ? 'POST' : 'GET';
    }

    const finalInit = init ? { ...init } : undefined;
    if (finalInit && overrideMethod) {
        finalInit.method = typeof overrideMethod === 'string' ? overrideMethod : 'GET';
    }

    if (!headers.has('Authorization')) {
        try {
            // Read directly from localStorage to avoid circular dependency and dynamic import lag
            const storage = localStorage.getItem('zentrio-auth-storage');
            if (storage) {
                const parsed = JSON.parse(storage);
                const token = parsed?.state?.session?.token;
                if (token) {
                    console.log(`[safeFetch] Injecting token: ...${token.slice(-6)} for ${url}`);
                    headers.set('Authorization', `Bearer ${token}`);
                }
            }
        } catch (e) {
            console.error('[safeFetch] Failed to read token from storage:', e);
        }
    }

    if (isTauri()) {
        try {
            // Bypass Tauri fetch for session endpoint to ensure cookies are sent from the Webview (if they exist)
            // But now we ALSO send the Authorization header injected above as a fallback
            // Note: In Tauri builds, we DON'T include /api/profiles because it breaks with cookies
            // In browser builds, we DO include it for proper cookie handling
            let isSessionRequest = url.includes('/auth/session') ||
                                     url.includes('/auth/get-session') ||
                                     url.includes('/auth/mobile-callback') ||
                                     url.includes('/auth/providers');
            
            // Only add /api/profiles to session requests in browser (not Tauri)
            if (!isTauri() && url.includes('/api/profiles')) {
              isSessionRequest = true;
            }
            
            if (isSessionRequest) {
                console.log('[safeFetch] Using WebView fetch for session:', url);
                
                // --- DEBUG TRACING ---
                console.log('[safeFetch] --- FETCH TRACE START ---');
                console.log('[safeFetch] URL:', url);
                console.log('[safeFetch] Has Auth Header:', headers.has('Authorization'));
                if (headers.has('Authorization')) {
                    const h = headers.get('Authorization');
                    console.log('[safeFetch] Auth Header Suffix:', h ? `...${h.slice(-6)}` : 'null');
                }
                console.log('[safeFetch] --- FETCH TRACE END ---');
                // ---------------------

                return fetch(input, {
                    ...finalInit,
                    headers, // Pass the headers with injected token
                    credentials: 'include'
                });
            }

            const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
            
            return await tauriFetch(url, {
                ...finalInit,
                headers,
            });
        } catch (e: any) {
            console.error('[safeFetch] Tauri HTTP plugin error:', e);
            throw new Error(`Network request failed: ${e?.message || 'Unknown error'} (URL: ${url})`);
        }
    }

    // WEB FALLBACK: Also use the updated headers
    return fetch(input, {
        ...finalInit,
        headers,
        credentials: 'include'
    });
};

// Create the auth client configuration
const createClient = () => createAuthClient({
  baseURL: getServerUrl(),
  fetchOptions: {
    // Standard better-fetch option for custom fetch
    customFetch: safeFetch
  },
  // Some versions of Better Auth expect it at the root as well
  fetch: safeFetch,
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.location.href = "/two-factor";
      },
    }),
    magicLinkClient(),
    emailOTPClient(),
  ],
} as any);

// Type for the auth client (includes plugin types)
type AuthClientType = ReturnType<typeof createClient>;

// Auth client singleton - lazily initialized and can be reset
let authClientInstance: AuthClientType | null = null;

/**
 * Get the Better Auth client instance.
 * Uses lazy initialization so the server URL is read at first use, not module load.
 */
export function getAuthClient(): AuthClientType {
  if (!authClientInstance) {
    authClientInstance = createClient();
  }
  return authClientInstance;
}

/**
 * Reset the auth client instance.
 * Call this when the server URL changes to force recreation with new URL.
 */
export function resetAuthClient() {
  authClientInstance = null;
}

/**
 * Legacy export for backward compatibility
 * Uses a Proxy to dynamically forward all property access to the lazily-initialized client.
 * Because Better-Auth uses URL-building proxies internally, we MUST NOT attempt to
 * use `.bind()` on its properties, as the proxy will intercept it as a URL path (e.g. `/bind`).
 */
export const authClient = new Proxy({} as AuthClientType, {
  get(_, prop) {
    const client = getAuthClient();
    return (client as any)[prop];
  }
});
