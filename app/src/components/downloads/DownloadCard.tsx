import { Play, Trash2, CheckCircle } from 'lucide-react'
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
}

export function DownloadCard({ record, profileId, onDelete }: Props) {
  const navigate = useNavigate()

  const handlePlay = async () => {
    try {
      let resolvedFileUrl = `file://${record.filePath}`
      if (isTauri()) {
        const { convertFileSrc } = await import('@tauri-apps/api/core')
        resolvedFileUrl = convertFileSrc(record.filePath)
      }

      const stream = { url: resolvedFileUrl, ytId: '', type: inferMimeType(record.filePath) }
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
      import('sonner').then(({ toast }) => toast.error('Failed to open downloaded file'))
    }
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
    <div className={styles.card}>
      <div className={styles.cardPosterWrap}>
        {record.posterPath ? (
          <img src={record.posterPath} alt={record.title} className={styles.cardPoster} />
        ) : (
          <div className={styles.cardPosterFallback}>{record.title[0]}</div>
        )}
        <div className={styles.cardPlayOverlay} onClick={handlePlay}>
          <Play size={28} fill="white" />
        </div>
      </div>

      <div className={styles.cardInfo}>
        <div className={styles.cardTitle}>{record.title}</div>
        {record.episodeTitle && (
          <div className={styles.cardEpisode}>{record.episodeTitle}</div>
        )}
        <div className={styles.cardMeta}>
          <CheckCircle size={12} className={styles.cardComplete} />
          <span>{record.quality} - {formatBytes(record.fileSize || record.downloadedBytes)}</span>
        </div>
      </div>

      <div className={styles.cardActions}>
        <button className={styles.cardBtn} onClick={handlePlay} title="Play">
          <Play size={18} />
        </button>
        <button className={`${styles.cardBtn} ${styles.cardBtnDelete}`} onClick={handleDelete} title="Delete download">
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  )
}
