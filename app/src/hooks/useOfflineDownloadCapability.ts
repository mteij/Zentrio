import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/apiFetch'
import { canUseOfflineDownloads, readOfflineDownloadsSettings } from '../lib/offline-downloads'
import { getPlatformCapabilities } from '../lib/platform-capabilities'
import { createLogger } from '../utils/client-logger'

const log = createLogger('useOfflineDownloadCapability')

interface OfflineDownloadCapability {
  isAvailable: boolean
  isLoading: boolean
  isTv: boolean
  allowOnTv: boolean
}

export function useOfflineDownloadCapability(profileId: string | number | undefined): OfflineDownloadCapability {
  const platform = getPlatformCapabilities()
  const isTv = platform.isTv
  const [allowOnTv, setAllowOnTv] = useState(false)
  const [isLoading, setIsLoading] = useState(platform.canUseNativeShell && isTv && !!profileId)

  useEffect(() => {
    if (!platform.canUseNativeShell) {
      setAllowOnTv(false)
      setIsLoading(false)
      return
    }

    if (!isTv) {
      setAllowOnTv(true)
      setIsLoading(false)
      return
    }

    if (!profileId) {
      setAllowOnTv(false)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    const fetchSettings = async () => {
      try {
        const res = await apiFetch(`/api/streaming/settings?profileId=${encodeURIComponent(String(profileId))}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data = await res.json()
        const nextSettings = readOfflineDownloadsSettings(data?.data?.offlineDownloads)

        if (!cancelled) {
          setAllowOnTv(nextSettings.allowOnTv)
        }
      } catch (error) {
        log.error('Failed to load offline download capability', error)
        if (!cancelled) {
          setAllowOnTv(false)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void fetchSettings()

    return () => {
      cancelled = true
    }
  }, [isTv, profileId, platform.canUseNativeShell])

  return {
    isAvailable: platform.canUseNativeShell && canUseOfflineDownloads(platform, { allowOnTv }),
    isLoading,
    isTv,
    allowOnTv,
  }
}
