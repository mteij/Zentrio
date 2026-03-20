import { Info, Play } from 'lucide-react'
import { sanitizeImgSrc } from '../../lib/url'
import { TvActionStrip, TvDialog } from './TvPageScaffold'
import { TvFocusItem } from './TvFocusContext'
import styles from './TvPosterActionDialog.module.css'

interface TvPosterActionDialogProps {
  open: boolean
  title: string
  poster?: string | null
  description?: string
  onClose: () => void
  onPlay: () => void
  onInfo: () => void
}

export function TvPosterActionDialog({
  open,
  title,
  poster,
  description,
  onClose,
  onPlay,
  onInfo,
}: TvPosterActionDialogProps) {
  return (
    <TvDialog title={title} open={open} onBack={onClose} initialZoneId="tv-poster-actions">
      <div className={styles.dialogContent}>
        <div
          className={styles.poster}
          style={poster ? { backgroundImage: `url(${sanitizeImgSrc(poster)})` } : undefined}
          aria-hidden="true"
        />
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Choose Action</p>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.description}>{description || 'Play immediately or open the full details page.'}</p>
          <div className={styles.actions}>
            <TvActionStrip zoneId="tv-poster-actions">
              <TvFocusItem
                id="tv-poster-action-play"
                className={`${styles.actionButton} ${styles.actionPrimary}`}
                onActivate={onPlay}
              >
                <Play size={16} fill="currentColor" />
                <span>Play</span>
              </TvFocusItem>
              <TvFocusItem
                id="tv-poster-action-info"
                className={styles.actionButton}
                onActivate={onInfo}
              >
                <Info size={16} />
                <span>Info</span>
              </TvFocusItem>
            </TvActionStrip>
          </div>
        </div>
      </div>
    </TvDialog>
  )
}
