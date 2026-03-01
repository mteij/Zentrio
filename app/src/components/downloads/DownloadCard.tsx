import { Play, Trash2, CheckCircle } from 'lucide-react'
import { DownloadRecord, downloadService } from '../../services/downloads/download-service'
import styles from './Downloads.module.css'
import { useNavigate } from 'react-router-dom'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

interface Props {
  record: DownloadRecord
  profileId: string
  onDelete: (id: string) => void
}

export function DownloadCard({ record, profileId, onDelete }: Props) {
  const navigate = useNavigate()

  const handlePlay = () => {
    const stream = { url: `file://${record.filePath}` }
    const meta = {
      id: record.mediaId,
      type: record.mediaType,
      name: record.title,
      poster: record.posterPath,
      season: record.season,
      episode: record.episode,
    }
    navigate(
      `/streaming/${profileId}/player?stream=${encodeURIComponent(JSON.stringify(stream))}&meta=${encodeURIComponent(JSON.stringify(meta))}`
    )
  }

  const handleDelete = async () => {
    try {
      await downloadService.delete(record.id)
      onDelete(record.id)
    } catch (e) {
      console.error('[DownloadCard] delete error', e)
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
          <span>{record.quality} · {formatBytes(record.fileSize)}</span>
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
