import { useRef } from 'react'
import { Play, Trash2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { DownloadRecord, downloadService } from '../../services/downloads/download-service'
import styles from './Downloads.module.css'
import { useNavigate } from 'react-router-dom'
import { createLogger } from '../../utils/client-logger'
import { isTauri } from '../../lib/auth-client'

const log = createLogger('DownloadCard')

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function inferMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'mp4':
    case 'm4v':
      return 'video/mp4'
    case 'webm':
      return 'video/webm'
    case 'mkv':
      return 'video/x-matroska'
    case 'mov':
      return 'video/quicktime'
    case 'm3u8':
      return 'application/vnd.apple.mpegurl'
    case 'ts':
      return 'video/mp2t'
    default:
      return 'video/mp4'
  }
}

interface Props {
  record: DownloadRecord
  profileId: string
  onDelete: (id: string) => void
  /** When true, renders a more compact row without a dedicated poster */
  compact?: boolean
  // ── Selection ──
  selectionMode?: boolean
  selected?: boolean
  onLongPress?: () => void
  onSelect?: () => void
}

export function DownloadCard({ record, profileId, onDelete, compact, selectionMode, selected, onLongPress, onSelect }: Props) {
  const navigate = useNavigate()
  const watchedPct = Math.max(0, Math.min(100, record.watchedPercent ?? 0))
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Long-press / context menu for entering selection ─────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType !== 'touch') return
    longPressTimer.current = setTimeout(() => {
      onLongPress?.()
    }, 500)
  }
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    onLongPress?.()
  }
  const handleCardClick = () => {
    if (selectionMode) {
      onSelect?.()
    }
  }

  const handlePlay = async () => {
    if (selectionMode) return
    try {
      let resolvedFileUrl = `file://${record.filePath}`
      let subtitles: Array<{ url: string; lang: string }> = []

      if (isTauri()) {
        const { convertFileSrc } = await import('@tauri-apps/api/core')
        resolvedFileUrl = convertFileSrc(record.filePath)

        if (record.subtitlePaths && record.subtitlePaths.length > 0) {
          subtitles = record.subtitlePaths.map(s => ({
            url: convertFileSrc(s.path),
            lang: s.lang,
          }))
        }
      }

      const stream = {
        url: resolvedFileUrl,
        ytId: '',
        type: inferMimeType(record.filePath),
        subtitles: subtitles.length > 0 ? subtitles : undefined,
      }
      const meta = {
        id: record.mediaId,
        type: record.mediaType,
        name: record.title,
        poster: record.posterPath,
        season: record.season,
        episode: record.episode,
      }
      navigate(`/streaming/${profileId}/player`, { state: { stream, meta } })
    } catch (e) {
      log.error('play download error', e)
      toast.error('Failed to open downloaded file')
    }
  }

  const handleDelete = async () => {
    if (selectionMode) return
    try {
      await downloadService.delete(record.id)
      onDelete(record.id)
    } catch (e) {
      log.error('delete error', e)
    }
  }

  if (compact) {
    return (
      <div
        className={`${styles.cardCompact} ${selectionMode && selected ? styles.cardCompactSelected : ''}`}
        onClick={selectionMode ? handleCardClick : undefined}
        onPointerDown={handlePointerDown}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onContextMenu={handleContextMenu}
      >
        {selectionMode && (
          <div className={`${styles.selectionCheck} ${selected ? styles.selectionCheckSelected : ''}`}>
            {selected && <Check size={11} strokeWidth={3} />}
          </div>
        )}
        <div className={styles.cardCompactInfo} onClick={selectionMode ? undefined : handlePlay}>
          <div className={styles.cardCompactTitle}>
            {record.episodeTitle
              ? record.episodeTitle
              : record.season != null && record.episode != null
                ? `S${record.season} · E${record.episode}`
                : record.title}
          </div>
          <div className={styles.cardCompactMeta}>
            {record.quality} · {formatBytes(record.fileSize || record.downloadedBytes)}
            {record.subtitlePaths && record.subtitlePaths.length > 0 && (
              <span className={styles.cardSubtitleBadge}>
                CC {record.subtitlePaths.length}
              </span>
            )}
          </div>
          {watchedPct > 0 && (
            <div className={styles.watchedBarTrack}>
              <div className={styles.watchedBarFill} style={{ width: `${watchedPct}%` }} />
            </div>
          )}
        </div>
        {!selectionMode && (
          <div className={styles.cardActions}>
            <button className={styles.cardBtn} onClick={handlePlay} title="Play">
              <Play size={16} />
            </button>
            <button className={`${styles.cardBtn} ${styles.cardBtnDelete}`} onClick={handleDelete} title="Delete">
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`${styles.card} ${selectionMode && selected ? styles.cardSelected : ''}`}
      onClick={handleCardClick}
      onPointerDown={handlePointerDown}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onContextMenu={handleContextMenu}
    >
      {selectionMode && (
        <div className={`${styles.selectionCheck} ${selected ? styles.selectionCheckSelected : ''}`}>
          {selected && <Check size={12} strokeWidth={3} />}
        </div>
      )}

      <div className={styles.cardPosterWrap}>
        {record.posterPath ? (
          <img src={record.posterPath} alt={record.title} className={styles.cardPoster} />
        ) : (
          <div className={styles.cardPosterFallback}>{record.title[0]}</div>
        )}
        {!selectionMode && (
          <div className={styles.cardPlayOverlay} onClick={handlePlay}>
            <Play size={28} fill="white" />
          </div>
        )}
      </div>

      <div className={styles.cardInfo}>
        <div className={styles.cardTitle}>{record.title}</div>
        {record.episodeTitle && (
          <div className={styles.cardEpisode}>{record.episodeTitle}</div>
        )}
        <div className={styles.cardMeta}>
          <span>{record.quality} · {formatBytes(record.fileSize || record.downloadedBytes)}</span>
          {record.subtitlePaths && record.subtitlePaths.length > 0 && (
            <span className={styles.cardSubtitleBadge}>
              CC {record.subtitlePaths.length}
            </span>
          )}
        </div>
        {watchedPct > 0 && (
          <div className={styles.watchedBarTrack}>
            <div className={styles.watchedBarFill} style={{ width: `${watchedPct}%` }} />
          </div>
        )}
      </div>

      {!selectionMode && (
        <div className={styles.cardActions}>
          <button className={styles.cardBtn} onClick={handlePlay} title="Play">
            <Play size={18} />
          </button>
          <button className={`${styles.cardBtn} ${styles.cardBtnDelete}`} onClick={handleDelete} title="Delete download">
            <Trash2 size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
