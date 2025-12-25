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
    typeof window !== "undefined" && window.__TAURI_INTERNALS__ !== undefined
  );
};

/**
 * Get the server URL for API requests.
 * - In Tauri: Uses the stored server URL (or localhost in dev)
 * - In Web: Uses the current origin (same-origin requests)
 */
export const getServerUrl = () => {
  if (typeof window === "undefined") return "http://localhost:3000";

  if (isTauri()) {
    const stored = localStorage.getItem("zentrio_server_url");
    
    // In development, default to localhost if no server is selected
    if (!stored && import.meta.env.DEV) {
      return "http://localhost:3000";
    }

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

// Create the auth client configuration
const createClient = () => createAuthClient({
  baseURL: getServerUrl(),
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
