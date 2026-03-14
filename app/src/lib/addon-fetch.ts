import { isTauri } from './auth-client'
import { createLogger } from '../utils/client-logger'

const log = createLogger('AddonFetch')

/**
 * Fetch from an external addon URL using the correct transport for the platform:
 * - Tauri (desktop/mobile): direct HTTP via @tauri-apps/plugin-http — no CORS restrictions
 * - Web browser: routed through /api/addon-proxy to avoid CORS
 */
export async function addonFetch(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    if (isTauri()) {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
      log.debug('Tauri direct fetch:', url)
      return await tauriFetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Zentrio/1.0' },
      } as any)
    } else {
      const proxyUrl = `/api/addon-proxy?url=${encodeURIComponent(url)}`
      log.debug('Web proxy fetch:', url)
      return await fetch(proxyUrl, { signal: controller.signal })
    }
  } finally {
    clearTimeout(timeout)
  }
}
