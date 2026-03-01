import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { downloadService, DownloadRecord } from '../services/downloads/download-service'
import { useDownloadStore } from '../stores/downloadStore'

interface ProgressEvent {
  id: string
  progress: number
  downloadedBytes: number
  speed: number
}

interface StatusEvent {
  id: string
  status: string
  filePath?: string
  error?: string
}

/**
 * Initializes the download store for a profile and wires up Tauri event listeners.
 * Should be mounted once inside StreamingLayout (or downloads page).
 */
export function useDownloads(profileId: string | undefined) {
  const { setDownloads, updateProgress, updateStatus } = useDownloadStore()
  const profileRef = useRef(profileId)
  profileRef.current = profileId

  // Load initial downloads from Rust DB
  useEffect(() => {
    if (!profileId) return
    downloadService
      .list(profileId)
      .then(setDownloads)
      .catch(console.error)
  }, [profileId])

  // Subscribe to live progress/status events
  useEffect(() => {
    const progressCleanup = listen<ProgressEvent>('download:progress', (e) => {
      updateProgress(e.payload.id, e.payload.progress, e.payload.downloadedBytes)
    })

    const statusCleanup = listen<StatusEvent>('download:status', (e) => {
      updateStatus(e.payload.id, e.payload.status as any, e.payload.filePath)
    })

    return () => {
      progressCleanup.then((f) => f())
      statusCleanup.then((f) => f())
    }
  }, [])

  const downloads = useDownloadStore((s) => s.downloads)

  return {
    downloads: downloads.filter((d) => !profileId || d.profileId === profileId),
    inProgress: downloads.filter((d) => ['queued', 'downloading', 'paused'].includes(d.status)),
    completed: downloads.filter((d) => d.status === 'completed'),
    failed: downloads.filter((d) => d.status === 'failed'),
  }
}

/**
 * Returns the download record for a given mediaId (for in-page status badges).
 */
export function useDownloadForMedia(mediaId: string): DownloadRecord | undefined {
  return useDownloadStore((s) => s.downloads.find((d) => d.mediaId === mediaId))
}
