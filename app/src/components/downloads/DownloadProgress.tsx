import { Pause, Play, X, AlertCircle, RefreshCw } from 'lucide-react'
import { CircularProgress } from '../ui/CircularProgress'
import { DownloadRecord, downloadService } from '../../services/downloads/download-service'
import styles from './Downloads.module.css'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('DownloadProgress')

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
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
  const speed = Number.isFinite(record.speed) ? (record.speed as number) : 0
  const inferredTotalSize = record.fileSize > 0
    ? record.fileSize
    : (progress > 0 ? Math.round(record.downloadedBytes / (progress / 100)) : 0)
  const remainingBytes = Math.max(0, inferredTotalSize - record.downloadedBytes)
  const etaSeconds = isActive && speed > 0 && remainingBytes > 0
    ? Math.ceil(remainingBytes / speed)
    : null

  const handlePauseResume = async () => {
    try {
      if (isActive) {
        await downloadService.pause(record.id)
      } else {
        await downloadService.resume(record.id)
      }
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
    try {
      await downloadService.resume(record.id)
    } catch (e) {
      log.error('retry error', e)
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
            <div className={styles.progressStats}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CircularProgress 
                  progress={progress} 
                  showText={true} 
                  size={36} 
                  strokeWidth={3} 
                  color={isPaused ? 'rgba(255, 255, 255, 0.5)' : '#a855f7'}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span>
                    {formatBytes(record.downloadedBytes)}
                    {inferredTotalSize > 0 ? ` / ${formatBytes(inferredTotalSize)}` : ''}
                  </span>
                  {(isActive || isPaused) && speed > 0 && (
                    <span>
                      {formatBytes(speed)}/s
                      {etaSeconds ? ` · ETA ${formatEta(etaSeconds)}` : ''}
                    </span>
                  )}
                  {isPaused && <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Paused</span>}
                </div>
              </div>
            </div>
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
