import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import { downloadService, DownloadRecord, DownloadQuality } from '../services/downloads/download-service'
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

interface SmartNextEvent {
  profileId: string
  mediaId: string
  mediaType: string
  title: string
  posterPath: string
  addonId: string
  quality: string
  season: number
  episode: number
  smartDownload: boolean
  autoDelete: boolean
}

/**
 * Initializes the download store for a profile and wires up Tauri event listeners.
 * Should be mounted once inside StreamingLayout (or downloads page).
 */
export function useDownloads(profileId: string | undefined) {
  const { setDownloads, updateProgress, updateStatus, addDownload } = useDownloadStore()
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

  // Subscribe to live progress/status/smart-next events from the Rust backend
  useEffect(() => {
    // Track unlisteners so we can cancel even if promises haven't resolved yet
    let cancelled = false
    const unlisteners: Array<() => void> = []

    listen<ProgressEvent>('download:progress', (e) => {
      updateProgress(e.payload.id, e.payload.progress, e.payload.downloadedBytes)
    }).then((fn) => {
      if (cancelled) fn()
      else unlisteners.push(fn)
    })

    listen<StatusEvent>('download:status', (e) => {
      updateStatus(e.payload.id, e.payload.status as any, e.payload.filePath)
    }).then((fn) => {
      if (cancelled) fn()
      else unlisteners.push(fn)
    })

    listen<SmartNextEvent>('download:queue_next', async (e) => {
      const { profileId: pid, mediaId, season, episode, title, posterPath, addonId, quality, smartDownload, autoDelete } = e.payload

      // Only handle events for the currently active profile
      if (pid !== profileRef.current) return

      // Look up the stream URL from sessionStorage (set by the stream selector UI)
      const streamKey = `top_stream_${mediaId}_${season}_${episode}`
      const fallbackKey = `top_stream_${mediaId}`
      const streamJson = sessionStorage.getItem(streamKey) || sessionStorage.getItem(fallbackKey)

      if (!streamJson) {
        // Stream not cached — user hasn't browsed to this episode yet; notify instead
        import('sonner').then(({ toast }) =>
          toast.info(`Smart Download: Open ${title} to download the next episode`, { duration: 6000 })
        )
        return
      }

      try {
        const stream = JSON.parse(streamJson)
        const id = await downloadService.start({
          profileId: pid,
          mediaType: 'series',
          mediaId,
          title,
          episodeTitle: `S${season}:E${episode}`,
          season,
          episode,
          posterPath,
          streamUrl: stream.url || '',
          addonId: addonId || stream.addonId || '',
          quality: quality as DownloadQuality,
          smartDownload,
          autoDelete,
        })
        addDownload({
          id,
          profileId: pid,
          mediaType: 'series',
          mediaId,
          title,
          episodeTitle: `S${season}:E${episode}`,
          season,
          episode,
          posterPath,
          status: 'queued',
          progress: 0,
          quality: quality as DownloadQuality,
          filePath: '',
          fileSize: 0,
          downloadedBytes: 0,
          addedAt: Date.now(),
          watchedPercent: 0,
          streamUrl: stream.url || '',
          addonId: addonId || stream.addonId || '',
          smartDownload,
          autoDelete,
        })
      } catch (err) {
        console.error('[SmartDownloads] Failed to start next episode download', err)
      }
    }).then((fn) => {
      if (cancelled) fn()
      else unlisteners.push(fn)
    })

    return () => {
      cancelled = true
      unlisteners.forEach((fn) => fn())
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
