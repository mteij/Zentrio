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
    
    if (isTauri()) {
        try {
            const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
            
            // Ensure headers are properly passed
            const headers = new Headers(init?.headers);
            
            // Set default Content-Type for JSON if body exists and not already set
            if (init?.body && !headers.has('Content-Type')) {
                if (typeof init.body === 'string') {
                    try {
                        JSON.parse(init.body);
                        headers.set('Content-Type', 'application/json');
                    } catch {
                        // Not JSON, don't set
                    }
                }
            }
            
            // Inject Bearer token if available (for Tauri cross-origin auth)
            // This is critical for 2FA and other auth operations where cookies don't work
            if (!headers.has('Authorization')) {
                try {
                    // Dynamic import to avoid circular dependency
                    const { useAuthStore } = await import('../stores/authStore');
                    const token = useAuthStore.getState().session?.token;
                    if (token) {
                        console.log('[safeFetch] Injecting Bearer token from store', token.slice(-6));
                        headers.set('Authorization', `Bearer ${token}`);
                    } else {
                        console.log('[safeFetch] No token found in store');
                    }
                } catch (e) {
                    console.error('[safeFetch] Failed to inject token:', e);
                }
            }
            
            const response = await tauriFetch(url, {
                ...init,
                headers,
            });
            return response;
        } catch (e: any) {
            console.error('[safeFetch] Tauri HTTP plugin error:', e);
            console.error('[safeFetch] Error details:', e?.message || e?.toString?.() || JSON.stringify(e));
            // Re-throw with more context instead of silent fallback
            throw new Error(`Network request failed: ${e?.message || 'Unknown error'} (URL: ${url})`);
        }
    }
    return fetch(input, init);
};

// Create the auth client configuration
const createClient = () => createAuthClient({
  baseURL: getServerUrl(),
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
});

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

// Legacy export for backward compatibility
// Uses a Proxy to dynamically forward all property access to the lazily-initialized client
// This ensures the client is created with the correct server URL at first use
export const authClient = new Proxy({} as AuthClientType, {
  get(_, prop) {
    return (getAuthClient() as any)[prop];
  }
});
