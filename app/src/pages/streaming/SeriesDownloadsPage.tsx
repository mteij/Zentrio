import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Play, Trash2, Pause, X, RefreshCw, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useDownloads } from '../../hooks/useDownloads'
import { useDownloadStore } from '../../stores/downloadStore'
import { downloadService, type DownloadRecord } from '../../services/downloads/download-service'
import { isTauri } from '../../lib/auth-client'
import { CircularProgress } from '../../components/ui/CircularProgress'
import styles from '../../components/downloads/SeriesDownloads.module.css'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('SeriesDownloadsPage')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
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
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function inferMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'mp4': case 'm4v': return 'video/mp4'
    case 'webm': return 'video/webm'
    case 'mkv': return 'video/x-matroska'
    default: return 'video/mp4'
  }
}

// ─── Episode row ──────────────────────────────────────────────────────────────

interface EpisodeRowProps {
  record: DownloadRecord
  profileId: string
  onDelete: (id: string) => void
}

function EpisodeRow({ record, profileId, onDelete }: EpisodeRowProps) {
  const navigate = useNavigate()
  const isCompleted = record.status === 'completed'
  const isActive = record.status === 'downloading'
  const isPaused = record.status === 'paused'
  const isQueued = record.status === 'queued'
  const isFailed = record.status === 'failed'
  const progress = Math.max(0, Math.min(100, record.progress))
  const watchedPct = Math.max(0, Math.min(100, record.watchedPercent ?? 0))
  const speed = Number.isFinite(record.speed) ? (record.speed ?? 0) : 0
  const inferredTotal = record.fileSize > 0
    ? record.fileSize
    : progress > 0 ? Math.round(record.downloadedBytes / (progress / 100)) : 0
  const remainingBytes = Math.max(0, inferredTotal - record.downloadedBytes)
  const etaSeconds = isActive && speed > 0 && remainingBytes > 0
    ? Math.ceil(remainingBytes / speed) : null

  const epLabel = record.season != null && record.episode != null
    ? `E${record.episode}`
    : null

  const handlePlay = async () => {
    if (!isCompleted) return
    try {
      let url = `file://${record.filePath}`
      let subtitles: Array<{ url: string; lang: string }> = []
      if (isTauri()) {
        const { convertFileSrc } = await import('@tauri-apps/api/core')
        url = convertFileSrc(record.filePath)
        if (record.subtitlePaths?.length) {
          subtitles = record.subtitlePaths.map(s => ({ url: convertFileSrc(s.path), lang: s.lang }))
        }
      }
      navigate(`/streaming/${profileId}/player`, {
        state: {
          stream: { url, ytId: '', type: inferMimeType(record.filePath), subtitles: subtitles.length ? subtitles : undefined },
          meta: { id: record.mediaId, type: record.mediaType, name: record.title, poster: record.posterPath, season: record.season, episode: record.episode },
        },
      })
    } catch (e) {
      log.error('play error', e)
      toast.error('Failed to open file')
    }
  }

  const handlePauseResume = async () => {
    try {
      if (isActive) await downloadService.pause(record.id)
      else await downloadService.resume(record.id)
    } catch (e) {
      log.error('pause/resume error', e)
    }
  }

  const handleCancel = async () => {
    try {
      await downloadService.cancel(record.id)
      onDelete(record.id)
    } catch (e) {
      log.error('cancel error', e)
    }
  }

  const handleRetry = async () => {
    try { await downloadService.resume(record.id) } catch (e) { log.error('retry error', e) }
  }

  const handleDelete = async () => {
    try {
      await downloadService.delete(record.id)
      onDelete(record.id)
    } catch (e) {
      log.error('delete error', e)
    }
  }

  return (
    <div className={`${styles.episodeRow} ${isFailed ? styles.episodeRowFailed : ''}`}>
      {/* Episode number */}
      <div className={styles.episodeNum}>
        {epLabel ?? '—'}
      </div>

      {/* Main info */}
      <div className={styles.episodeInfo}>
        <div className={styles.episodeTitle}>
          {record.episodeTitle || (record.season != null && record.episode != null ? `Season ${record.season}, Episode ${record.episode}` : record.title)}
        </div>

        {isCompleted && (
          <div className={styles.episodeMeta}>
            <span className={styles.episodeQuality}>{record.quality}</span>
            <span className={styles.episodeSize}>{formatBytes(record.fileSize || record.downloadedBytes)}</span>
            {record.subtitlePaths && record.subtitlePaths.length > 0 && (
              <span className={styles.episodeCcBadge}>CC {record.subtitlePaths.length}</span>
            )}
            {watchedPct > 0 && watchedPct < 95 && (
              <span className={styles.episodeWatchedLabel}>{Math.round(watchedPct)}% watched</span>
            )}
            {watchedPct >= 95 && (
              <span className={styles.episodeWatchedDone}>Watched</span>
            )}
          </div>
        )}

        {(isActive || isPaused || isQueued) && !isFailed && (
          <div className={styles.episodeProgressRow}>
            <CircularProgress
              progress={progress}
              showText
              size={32}
              strokeWidth={2.5}
              color={isPaused ? 'rgba(255,255,255,0.4)' : '#a855f7'}
            />
            <div className={styles.episodeProgressStats}>
              <span>
                {formatBytes(record.downloadedBytes)}
                {inferredTotal > 0 ? ` / ${formatBytes(inferredTotal)}` : ''}
              </span>
              {isActive && speed > 0 && (
                <span className={styles.episodeSpeed}>
                  {formatSpeed(speed)}
                  {etaSeconds ? ` · ${formatEta(etaSeconds)}` : ''}
                </span>
              )}
              {isPaused && <span className={styles.episodePaused}>Paused</span>}
              {isQueued && <span className={styles.episodePaused}>Queued</span>}
            </div>
          </div>
        )}

        {isFailed && (
          <div className={styles.episodeError}>
            <AlertCircle size={12} />
            <span>{record.errorMessage || 'Download failed'}</span>
          </div>
        )}

        {isCompleted && watchedPct > 0 && (
          <div className={styles.episodeWatchBar}>
            <div className={styles.episodeWatchFill} style={{ width: `${watchedPct}%` }} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className={styles.episodeActions}>
        {isCompleted && (
          <>
            <button className={styles.episodeBtn} onClick={handlePlay} title="Play">
              <Play size={15} />
            </button>
            <button className={`${styles.episodeBtn} ${styles.episodeBtnDelete}`} onClick={handleDelete} title="Delete">
              <Trash2 size={15} />
            </button>
          </>
        )}
        {(isActive || isPaused || isQueued) && !isFailed && (
          <>
            <button className={styles.episodeBtn} onClick={handlePauseResume} title={isActive ? 'Pause' : 'Resume'}>
              {isActive ? <Pause size={15} /> : <Play size={15} />}
            </button>
            <button className={`${styles.episodeBtn} ${styles.episodeBtnDelete}`} onClick={handleCancel} title="Cancel">
              <X size={15} />
            </button>
          </>
        )}
        {isFailed && (
          <>
            <button className={styles.episodeBtn} onClick={handleRetry} title="Retry">
              <RefreshCw size={15} />
            </button>
            <button className={`${styles.episodeBtn} ${styles.episodeBtnDelete}`} onClick={handleDelete} title="Remove">
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Season section ───────────────────────────────────────────────────────────

interface SeasonSectionProps {
  season: number
  episodes: DownloadRecord[]
  profileId: string
  onDelete: (id: string) => void
  defaultOpen?: boolean
}

function SeasonSection({ season, episodes, profileId, onDelete, defaultOpen = true }: SeasonSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  const completedCount = episodes.filter(e => e.status === 'completed').length
  const totalBytes = episodes.reduce((s, e) => s + (e.fileSize || e.downloadedBytes || 0), 0)

  return (
    <div className={styles.seasonSection}>
      <button className={styles.seasonHeader} onClick={() => setOpen(o => !o)}>
        <span className={styles.seasonTitle}>Season {season}</span>
        <span className={styles.seasonMeta}>
          {completedCount}/{episodes.length} downloaded
          {totalBytes > 0 && <> · {formatBytes(totalBytes)}</>}
        </span>
        <span className={styles.seasonChevron}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>

      {open && (
        <div className={styles.seasonEpisodes}>
          {episodes.map(ep => (
            <EpisodeRow key={ep.id} record={ep} profileId={profileId} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function SeriesDownloadsPage() {
  const { profileId, mediaId } = useParams<{ profileId: string; mediaId: string }>()
  const navigate = useNavigate()
  const { removeDownload } = useDownloadStore()
  const [deletingAll, setDeletingAll] = useState(false)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)

  // Sets up live Tauri event listeners + loads from DB into global store
  useDownloads(profileId)

  const allDownloads = useDownloadStore(s => s.downloads)
  const seriesEpisodes = allDownloads.filter(
    d => d.profileId === profileId && d.mediaId === mediaId
  )

  // Sort episodes by season → episode
  const sorted = [...seriesEpisodes].sort((a, b) => {
    const sa = a.season ?? 0, sb = b.season ?? 0
    return sa !== sb ? sa - sb : (a.episode ?? 0) - (b.episode ?? 0)
  })

  // If nothing found, go back
  if (sorted.length === 0) {
    navigate(`/streaming/${profileId}/downloads`, { replace: true })
    return null
  }

  const rep = sorted[0]
  const totalBytes = sorted.reduce((s, e) => s + (e.fileSize || e.downloadedBytes || 0), 0)
  const completedEps = sorted.filter(e => e.status === 'completed')
  const completedCount = completedEps.length

  // "Play Next" — first completed episode that isn't fully watched
  const playNext = completedEps.find(e => (e.watchedPercent ?? 0) < 90)

  // Group by season
  const seasonMap = new Map<number, DownloadRecord[]>()
  for (const ep of sorted) {
    const s = ep.season ?? 0
    const arr = seasonMap.get(s) ?? []
    arr.push(ep)
    seasonMap.set(s, arr)
  }
  const seasons = [...seasonMap.entries()].sort(([a], [b]) => a - b)

  const handlePlayNext = async () => {
    if (!playNext) return
    try {
      let url = `file://${playNext.filePath}`
      let subtitles: Array<{ url: string; lang: string }> = []
      if (isTauri()) {
        const { convertFileSrc } = await import('@tauri-apps/api/core')
        url = convertFileSrc(playNext.filePath)
        if (playNext.subtitlePaths?.length) {
          subtitles = playNext.subtitlePaths.map(s => ({ url: convertFileSrc(s.path), lang: s.lang }))
        }
      }
      navigate(`/streaming/${profileId}/player`, {
        state: {
          stream: { url, ytId: '', type: inferMimeType(playNext.filePath), subtitles: subtitles.length ? subtitles : undefined },
          meta: { id: playNext.mediaId, type: 'series', name: rep.title, poster: rep.posterPath, season: playNext.season, episode: playNext.episode },
        },
      })
    } catch (e) {
      log.error('play next error', e)
    }
  }

  const handleDeleteAll = async () => {
    if (!confirmDeleteAll) { setConfirmDeleteAll(true); return }
    setDeletingAll(true)
    try {
      for (const ep of sorted) {
        try { await downloadService.delete(ep.id) } catch { /* best effort */ }
        removeDownload(ep.id)
      }
      navigate(`/streaming/${profileId}/downloads`, { replace: true })
    } catch (e) {
      log.error('delete all error', e)
    } finally {
      setDeletingAll(false)
      setConfirmDeleteAll(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Ambient background */}
      {rep.posterPath && (
        <div
          className={styles.backdrop}
          style={{ backgroundImage: `url(${rep.posterPath})` }}
        />
      )}
      <div className={styles.backdropScrim} />

      {/* Content */}
      <div className={styles.content}>

        {/* Top bar */}
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => navigate(`/streaming/${profileId}/downloads`)}>
            <ChevronLeft size={20} />
            <span>Downloads</span>
          </button>
          <button
            className={`${styles.deleteAllBtn} ${confirmDeleteAll ? styles.deleteAllBtnConfirm : ''}`}
            onClick={handleDeleteAll}
            disabled={deletingAll}
          >
            <Trash2 size={15} />
            {confirmDeleteAll ? 'Confirm delete all' : 'Delete all'}
          </button>
        </div>

        {/* Series header */}
        <div className={styles.header}>
          <div className={styles.headerPosterWrap}>
            {rep.posterPath
              ? <img src={rep.posterPath} alt={rep.title} className={styles.headerPoster} />
              : <div className={styles.headerPosterFallback}>{rep.title[0]}</div>
            }
          </div>

          <div className={styles.headerInfo}>
            <h1 className={styles.headerTitle}>{rep.title}</h1>
            <div className={styles.headerStats}>
              <span>{completedCount} of {sorted.length} downloaded</span>
              <span className={styles.headerDot}>·</span>
              <span>{seasons.length} season{seasons.length !== 1 ? 's' : ''}</span>
              {totalBytes > 0 && (
                <>
                  <span className={styles.headerDot}>·</span>
                  <span>{formatBytes(totalBytes)}</span>
                </>
              )}
            </div>

            {completedCount > 0 && (
              <div className={styles.headerProgressBar}>
                <div
                  className={styles.headerProgressFill}
                  style={{ width: `${(completedCount / sorted.length) * 100}%` }}
                />
              </div>
            )}

            {playNext ? (
              <button className={styles.playNextBtn} onClick={handlePlayNext}>
                <Play size={16} fill="currentColor" />
                <span>
                  Play Next
                  {playNext.season != null && playNext.episode != null && (
                    <span className={styles.playNextEp}> · S{playNext.season} E{playNext.episode}</span>
                  )}
                  {playNext.episodeTitle && (
                    <span className={styles.playNextEpTitle}> — {playNext.episodeTitle}</span>
                  )}
                </span>
              </button>
            ) : completedCount > 0 ? (
              <div className={styles.allWatched}>All caught up ✓</div>
            ) : null}
          </div>
        </div>

        {/* Season list */}
        <div className={styles.seasonList}>
          {seasons.map(([season, episodes], idx) => (
            <SeasonSection
              key={season}
              season={season}
              episodes={episodes}
              profileId={profileId!}
              onDelete={removeDownload}
              defaultOpen={idx === 0}
            />
          ))}
        </div>

      </div>
    </div>
  )
}
