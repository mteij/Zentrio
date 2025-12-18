import styles from '../../styles/Streaming.module.css'

interface SkeletonCardProps {
  className?: string
}

export function SkeletonCard({ className = '' }: SkeletonCardProps) {
  return (
    <div className={`${styles.skeletonCard} ${className}`}>
      <div className={styles.skeletonPoster}>
        <div className={styles.skeletonShimmer} />
      </div>
    </div>
  )
}
