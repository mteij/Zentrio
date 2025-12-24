import { getServerUrl, isTauri } from './auth-client';

/**
 * Fetch wrapper that prepends the server URL for Tauri apps.
 * In Tauri, relative paths like '/api/...' are converted to absolute URLs
 * pointing to the configured server. In web browsers, relative paths work normally.
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
  
  if (isTauri()) {
    const { fetch } = await import('@tauri-apps/plugin-http');
    return fetch(url, {
        ...init,
        // Tauri's fetch handles cookies automatically and bypasses CORS
    });
  }

  return fetch(url, {
    ...init,
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
