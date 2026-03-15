import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download, Settings, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { useDownloads } from '../../hooks/useDownloads'
import { useDownloadStore } from '../../stores/downloadStore'
import { DownloadProgress } from '../../components/downloads/DownloadProgress'
import { DownloadCard } from '../../components/downloads/DownloadCard'
import { SeriesGroup } from '../../components/downloads/SeriesGroup'
import { StoragePanel } from '../../components/downloads/StoragePanel'
import { downloadService, type DownloadRecord } from '../../services/downloads/download-service'
import styles from '../../components/downloads/Downloads.module.css'
import layoutStyles from '../../styles/Streaming.module.css'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('Downloads')

function groupSeriesEpisodes(records: DownloadRecord[]): Map<string, DownloadRecord[]> {
  const groups = new Map<string, DownloadRecord[]>()
  for (const rec of records) {
    const existing = groups.get(rec.mediaId) ?? []
    existing.push(rec)
    groups.set(rec.mediaId, existing)
  }
  return groups
}

export function StreamingDownloads() {
  const { profileId } = useParams<{ profileId: string }>()
  const { inProgress, completed, failed } = useDownloads(profileId)
  const { removeDownload, setDownloads } = useDownloadStore()
  const [showStorage, setShowStorage] = useState(false)

  // ── Bulk selection ──────────────────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const enterSelection = (ids: string[]) => {
    setSelectionMode(true)
    setSelectedIds(new Set(ids))
    setConfirmBulkDelete(false)
  }

  const toggleSelection = (ids: string[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      const allSelected = ids.every(id => prev.has(id))
      if (allSelected) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  const exitSelection = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setConfirmBulkDelete(false)
  }

  const handleSelectAll = () => {
    const allIds = completed.map(r => r.id)
    const allSelected = allIds.every(id => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allIds))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirmBulkDelete) { setConfirmBulkDelete(true); return }
    setBulkDeleting(true)
    try {
      for (const id of selectedIds) {
        try { await downloadService.delete(id) } catch { /* best effort */ }
        removeDownload(id)
      }
      exitSelection()
    } catch (e) {
      log.error('bulk delete error', e)
      toast.error('Some items could not be deleted')
    } finally {
      setBulkDeleting(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  const hasContent = inProgress.length > 0 || completed.length > 0 || failed.length > 0

  // Split completed into movies (flat) and series (grouped)
  const completedMovies = completed.filter(r => r.mediaType === 'movie')
  const completedSeriesEpisodes = completed.filter(r => r.mediaType === 'series')
  const seriesGroups = groupSeriesEpisodes(completedSeriesEpisodes)

  const handleClearAll = () => {
    setDownloads([])
  }

  const allCompleted = completed.map(r => r.id)
  const allSelected = allCompleted.length > 0 && allCompleted.every(id => selectedIds.has(id))

  // Pick a representative poster for the ambient backdrop
  const backdropPoster = completed[0]?.posterPath ?? inProgress[0]?.posterPath ?? failed[0]?.posterPath

  return (
    <>
      {backdropPoster && (
        <div className={layoutStyles.pageAmbientBackground} style={{ backgroundImage: `url(${backdropPoster})` }} />
      )}
      <div className={`${layoutStyles.streamingLayout} ${styles.downloadsPage}`}>
      <div className={styles.downloadsHeader}>
        {selectionMode ? (
          <>
            <span className={styles.downloadsSelectionCount}>
              {selectedIds.size} selected
            </span>
            <div className={styles.downloadsSelectionActions}>
              <button className={styles.downloadsSelectAllBtn} onClick={handleSelectAll}>
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
              <button
                className={`${styles.bulkDeleteBtn} ${confirmBulkDelete ? styles.bulkDeleteBtnConfirm : ''}`}
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0 || bulkDeleting}
              >
                <Trash2 size={14} />
                {confirmBulkDelete ? 'Confirm' : selectedIds.size > 0 ? `Delete ${selectedIds.size}` : 'Delete'}
              </button>
              <button className={styles.downloadsDoneBtn} onClick={exitSelection}>
                <X size={16} />
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className={styles.downloadsTitle}>Downloads</h1>
            <button
              className={styles.downloadsGearBtn}
              onClick={() => setShowStorage(true)}
              title="Storage settings"
            >
              <Settings size={18} />
            </button>
          </>
        )}
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
      {(completedMovies.length > 0 || seriesGroups.size > 0) && (
        <>
          <div className={styles.sectionHeader}>
            Ready to Watch
            <span className={styles.sectionCount}>{completed.length}</span>
          </div>

          <div className={styles.cardList}>
            {/* Series groups first */}
            {[...seriesGroups.entries()].map(([mediaId, episodes]) => {
              const episodeIds = episodes.map(e => e.id)
              const selectedCount = episodeIds.filter(id => selectedIds.has(id)).length
              const selectionState: 'all' | 'some' | 'none' =
                selectedCount === 0 ? 'none' :
                selectedCount === episodeIds.length ? 'all' : 'some'
              return (
                <SeriesGroup
                  key={mediaId}
                  episodes={episodes}
                  profileId={profileId!}
                  onDelete={removeDownload}
                  selectionMode={selectionMode}
                  selectionState={selectionState}
                  onLongPress={() => enterSelection(episodeIds)}
                  onSelect={() => toggleSelection(episodeIds)}
                />
              )
            })}

            {/* Movies as flat cards */}
            {completedMovies.map((rec) => (
              <DownloadCard
                key={rec.id}
                record={rec}
                profileId={profileId!}
                onDelete={removeDownload}
                selectionMode={selectionMode}
                selected={selectedIds.has(rec.id)}
                onLongPress={() => enterSelection([rec.id])}
                onSelect={() => toggleSelection([rec.id])}
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
    </>
  )
}
