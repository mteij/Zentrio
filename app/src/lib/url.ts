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

const isLikelyMobileRuntime = (): boolean => {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
}

export const shouldUseLocalGatewayForRead = (url: string): boolean => {
  if (!isTauri()) return false
  if (getAppMode() === 'guest') return false

  // Mobile Tauri builds (Android/iOS) do not run the local sidecar server,
  // so localhost gateway routing would fail with "Failed to fetch".
  if (isLikelyMobileRuntime()) return false

  // Require explicit enablement so accidental stale localStorage does not
  // force local gateway usage unexpectedly.
  if (typeof window !== 'undefined' && localStorage.getItem('zentrio_local_gateway_enabled') !== '1') {
    return false
  }

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
 * Allowed URL protocols for image src attributes.
 * Only these protocols are permitted — everything else is rejected.
 */
const ALLOWED_IMG_PROTOCOLS = ['http:', 'https:', 'blob:'] as const;

/**
 * Sanitizes a URL for safe use in an `<img src>` attribute.
 * Returns an empty string if the URL is potentially dangerous.
 *
 * This is the **single point of sanitization** that CodeQL can trace.
 * Every dynamically-built image URL MUST pass through this function
 * before being assigned to a DOM src attribute.
 */
export const sanitizeImgSrc = (url: string): string => {
  if (!url || typeof url !== 'string') return '';

  // Strip all ASCII control characters and whitespace that could hide a scheme
  // eslint-disable-next-line no-control-regex
  const cleaned = url.replace(/[\s\x00-\x1F\x7F-\x9F]/g, '');
  if (!cleaned) return '';

  // Relative paths (starting with /) are always safe in same-origin contexts
  if (cleaned.startsWith('/')) return cleaned;

  // For absolute URLs, only allow explicitly safe protocols
  try {
    const parsed = new URL(cleaned);
    const proto = parsed.protocol.toLowerCase();
    if ((ALLOWED_IMG_PROTOCOLS as readonly string[]).includes(proto)) {
      return cleaned;
    }
    // Protocol not in allow-list → reject
    return '';
  } catch {
    // Not a valid absolute URL and doesn't start with / — reject to be safe
    return '';
  }
};

/**
 * Validates if a URL fragment (seed / style) is safe to embed in a constructed URL.
 * Returns null if the input contains a dangerous scheme.
 */
const validateSafeUrlFragment = (value: string): string | null => {
  if (!value || typeof value !== 'string') return null;

  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\s\x00-\x1F\x7F-\x9F]/g, '');
  if (!cleaned) return null;

  // Reject anything that looks like a dangerous scheme
  const lower = cleaned.toLowerCase();
  for (const scheme of ['javascript:', 'vbscript:', 'data:', 'file:']) {
    if (lower.startsWith(scheme)) return null;
  }

  return cleaned;
};

/**
 * Builds avatar URL for both web and Tauri environments.
 * The returned URL is guaranteed safe for use in `<img src>` attributes
 * because it always passes through `sanitizeImgSrc` before being returned.
 */
export const buildAvatarUrl = (seed: string, style: string, fallbackSeed = 'preview'): string => {
  const safeSeed = validateSafeUrlFragment(seed);
  const safeStyle = validateSafeUrlFragment(style);

  const seedToUse = safeSeed || fallbackSeed;
  const styleToUse = safeStyle || 'bottts-neutral';

  // If the seed is already an absolute URL (http/https), sanitize and return
  if (isAbsoluteOrRuntimeUrl(seedToUse)) {
    return sanitizeImgSrc(seedToUse);
  }

  // Build the URL with encoded dynamic parts, then sanitize the final result
  const encodedSeed = encodeURIComponent(seedToUse);
  const encodedStyle = encodeURIComponent(styleToUse);

  return sanitizeImgSrc(resolveAppUrl(`/api/avatar/${encodedSeed}?style=${encodedStyle}`));
}

