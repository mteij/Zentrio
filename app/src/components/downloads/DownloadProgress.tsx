import { Pause, Play, X, AlertCircle, RefreshCw } from 'lucide-react'
import { DownloadRecord, downloadService } from '../../services/downloads/download-service'
import styles from './Downloads.module.css'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

interface Props {
  record: DownloadRecord
  onDelete: (id: string) => void
}

export function DownloadProgress({ record, onDelete }: Props) {
  const isActive = record.status === 'downloading'
  const isPaused = record.status === 'paused'
  const isFailed = record.status === 'failed'
  const progress = Math.max(0, Math.min(100, record.progress))

  const handlePauseResume = async () => {
    try {
      if (isActive) {
        await downloadService.pause(record.id)
      } else {
        await downloadService.resume(record.id)
      }
    } catch (e) {
      console.error('[DownloadProgress] pause/resume error', e)
    }
  }

  const handleCancel = async () => {
    try {
      await downloadService.cancel(record.id)
      onDelete(record.id)
    } catch (e) {
      console.error('[DownloadProgress] cancel error', e)
    }
  }

  const handleRetry = async () => {
    try {
      await downloadService.resume(record.id)
    } catch (e) {
      console.error('[DownloadProgress] retry error', e)
    }
  }

  return (
    <div className={`${styles.progressItem} ${isFailed ? styles.progressItemFailed : ''}`}>
      {record.posterPath && (
        <img src={record.posterPath} alt={record.title} className={styles.progressPoster} />
      )}
      <div className={styles.progressInfo}>
        <div className={styles.progressTitleRow}>
          <span className={styles.progressTitle}>
            {record.title}
            {record.episodeTitle && (
              <span className={styles.progressEpisode}> · {record.episodeTitle}</span>
            )}
          </span>
          <span className={styles.progressQuality}>{record.quality}</span>
        </div>

        {isFailed ? (
          <div className={styles.progressError}>
            <AlertCircle size={12} />
            <span>{record.errorMessage || 'Download failed'}</span>
          </div>
        ) : (
          <>
            <div className={styles.progressBarTrack}>
              <div
                className={`${styles.progressBarFill} ${isPaused ? styles.progressBarPaused : ''}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className={styles.progressStats}>
              <span>{Math.round(progress)}%</span>
              {record.fileSize > 0 && (
                <span>{formatBytes(record.downloadedBytes)} / {formatBytes(record.fileSize)}</span>
              )}
            </div>
          </>
        )}
      </div>

      <div className={styles.progressActions}>
        {isFailed ? (
          <button className={styles.progressBtn} onClick={handleRetry} title="Retry">
            <RefreshCw size={16} />
          </button>
        ) : (
          <button className={styles.progressBtn} onClick={handlePauseResume} title={isActive ? 'Pause' : 'Resume'}>
            {isActive ? <Pause size={16} /> : <Play size={16} />}
          </button>
        )}
        <button className={`${styles.progressBtn} ${styles.progressBtnCancel}`} onClick={handleCancel} title="Cancel">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
