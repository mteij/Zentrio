import { isTauri } from './auth-client';
import { appMode } from './app-mode';
import { useAuthStore } from '../stores/authStore';
import { recordPerfEvent } from '../utils/performance';
import { resolveAppUrl, isGatewayResolvedUrl, toDirectRemoteUrl } from './url';
import { createLogger } from '../utils/client-logger'

const log = createLogger('ApiFetch')

// Cache the Tauri HTTP plugin import so we only pay the dynamic-import cost once.
// Without this, every apiFetch() call in Tauri would await import() and yield to
// the microtask queue before making the actual HTTP request.
type TauriFetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
let _tauriFetch: TauriFetchFn | null = null
async function getTauriFetch(): Promise<TauriFetchFn> {
  if (!_tauriFetch) {
    const mod = await import('@tauri-apps/plugin-http')
    _tauriFetch = mod.fetch as unknown as TauriFetchFn
  }
  return _tauriFetch
}

function getTauriClientHint(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/android/i.test(ua)) return 'tauri-android'
  if (/iphone|ipad/i.test(ua)) return 'tauri-ios'
  if (/windows nt/i.test(ua)) return 'tauri-windows'
  if (/macintosh|mac os x/i.test(ua)) return 'tauri-macos'
  if (/linux/i.test(ua)) return 'tauri-linux'
  return 'tauri-desktop'
}

function buildJsonParseError(sourceLabel: string, rawText: string, contentType: string | null): Error {
  const trimmed = rawText.trim()
  const preview = trimmed.slice(0, 160).replace(/\s+/g, ' ')
  const looksLikeHtml =
    (contentType || '').toLowerCase().includes('text/html') ||
    /^<!doctype html/i.test(trimmed) ||
    /^<html/i.test(trimmed)

  if (looksLikeHtml) {
    return new Error(
      `API request returned HTML instead of JSON for ${sourceLabel}. This usually means the app is talking to an older server or a frontend fallback page. Preview: ${preview}`
    )
  }

  return new Error(`API request returned invalid JSON for ${sourceLabel}. Preview: ${preview}`)
}

async function parseJsonResponse<T>(res: Response, sourceLabel: string): Promise<T> {
  const rawText = await res.text()
  if (!rawText.trim()) return undefined as T

  try {
    return JSON.parse(rawText) as T
  } catch {
    throw buildJsonParseError(sourceLabel, rawText, res.headers.get('content-type'))
  }
}

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
          log.warn('No token available for Tauri request:', url);
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
            // Browser/WebView fetches are subject to server CORS allow-lists.
            // Keep the Tauri client hint on native-plugin requests, but avoid
            // forcing a preflight failure during session bootstrap.
            headers.delete('X-Zentrio-Client')
            log.debug('Using WebView fetch for session:', url);
            
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

        const tauriFetch = await getTauriFetch();
        if (!headers.has('X-Zentrio-Client')) {
          headers.set('X-Zentrio-Client', getTauriClientHint())
        }

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
            const tauriFetch = await getTauriFetch()
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
  const sourceLabel = typeof input === 'string' ? input : input.toString()
  return parseJsonResponse<T>(res, sourceLabel);
}
