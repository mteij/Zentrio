import { getServerUrl, isTauri } from './auth-client'

type GatewayRoute =
  | '/api/streaming/dashboard'
  | '/api/streaming/filters'
  | '/api/streaming/details'
  | '/api/streaming/catalog'
  | '/api/streaming/catalog-items'
  | '/api/streaming/streams-live'

const GATEWAY_READ_ROUTES: GatewayRoute[] = [
  '/api/streaming/dashboard',
  '/api/streaming/filters',
  '/api/streaming/details',
  '/api/streaming/catalog',
  '/api/streaming/catalog-items',
  '/api/streaming/streams-live'
]

const getLocalGatewayBase = (): string => {
  if (typeof window === 'undefined') return 'http://localhost:3000'
  return localStorage.getItem('zentrio_local_gateway_url') || 'http://localhost:3000'
}

const getGatewayRemoteBase = (): string => {
  if (typeof window !== 'undefined') {
    const storedRemote = localStorage.getItem('zentrio_local_gateway_remote_url')
    if (storedRemote) return storedRemote.replace(/\/$/, '')
  }

  const remote = getServerUrl()
  return remote.replace(/\/$/, '')
}

const getAppMode = (): 'guest' | 'connected' | null => {
  if (typeof window === 'undefined') return null
  const mode = localStorage.getItem('zentrio_app_mode')
  return mode === 'guest' || mode === 'connected' ? mode : null
}

export const shouldUseLocalGatewayForRead = (url: string): boolean => {
  if (!isTauri()) return false
  if (getAppMode() === 'guest') return false

  // Emergency kill-switch (client-side) if local gateway must be bypassed.
  if (typeof window !== 'undefined' && localStorage.getItem('zentrio_local_gateway_disabled') === '1') {
    return false
  }

  return GATEWAY_READ_ROUTES.some((route) => url.startsWith(route))
}

const withGatewayRemote = (gatewayUrl: string): string => {
  const remote = getGatewayRemoteBase()
  const sep = gatewayUrl.includes('?') ? '&' : '?'
  return `${gatewayUrl}${sep}__remote=${encodeURIComponent(remote)}`
}

export const isGatewayResolvedUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url, 'http://localhost')
    return parsed.pathname.startsWith('/api/gateway/')
  } catch {
    return url.includes('/api/gateway/')
  }
}

export const toDirectRemoteUrl = (resolvedOrRelativeUrl: string): string => {
  const parsed = new URL(resolvedOrRelativeUrl, 'http://localhost')

  const isGatewayPath = parsed.pathname.startsWith('/api/gateway/')
  const cleanPath = isGatewayPath
    ? parsed.pathname.replace(/^\/api\/gateway/, '')
    : (resolvedOrRelativeUrl.startsWith('/') ? resolvedOrRelativeUrl : parsed.pathname)

  const params = new URLSearchParams(parsed.search)
  params.delete('__remote')

  const query = params.toString()
  const pathWithQuery = query ? `${cleanPath}?${query}` : cleanPath
  return `${getGatewayRemoteBase()}${pathWithQuery}`
}

/**
 * Returns true when URL is already absolute or handled by browser/runtime directly.
 */
export const isAbsoluteOrRuntimeUrl = (url: string): boolean => {
  return /^(?:https?|ftp):\/\//i.test(url) ||
    url.startsWith('blob:')
}

/**
 * Resolves app-relative URLs (e.g. /api/...) for Tauri production builds.
 * - Web: keeps relative URL as-is (so Vite proxy/same-origin behavior still works)
 * - Tauri: prefixes configured server URL
 */
export const resolveAppUrl = (url: string): string => {
  if (!url || isAbsoluteOrRuntimeUrl(url)) return url

  if (url.startsWith('/') && shouldUseLocalGatewayForRead(url)) {
    const gatewayUrl = `${getLocalGatewayBase()}/api/gateway${url}`
    return withGatewayRemote(gatewayUrl)
  }

  if (url.startsWith('/') && isTauri()) {
    return `${getServerUrl()}${url}`
  }

  return url
}

/**
 * Creates EventSource with Tauri-safe URL resolution.
 */
export const createApiEventSource = (url: string, init?: EventSourceInit): EventSource => {
  return new EventSource(resolveAppUrl(url), init)
}

/**
 * Tauri-safe beacon URL resolver for unload/background analytics calls.
 */
export const resolveBeaconUrl = (url: string): string => resolveAppUrl(url)

/**
 * Dangerous URL schemes that could lead to XSS when used in img src attributes.
 * These are checked in a case-insensitive manner.
 */
const DANGEROUS_URL_SCHEMES = ['javascript:', 'vbscript:', 'data:', 'file:'] as const;

/**
 * Validates if a URL is safe to use in an img src attribute.
 * Returns null if the URL is potentially dangerous.
 */
const validateSafeUrl = (url: string): string | null => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Aggressively strip all whitespace and control characters
  const cleaned = url.replace(/[\s\x00-\x20\x7F-\x9F]/g, '');

  // Check for dangerous schemes (case-insensitive)
  const lowerCleaned = cleaned.toLowerCase();
  for (const scheme of DANGEROUS_URL_SCHEMES) {
    if (lowerCleaned.startsWith(scheme)) {
      return null;
    }
  }

  // Additional URL parsing validation for edge cases
  try {
    const parsed = new URL(cleaned);
    if (DANGEROUS_URL_SCHEMES.some(scheme => parsed.protocol.toLowerCase() === scheme)) {
      return null;
    }
  } catch {
    // If URL parsing fails, it's likely a relative path which is safe
  }

  return cleaned;
};

/**
 * Builds avatar URL for both web and Tauri environments.
 * This function ensures the output is always safe for use in img src attributes.
 */
export const buildAvatarUrl = (seed: string, style: string, fallbackSeed = 'preview'): string => {
  // Validate and sanitize the seed input
  const safeSeed = validateSafeUrl(seed);
  const safeStyle = validateSafeUrl(style);

  // Use fallback if seed is unsafe or empty
  const seedToUse = safeSeed || fallbackSeed;
  const styleToUse = safeStyle || 'bottts-neutral';

  // If the seed is an absolute URL (http/https), return it directly after validation
  if (isAbsoluteOrRuntimeUrl(seedToUse)) {
    return seedToUse;
  }

  // Build the safe URL using encodeURIComponent for all dynamic parts
  const encodedSeed = encodeURIComponent(seedToUse);
  const encodedStyle = encodeURIComponent(styleToUse);

  return resolveAppUrl(`/api/avatar/${encodedSeed}?style=${encodedStyle}`);
}

