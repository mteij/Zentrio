import { useCallback } from 'react'
import { isTauri } from '../lib/auth-client'
import { createLogger } from '../utils/client-logger'

const log = createLogger('useExtPlayer')

interface ExternalPlayerOptions {
  url: string
  title?: string
}

export function useExternalPlayer() {
  const inTauri = isTauri()

  /** Open the URL with whatever the device's default handler is. */
  const openExternal = useCallback(async (options: ExternalPlayerOptions) => {
    const { url } = options

    if (inTauri) {
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener')
        await openUrl(url)
        return { success: true, message: 'Opened in external player' }
      } catch (error) {
        log.error('Failed to open externally:', error)
        return { success: false, message: 'Failed to open in external player' }
      }
    }

    // Web fallback — let the browser / OS decide
    window.open(url, '_blank', 'noopener,noreferrer')
    return { success: true, message: 'Opened in external player' }
  }, [inTauri])

  return { openExternal, isTauri: inTauri }
}
