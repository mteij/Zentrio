import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Check, Minus } from 'lucide-react'
import type { DownloadRecord } from '../../services/downloads/download-service'
import styles from './Downloads.module.css'

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

interface Props {
  episodes: DownloadRecord[]
  profileId: string
  onDelete: (id: string) => void
  // ── Selection ──
  selectionMode?: boolean
  selectionState?: 'all' | 'some' | 'none'
  onLongPress?: () => void
  onSelect?: () => void
}

export function SeriesGroup({ episodes, profileId, selectionMode, selectionState = 'none', onLongPress, onSelect }: Props) {
  const navigate = useNavigate()
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sorted = [...episodes].sort((a, b) => {
    const sa = a.season ?? 0, sb = b.season ?? 0
    if (sa !== sb) return sa - sb
    return (a.episode ?? 0) - (b.episode ?? 0)
  })

  const rep = sorted[0]
  const totalBytes = episodes.reduce((sum, e) => sum + (e.fileSize || e.downloadedBytes || 0), 0)

  const seasonMap = new Map<number, number>()
  for (const ep of episodes) {
    const s = ep.season ?? 0
    seasonMap.set(s, (seasonMap.get(s) ?? 0) + 1)
  }
  const seasonSummary = [...seasonMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([s, count]) => `S${s} · ${count} ep${count !== 1 ? 's' : ''}`)
    .join('  ')

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
  const handleClick = () => {
    if (selectionMode) {
      onSelect?.()
    } else {
      navigate(`/streaming/${profileId}/series/${rep.mediaId}`)
    }
  }

  const isSelected = selectionState !== 'none'

  return (
    <div
      className={`${styles.seriesGroup} ${isSelected ? styles.seriesGroupSelected : ''}`}
      onPointerDown={handlePointerDown}
      onPointerUp={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onContextMenu={handleContextMenu}
    >
      <div className={styles.seriesGroupHeader} onClick={handleClick}>
        {selectionMode && (
          <div className={`${styles.selectionCheck} ${selectionState === 'all' ? styles.selectionCheckSelected : selectionState === 'some' ? styles.selectionCheckPartial : ''}`}>
            {selectionState === 'all' && <Check size={12} strokeWidth={3} />}
            {selectionState === 'some' && <Minus size={12} strokeWidth={3} />}
          </div>
        )}

        <div className={styles.seriesGroupPosterWrap}>
          {rep.posterPath ? (
            <img src={rep.posterPath} alt={rep.title} className={styles.seriesGroupPoster} />
          ) : (
            <div className={styles.seriesGroupPosterFallback}>{rep.title[0]}</div>
          )}
        </div>

        <div className={styles.seriesGroupInfo}>
          <div className={styles.seriesGroupTitle}>{rep.title}</div>
          <div className={styles.seriesGroupMeta}>
            <span>{episodes.length} episode{episodes.length !== 1 ? 's' : ''}</span>
            <span className={styles.seriesGroupDot}>·</span>
            <span>{formatBytes(totalBytes)}</span>
          </div>
          {seasonSummary && (
            <div className={styles.seriesGroupSeasons}>{seasonSummary}</div>
          )}
        </div>

        {!selectionMode && (
          <div className={styles.seriesGroupChevron}>
            <ChevronRight size={18} />
          </div>
        )}
      </div>
    </div>
  )
}
