import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Play,
  Eye,
  EyeOff,
  ChevronUp,
  Check,
  Download,
  Pause,
  X,
  Trash2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { LazyImage } from '../../components'
import { ContextMenu } from '../../components/ui/ContextMenu'
import { DropdownMenu } from '../../components/ui/DropdownMenu'
import { CircularProgress } from '../../components/ui/CircularProgress'
import { downloadService, DownloadQuality } from '../../services/downloads/download-service'
import { useDownloadStore } from '../../stores/downloadStore'
import { usePassthroughVerticalScroll } from '../../hooks/usePassthroughVerticalScroll'
import { getTopStream, readCachedTopStream, resolveTopStream } from '../../lib/topStreamCache'
import styles from './Details.module.css'
import type { MetaDetail } from '../../services/addons/types'
import { createLogger } from '../../utils/client-logger'
import { isTauri } from '../../lib/auth-client'

const log = createLogger('EpisodeList')

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatSpeed(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return ''
  return `${formatBytes(bytesPerSec)}/s`
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function inferMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  if (ext === 'webm') return 'video/webm'
  if (ext === 'mkv') return 'video/x-matroska'
  return 'video/mp4'
}

// ── Props ────────────────────────────────────────────────────────────────────

interface EpisodeListProps {
  meta: MetaDetail
  seriesProgress?: Record<string, { isWatched: boolean; progressPercent: number }>
  selectedSeason: number
  setSelectedSeason: (season: number) => void
  onToggleWatched: (season: number, episode: number) => void
  onToggleSeasonWatched: (season: number, watched: boolean) => void
  onMarkEpisodesBefore: (season: number, episode: number, watched: boolean) => void
  onPlay: (season: number, episode: number, title: string) => void
  onSelect: (season: number, episode: number, title: string, autoPlay: boolean) => void
  showImdbRatings: boolean
  showAgeRatings: boolean
  profileId: string
  canDownload: boolean
}

// ── Main EpisodeList ─────────────────────────────────────────────────────────

export function EpisodeList({
  meta,
  seriesProgress,
  selectedSeason,
  setSelectedSeason,
  onToggleWatched,
  onToggleSeasonWatched,
  onMarkEpisodesBefore,
  onPlay,
  onSelect,
  showImdbRatings,
  showAgeRatings,
  profileId,
  canDownload,
}: EpisodeListProps) {
  const navigate = useNavigate()
  const addDownload = useDownloadStore((s) => s.addDownload)
  const downloads = useDownloadStore((s) => s.downloads)
  const [seasonTabsEl, setSeasonTabsEl] = useState<HTMLDivElement | null>(null)
  usePassthroughVerticalScroll(seasonTabsEl)

  // Background prefetch for the first episode of the current season
  useEffect(() => {
    if (!meta.videos || !profileId) return
    const seasonEps = meta.videos
      .filter((v: any) => v.season === selectedSeason)
      .sort((a: any, b: any) => (a.episode ?? a.number) - (b.episode ?? b.number))
    const first = seasonEps[0]
    if (!first) return
    const epNum = (first as any).episode ?? (first as any).number
    if (typeof epNum !== 'number') return
    const cached = readCachedTopStream(meta.id, selectedSeason, epNum)
    if (cached && !cached.stale) return
    void resolveTopStream({
      profileId,
      mediaType: meta.type,
      mediaId: meta.id,
      season: selectedSeason,
      episode: epNum,
      forceRefresh: Boolean(cached),
    })
  }, [meta.id, meta.type, meta.videos, profileId, selectedSeason])

  const handleDownloadEpisode = async (ep: {
    season: number
    episode: number
    title: string
    episodeId: string
    thumbnailUrl?: string
  }) => {
    if (!profileId) {
      toast.error('Missing profile context')
      return
    }
    const quality = (localStorage.getItem('download_quality_pref') || 'standard') as DownloadQuality
    const selected = ep

    try {
      const stream = await getTopStream({
        profileId,
        mediaType: meta.type,
        mediaId: meta.id,
        season: selected.season,
        episode: selected.episode,
      })
      if (!stream) {
        toast.error('Could not resolve a stream for this episode. Please try again.')
        return
      }

      const id = await downloadService.start({
        profileId,
        mediaType: 'series',
        mediaId: meta.id,
        episodeId: selected.episodeId,
        title: meta.name,
        episodeTitle: selected.title,
        season: selected.season,
        episode: selected.episode,
        posterPath: meta.poster || '',
        thumbnailUrl: selected.thumbnailUrl,
        streamUrl: stream.url,
        addonId: stream.addonId || '',
        quality,
      })
      addDownload({
        id,
        profileId,
        mediaType: 'series',
        mediaId: meta.id,
        episodeId: selected.episodeId,
        title: meta.name,
        episodeTitle: selected.title,
        season: selected.season,
        episode: selected.episode,
        posterPath: meta.poster || '',
        status: 'queued',
        progress: 0,
        quality,
        filePath: '',
        fileSize: 0,
        downloadedBytes: 0,
        addedAt: Date.now(),
        watchedPercent: 0,
        streamUrl: stream.url || '',
        addonId: stream.addonId || '',
        smartDownload: false,
        autoDelete: false,
      })
      toast.success(`Downloading: ${selected.title}`)
    } catch (e) {
      log.error('episode download error', e)
      toast.error('Failed to start download')
    }
  }

  const handleDownloadSeason = async () => {
    if (!profileId) return
    const quality = (localStorage.getItem('download_quality_pref') || 'standard') as DownloadQuality

    // Episodes in the current season that haven't been downloaded yet (or failed)
    const toDownload = currentEpisodes.filter((ep: any) => {
      const epNum = ep.episode ?? ep.number
      const dl = downloads.find(
        (d) =>
          d.mediaId === meta.id &&
          d.season === ep.season &&
          d.episode === epNum &&
          d.profileId === profileId
      )
      return !dl || dl.status === 'failed' || dl.status === 'cancelled'
    })

    if (toDownload.length === 0) {
      toast.info('All episodes in this season are already downloaded or queued')
      return
    }

    toast.loading(`Queuing ${toDownload.length} episode${toDownload.length !== 1 ? 's' : ''}…`, {
      id: 'season-dl',
    })

    let succeeded = 0
    for (const ep of toDownload) {
      const epNum = ep.episode ?? (ep as any).number
      const epTitle = ep.title ?? (ep as any).name ?? `Episode ${epNum}`
      try {
        const stream = await getTopStream({
          profileId,
          mediaType: meta.type,
          mediaId: meta.id,
          season: ep.season,
          episode: epNum,
        })
        if (!stream) continue

        const id = await downloadService.start({
          profileId,
          mediaType: 'series',
          mediaId: meta.id,
          episodeId: ep.id || `${ep.season}:${epNum}`,
          title: meta.name,
          episodeTitle: epTitle,
          season: ep.season,
          episode: epNum,
          posterPath: meta.poster || '',
          thumbnailUrl: ep.thumbnail,
          streamUrl: stream.url,
          addonId: stream.addonId || '',
          quality,
        })
        addDownload({
          id,
          profileId,
          mediaType: 'series',
          mediaId: meta.id,
          episodeId: ep.id || `${ep.season}:${epNum}`,
          title: meta.name,
          episodeTitle: epTitle,
          season: ep.season,
          episode: epNum,
          posterPath: meta.poster || '',
          status: 'queued',
          progress: 0,
          quality,
          filePath: '',
          fileSize: 0,
          downloadedBytes: 0,
          addedAt: Date.now(),
          watchedPercent: 0,
          streamUrl: stream.url || '',
          addonId: stream.addonId || '',
          smartDownload: false,
          autoDelete: false,
        })
        succeeded++
      } catch (e) {
        log.error('season dl error ep', epNum, e)
      }
    }

    toast.dismiss('season-dl')
    if (succeeded > 0) {
      toast.success(`Queued ${succeeded} episode${succeeded !== 1 ? 's' : ''} for download`)
    } else {
      toast.error('Could not resolve streams for this season')
    }
  }

  const handlePlayOffline = async (
    dl: ReturnType<typeof useDownloadStore.getState>['downloads'][number]
  ) => {
    try {
      let url = `file://${dl.filePath}`
      let subtitles: Array<{ url: string; lang: string }> = []
      if (isTauri()) {
        const { convertFileSrc } = await import('@tauri-apps/api/core')
        url = convertFileSrc(dl.filePath)
        if (dl.subtitlePaths?.length) {
          subtitles = dl.subtitlePaths.map((s) => ({ url: convertFileSrc(s.path), lang: s.lang }))
        }
      }
      navigate(`/streaming/${profileId}/player`, {
        state: {
          stream: {
            url,
            ytId: '',
            type: inferMimeType(dl.filePath),
            subtitles: subtitles.length ? subtitles : undefined,
          },
          meta: {
            id: dl.mediaId,
            type: 'series',
            name: meta.name,
            poster: meta.poster,
            season: dl.season,
            episode: dl.episode,
          },
        },
      })
    } catch (e) {
      log.error('offline play error', e)
      toast.error('Failed to open downloaded file')
    }
  }

  const handleDeleteDownload = async (dlId: string) => {
    const removeDownload = useDownloadStore.getState().removeDownload
    try {
      await downloadService.delete(dlId)
      removeDownload(dlId)
    } catch (e) {
      log.error('delete error', e)
      toast.error('Failed to delete download')
    }
  }

  const handlePauseResume = async (dlId: string, isActive: boolean) => {
    try {
      if (isActive) await downloadService.pause(dlId)
      else await downloadService.resume(dlId)
    } catch (e) {
      log.error('pause/resume error', e)
    }
  }

  const handleCancel = async (dlId: string) => {
    const removeDownload = useDownloadStore.getState().removeDownload
    try {
      await downloadService.cancel(dlId)
      removeDownload(dlId)
    } catch (e) {
      log.error('cancel error', e)
    }
  }

  // Build season list (needed by handleDownloadSeason above — must be before handlers)
  const allSeasons = meta.videos
    ? (Array.from(new Set(meta.videos.map((v: any) => v.season || 0))).sort(
        (a: any, b: any) => a - b
      ) as number[])
    : []
  const seasons = allSeasons.length > 1 ? allSeasons.filter((s) => s !== 0) : allSeasons

  // Episodes for the currently selected season, sorted by episode number
  const currentEpisodes = meta.videos
    ? meta.videos
        .filter((v: any) => v.season === selectedSeason)
        .sort((a: any, b: any) => (a.episode ?? a.number ?? 0) - (b.episode ?? b.number ?? 0))
    : []

  if (!meta.videos) return null

  // Check if current season is all watched (for the watch button label)
  const allWatched = currentEpisodes.every((ep: any) => {
    const epNum = ep.episode ?? ep.number
    return seriesProgress?.[`${ep.season}-${epNum}`]?.isWatched
  })

  // Count downloaded episodes per season (for the dot indicator on tabs)
  const downloadedBySeason = new Map<number, number>()
  for (const dl of downloads) {
    if (
      dl.mediaId === meta.id &&
      dl.profileId === profileId &&
      dl.status === 'completed' &&
      dl.season != null
    ) {
      downloadedBySeason.set(dl.season, (downloadedBySeason.get(dl.season) ?? 0) + 1)
    }
  }

  return (
    <>
      {/* Season tabs */}
      <div ref={setSeasonTabsEl} className={styles.seasonTabsRow}>
        {seasons.map((season) => (
          <button
            key={season}
            className={`${styles.seasonTab} ${season === selectedSeason ? styles.seasonTabActive : ''}`}
            onClick={() => setSelectedSeason(season)}
          >
            Season {season}
            {(downloadedBySeason.get(season) ?? 0) > 0 && <span className={styles.seasonTabDot} />}
          </button>
        ))}
      </div>

      {/* Season actions row */}
      <div className={styles.seasonActions}>
        <button
          className={`${styles.seasonWatchBtn} ${allWatched ? styles.seasonWatchBtnWatched : ''}`}
          onClick={() => onToggleSeasonWatched(selectedSeason, !allWatched)}
          title={allWatched ? 'Mark season as unwatched' : 'Mark season as watched'}
        >
          {allWatched ? <EyeOff size={13} /> : <Eye size={13} />}
          {allWatched ? 'Unwatch Season' : 'Watch Season'}
        </button>
        {canDownload && (
          <DropdownMenu
            compact
            items={[
              {
                label: 'Download Season',
                icon: Download,
                onClick: () => void handleDownloadSeason(),
              },
            ]}
          />
        )}
      </div>

      {/* Episode list in a glass card */}
      <div className={styles.episodeCard}>
        {currentEpisodes.map((ep: any) => {
          const epNum = ep.episode ?? ep.number
          const epProgress = seriesProgress?.[`${ep.season}-${epNum}`]
          const isWatched = epProgress?.isWatched ?? false
          const progressPercent = epProgress?.progressPercent ?? 0

          // Find matching download record
          const dl = downloads.find(
            (d) =>
              d.mediaId === meta.id &&
              d.season === ep.season &&
              d.episode === epNum &&
              d.profileId === profileId
          )

          const isCompleted = dl?.status === 'completed'
          const isActive = dl?.status === 'downloading'
          const isPaused = dl?.status === 'paused'
          const isQueued = dl?.status === 'queued'
          const isFailed = dl?.status === 'failed'
          const isInProgress = isActive || isPaused || isQueued

          const speed = dl?.speed ?? 0
          const dlProgress = Math.max(0, Math.min(100, dl?.progress ?? 0))
          const inferredTotal =
            dl && dl.fileSize > 0
              ? dl.fileSize
              : dlProgress > 0 && dl
                ? Math.round(dl.downloadedBytes / (dlProgress / 100))
                : 0
          const remainingBytes = Math.max(0, inferredTotal - (dl?.downloadedBytes ?? 0))
          const etaSeconds =
            isActive && speed > 0 && remainingBytes > 0 ? Math.ceil(remainingBytes / speed) : 0

          const epTitle = ep.title || ep.name || `Episode ${epNum}`

          return (
            <ContextMenu
              key={ep.id || `${ep.season}-${epNum}`}
              items={[
                {
                  label: 'Stream online',
                  icon: Play,
                  onClick: () => onSelect(ep.season, epNum, epTitle, false),
                },
                {
                  label: 'Quick play',
                  icon: Play,
                  onClick: () => onPlay(ep.season, epNum, epTitle),
                },
                ...(canDownload && !isCompleted && !isInProgress
                  ? [
                      {
                        label: 'Download episode',
                        icon: Download,
                        onClick: () =>
                          void handleDownloadEpisode({
                            season: ep.season,
                            episode: epNum,
                            title: epTitle,
                            episodeId: ep.id || `${ep.season}:${epNum}`,
                            thumbnailUrl: ep.thumbnail,
                          }),
                      },
                    ]
                  : []),
                ...(isCompleted && dl
                  ? [
                      { label: 'Play offline', icon: Play, onClick: () => handlePlayOffline(dl) },
                      {
                        label: 'Delete download',
                        icon: Trash2,
                        onClick: () => handleDeleteDownload(dl.id),
                      },
                    ]
                  : []),
                { type: 'separator' as const },
                {
                  label: isWatched ? 'Mark as unwatched' : 'Mark as watched',
                  icon: isWatched ? EyeOff : Eye,
                  onClick: () => onToggleWatched(ep.season, epNum),
                },
                {
                  label: 'Mark all before this as watched',
                  icon: ChevronUp,
                  onClick: () => onMarkEpisodesBefore(ep.season, epNum, true),
                },
              ]}
            >
              <div
                className={styles.episodeRow}
                onClick={() => onSelect(ep.season, epNum, epTitle, false)}
              >
                {/* Thumbnail */}
                <div className={styles.epThumb}>
                  {ep.thumbnail ? (
                    <LazyImage
                      src={ep.thumbnail}
                      alt={epTitle}
                      className={styles.epThumbImg}
                      style={{ height: '100%', minHeight: 0 }}
                    />
                  ) : (
                    <div className={styles.epThumbFallback}>
                      <Play size={20} />
                    </div>
                  )}
                  <span className={styles.epThumbNum}>{epNum}</span>
                  {progressPercent > 0 && !isWatched && (
                    <div className={styles.epThumbProgress}>
                      <div
                        className={styles.epThumbProgressFill}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}
                  {isWatched && (
                    <div className={styles.epThumbWatched}>
                      <Check size={10} color="#fff" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className={styles.epInfo}>
                  <div className={`${styles.epTitle} ${isWatched ? styles.epTitleWatched : ''}`}>
                    {epTitle}
                  </div>

                  <div className={styles.epMeta}>
                    {showImdbRatings && ep.rating && (
                      <span className={styles.epRating}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#f5c518">
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                        {Number(ep.rating).toFixed(1)}
                      </span>
                    )}
                    {showAgeRatings && (ep.certification || ep.contentRating) && (
                      <span>{ep.certification || ep.contentRating}</span>
                    )}
                    {ep.runtime && <span>{ep.runtime}</span>}
                    {progressPercent > 0 && !isWatched && (
                      <span style={{ color: '#a855f7' }}>{progressPercent}%</span>
                    )}
                    {isCompleted && dl && (
                      <span className={`${styles.dlBadge} ${styles.dlBadgeOffline}`}>
                        {formatBytes(dl.fileSize || dl.downloadedBytes) || dl.quality}
                      </span>
                    )}
                    {isActive && (
                      <span className={`${styles.dlBadge} ${styles.dlBadgeDownloading}`}>
                        downloading
                      </span>
                    )}
                    {isQueued && (
                      <span className={`${styles.dlBadge} ${styles.dlBadgeQueued}`}>queued</span>
                    )}
                    {isPaused && (
                      <span className={`${styles.dlBadge} ${styles.dlBadgeQueued}`}>paused</span>
                    )}
                    {isFailed && (
                      <span className={`${styles.dlBadge} ${styles.dlBadgeFailed}`}>
                        <AlertCircle size={9} /> failed
                      </span>
                    )}
                  </div>

                  {/* In-progress download detail */}
                  {isInProgress && dl && (
                    <div className={styles.epDlProgress} onClick={(e) => e.stopPropagation()}>
                      <CircularProgress
                        progress={dlProgress}
                        showText
                        size={28}
                        strokeWidth={2.5}
                        color={isPaused ? 'rgba(255,255,255,0.4)' : '#a855f7'}
                      />
                      <div className={styles.epDlProgressStats}>
                        <span>
                          {formatBytes(dl.downloadedBytes)}
                          {inferredTotal > 0 ? ` / ${formatBytes(inferredTotal)}` : ''}
                        </span>
                        {isActive && speed > 0 && (
                          <span className={styles.epDlSpeed}>
                            {formatSpeed(speed)}
                            {etaSeconds > 0 ? ` · ${formatEta(etaSeconds)}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Episode overview */}
                  {ep.overview && !isInProgress && (
                    <p className={styles.epOverview}>{ep.overview}</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className={styles.epActions} onClick={(e) => e.stopPropagation()}>
                  {isCompleted && dl ? (
                    <>
                      <button
                        className={`${styles.epBtn} ${styles.epBtnDelete}`}
                        onClick={() => handleDeleteDownload(dl.id)}
                        title="Delete download"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        className={`${styles.epBtn} ${styles.epBtnPrimary}`}
                        onClick={() => handlePlayOffline(dl)}
                        title="Play offline"
                      >
                        <Play size={14} fill="currentColor" />
                      </button>
                    </>
                  ) : isInProgress && dl ? (
                    <>
                      <button
                        className={styles.epBtn}
                        onClick={() => handlePauseResume(dl.id, isActive)}
                        title={isActive ? 'Pause' : 'Resume'}
                      >
                        {isActive ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <button
                        className={`${styles.epBtn} ${styles.epBtnDelete}`}
                        onClick={() => handleCancel(dl.id)}
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : isFailed && dl ? (
                    <>
                      <button
                        className={`${styles.epBtn} ${styles.epBtnDelete}`}
                        onClick={() => handleDeleteDownload(dl.id)}
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        className={styles.epBtn}
                        onClick={() => downloadService.resume(dl.id).catch(() => {})}
                        title="Retry"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      {canDownload && (
                        <button
                          className={styles.epBtn}
                          onClick={() =>
                            void handleDownloadEpisode({
                              season: ep.season,
                              episode: epNum,
                              title: epTitle,
                              episodeId: ep.id || `${ep.season}:${epNum}`,
                              thumbnailUrl: ep.thumbnail,
                            })
                          }
                          title="Download"
                        >
                          <Download size={14} />
                        </button>
                      )}
                      <button
                        className={`${styles.epBtn} ${styles.epBtnPrimary}`}
                        onClick={() => onPlay(ep.season, epNum, epTitle)}
                        title="Quick play"
                      >
                        <Play size={14} fill="currentColor" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </ContextMenu>
          )
        })}
      </div>
    </>
  )
}
