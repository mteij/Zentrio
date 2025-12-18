import { SkeletonCard } from './SkeletonCard'
import styles from '../../styles/Streaming.module.css'

interface SkeletonRowProps {
  cardCount?: number
  showTitle?: boolean
}

export function SkeletonRow({ cardCount = 7, showTitle = true }: SkeletonRowProps) {
  return (
    <div className={styles.contentRow}>
      {showTitle && (
        <div className={styles.rowHeader}>
          <div className={styles.skeletonTitle}>
            <div className={styles.skeletonShimmer} />
          </div>
        </div>
      )}
      <div className={styles.rowWrapper}>
        <div className={styles.rowScrollContainer} style={{ cursor: 'default' }}>
          {Array.from({ length: cardCount }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
