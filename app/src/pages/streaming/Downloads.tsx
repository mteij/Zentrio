import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download, Settings } from 'lucide-react'
import { useDownloads } from '../../hooks/useDownloads'
import { useDownloadStore } from '../../stores/downloadStore'
import { DownloadProgress } from '../../components/downloads/DownloadProgress'
import { DownloadCard } from '../../components/downloads/DownloadCard'
import { StoragePanel } from '../../components/downloads/StoragePanel'
import styles from '../../components/downloads/Downloads.module.css'
import layoutStyles from '../../styles/Streaming.module.css'

export function StreamingDownloads() {
  const { profileId } = useParams<{ profileId: string }>()
  const { inProgress, completed, failed } = useDownloads(profileId)
  const { removeDownload, setDownloads, downloads } = useDownloadStore()
  const [showStorage, setShowStorage] = useState(false)

  const hasContent = inProgress.length > 0 || completed.length > 0 || failed.length > 0

  const handleClearAll = () => {
    setDownloads([])
  }

  return (
    <div className={`${layoutStyles.streamingLayout} ${layoutStyles.streamingLayoutNoHero} ${styles.downloadsPage}`}>
      <div className={styles.downloadsHeader}>
        <h1 className={styles.downloadsTitle}>Downloads</h1>
        <button
          className={styles.downloadsGearBtn}
          onClick={() => setShowStorage(true)}
          title="Storage settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {!hasContent && (
        <div className={styles.emptyState}>
          <Download size={56} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>No downloads yet</p>
          <p className={styles.emptyDesc}>
            Tap the download icon on any movie or series to save it for offline viewing.
          </p>
        </div>
      )}

      {/* ── In Progress ── */}
      {(inProgress.length > 0 || failed.length > 0) && (
        <>
          <div className={styles.sectionHeader}>
            In Progress
            <span className={styles.sectionCount}>{inProgress.length + failed.length}</span>
          </div>
          <div className={styles.progressList}>
            {[...inProgress, ...failed].map((rec) => (
              <DownloadProgress
                key={rec.id}
                record={rec}
                onDelete={removeDownload}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Ready to Watch ── */}
      {completed.length > 0 && (
        <>
          <div className={styles.sectionHeader}>
            Ready to Watch
            <span className={styles.sectionCount}>{completed.length}</span>
          </div>
          <div className={styles.cardList}>
            {completed.map((rec) => (
              <DownloadCard
                key={rec.id}
                record={rec}
                profileId={profileId!}
                onDelete={removeDownload}
              />
            ))}
          </div>
        </>
      )}

      {showStorage && profileId && (
        <StoragePanel
          profileId={profileId}
          onClose={() => setShowStorage(false)}
          onClear={handleClearAll}
        />
      )}
    </div>
  )
}
