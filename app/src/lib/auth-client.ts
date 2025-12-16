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

export const getServerUrl = () => {
  if (typeof window === "undefined") return "http://localhost:3000";

  if (isTauri()) {
    return (
      localStorage.getItem("zentrio_server_url") || "https://app.zentrio.eu"
    );
  }

  return window.location.origin;
};

// Get the client URL for OAuth callback redirects
// This ensures SSO redirects back to the frontend, not the API server
export const getClientUrl = () => {
  if (typeof window === "undefined") return "http://localhost:5173";

  if (isTauri()) {
    return "tauri://localhost";
  }

  return window.location.origin;
};

export const authClient = createAuthClient({
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
