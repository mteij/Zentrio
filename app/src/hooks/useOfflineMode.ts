import { useState, useEffect } from 'react'
import { downloadService } from '../services/downloads/download-service'
import { useDownloadStore } from '../stores/downloadStore'

/**
 * Detects online/offline status using navigator.onLine + browser events.
 * When going offline: pauses all active downloads.
 * When coming back online: resumes all paused downloads.
 */
export function useOfflineMode(profileId?: string) {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const downloads = useDownloadStore((s) => s.downloads)

  useEffect(() => {
    const handleOffline = async () => {
      setIsOnline(false)
      if (!profileId) return
      // Pause all active downloads
      const active = downloads.filter(
        (d) => d.profileId === profileId && (d.status === 'downloading' || d.status === 'queued')
      )
      for (const d of active) {
        try { await downloadService.pause(d.id) } catch {}
      }
    }

    const handleOnline = async () => {
      setIsOnline(true)
      if (!profileId) return
      // Resume all paused downloads
      const paused = downloads.filter(
        (d) => d.profileId === profileId && d.status === 'paused'
      )
      for (const d of paused) {
        try { await downloadService.resume(d.id) } catch {}
      }
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [profileId, downloads])

  return { isOnline }
}
