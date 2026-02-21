import { getServerUrl, isTauri } from './auth-client'

/**
 * Returns true when URL is already absolute or handled by browser/runtime directly.
 */
export const isAbsoluteOrRuntimeUrl = (url: string): boolean => {
  return /^(?:[a-z][a-z\d+\-.]*:)?\/\//i.test(url) ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
}

/**
 * Resolves app-relative URLs (e.g. /api/...) for Tauri production builds.
 * - Web: keeps relative URL as-is (so Vite proxy/same-origin behavior still works)
 * - Tauri: prefixes configured server URL
 */
export const resolveAppUrl = (url: string): string => {
  if (!url || isAbsoluteOrRuntimeUrl(url)) return url

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
 * Builds avatar URL for both web and Tauri environments.
 */
export const buildAvatarUrl = (seed: string, style: string, fallbackSeed = 'preview'): string => {
  if (isAbsoluteOrRuntimeUrl(seed)) return seed

  const seedToUse = seed || fallbackSeed
  return resolveAppUrl(`/api/avatar/${encodeURIComponent(seedToUse)}?style=${encodeURIComponent(style)}`)
}

