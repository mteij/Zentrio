import { useState, useEffect, useRef, useCallback } from 'react'
import { downloadService } from '../services/downloads/download-service'
import { useDownloadStore } from '../stores/downloadStore'
import { getAppTarget } from '../lib/app-target'
import { flushProgressQueue } from '../lib/offline-progress-queue'
import { getServerUrl } from '../lib/auth-client'

const PING_TIMEOUT_MS = 5000
const ANDROID_POLL_INTERVAL_MS = 30_000

function getPingUrl(): string {
  const target = getAppTarget()
  // In Tauri (especially Android dev), use the absolute server URL so the ping
  // actually reaches the configured host instead of falling through to the WebView origin.
  if (target.isTauri) {
    return `${getServerUrl()}/api/health`
  }
  return '/api/health'
}

/**
 * Verifies real connectivity by hitting the health endpoint.
 * Uses window.fetch directly to bypass Tauri HTTP plugin overhead.
 * Returns true if the server responds with any status code (we just need IP connectivity).
 */
async function pingServer(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
    await window.fetch(getPingUrl(), {
      method: 'HEAD',
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timer)
    return true
  } catch {
    return false
  }
}

/**
 * Detects online/offline status with a two-stage approach:
 * - `offline` event → trusted immediately (false negatives are safe)
 * - `online` event → verified with a HEAD /api/health ping before marking online
 *   (catches captive portals, hotel WiFi, metered connections)
 * - Android/TV: polls every 30s when offline (Android can drop without firing `online` event)
 * - Android: proactively pings the server on mount because navigator.onLine is unreliable
 *   on the Android emulator and can report `true` even when the dev server is unreachable.
 *
 * When going offline: pauses all active downloads.
 * When coming back online: resumes paused downloads and flushes the progress queue.
 */
export function useOfflineMode(profileId?: string) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const downloads = useDownloadStore((s) => s.downloads)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const appTarget = getAppTarget()
  const isAndroid = appTarget.os === 'android'

  // Android: verify real connectivity on mount — navigator.onLine can report true
  // even when the configured server (e.g. Vite dev host) is unreachable.
  useEffect(() => {
    if (!appTarget.isTauri || !isAndroid) return
    pingServer().then(alive => {
      if (!alive) setIsOnline(false)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleOffline = useCallback(async () => {
    setIsOnline(false)
    if (!profileId) return
    const active = downloads.filter(
      (d) => d.profileId === profileId && (d.status === 'downloading' || d.status === 'queued')
    )
    for (const d of active) {
      try { await downloadService.pause(d.id) } catch {}
    }
  }, [profileId, downloads])

  const handleOnline = useCallback(async () => {
    const alive = await pingServer()
    if (!alive) return // Still not really reachable — stay offline

    setIsOnline(true)

    // Flush any watch progress that was queued while offline
    await flushProgressQueue()

    if (!profileId) return
    const paused = downloads.filter(
      (d) => d.profileId === profileId && d.status === 'paused'
    )
    for (const d of paused) {
      try { await downloadService.resume(d.id) } catch {}
    }
  }, [profileId, downloads])

  useEffect(() => {
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    // Android/TV: poll when offline because the OS doesn't always fire `online` reliably
    // Use pingServer() directly rather than navigator.onLine — the latter can be stale
    // on the Android emulator (reports true even when the server is unreachable).
    if (isAndroid && !isOnline) {
      pollTimer.current = setInterval(async () => {
        await handleOnline()
      }, ANDROID_POLL_INTERVAL_MS)
    }

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [handleOffline, handleOnline, isAndroid, isOnline])

  return { isOnline }
}
