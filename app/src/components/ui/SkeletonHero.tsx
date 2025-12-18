import styles from '../../styles/Streaming.module.css'

export function SkeletonHero() {
  return (
    <div className={styles.heroSection}>
      <div className={styles.heroBackdrop}>
        <div className={styles.skeletonHeroImage}>
          <div className={styles.skeletonShimmer} />
        </div>
      </div>
      <div className={styles.heroOverlay} />
      <div className={styles.heroContent}>
        <div className={styles.heroInfo}>
          {/* Skeleton chip */}
          <div className={styles.skeletonChip}>
            <div className={styles.skeletonShimmer} />
          </div>
          {/* Skeleton title */}
          <div className={styles.skeletonHeroTitle}>
            <div className={styles.skeletonShimmer} />
          </div>
          {/* Skeleton description */}
          <div className={styles.skeletonDescription}>
            <div className={styles.skeletonShimmer} />
          </div>
          {/* Skeleton buttons */}
          <div className={styles.heroActions}>
            <div className={styles.skeletonButton}>
              <div className={styles.skeletonShimmer} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
