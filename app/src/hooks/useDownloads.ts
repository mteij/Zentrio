import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useDownloadStore } from '../stores/downloadStore'
import { isTauri } from '../lib/auth-client'
import type { DownloadRecord, DownloadQuality } from '../services/downloads/download-service'

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
 * No-ops on web (downloads are a Tauri-only feature).
 */
export function useDownloads(profileId: string | undefined) {
  const { setDownloads, updateProgress, updateStatus, addDownload } = useDownloadStore()
  const profileRef = useRef(profileId)
  profileRef.current = profileId

  // Load initial downloads from Rust DB (Tauri only)
  useEffect(() => {
    if (!profileId || !isTauri()) return
    import('../services/downloads/download-service').then(({ downloadService }) => {
      downloadService.list(profileId).then(setDownloads).catch(console.error)
    })
  }, [profileId, setDownloads])

  // Subscribe to live progress/status/smart-next events from the Rust backend (Tauri only)
  useEffect(() => {
    if (!isTauri()) return

    let cancelled = false
    const unlisteners: Array<() => void> = []

    async function setup() {
      const [{ listen }, { downloadService }, { getTopStream }] = await Promise.all([
        import('@tauri-apps/api/event'),
        import('../services/downloads/download-service'),
        import('../lib/topStreamCache'),
      ])

      if (cancelled) return

      listen<ProgressEvent>('download:progress', (e) => {
        updateProgress(e.payload.id, e.payload.progress, e.payload.downloadedBytes, e.payload.speed)
      }).then((fn) => { if (cancelled) fn(); else unlisteners.push(fn) })

      listen<StatusEvent>('download:status', (e) => {
        updateStatus(e.payload.id, e.payload.status as any, e.payload.filePath, e.payload.error)
        if (['completed', 'failed', 'cancelled'].includes(e.payload.status) && profileRef.current) {
          downloadService.list(profileRef.current).then(setDownloads).catch(console.error)
        }
      }).then((fn) => { if (cancelled) fn(); else unlisteners.push(fn) })

      listen<SmartNextEvent>('download:queue_next', async (e) => {
        const { profileId: pid, mediaId, season, episode, title, posterPath, addonId, quality, smartDownload, autoDelete } = e.payload
        if (pid !== profileRef.current) return

        const stream = await getTopStream({ profileId: pid, mediaType: 'series', mediaId, season, episode })
        if (!stream) {
          toast.info('Smart Download: could not resolve the next episode source yet', { duration: 6000 })
          return
        }

        try {
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
      }).then((fn) => { if (cancelled) fn(); else unlisteners.push(fn) })
    }

    setup()

    return () => {
      cancelled = true
      unlisteners.forEach((fn) => fn())
    }
  }, [addDownload, setDownloads, updateProgress, updateStatus])

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
