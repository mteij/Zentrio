import styles from '../../styles/Streaming.module.css'

export function SkeletonDetails() {
  return (
    <div className={styles.detailsContainer}>
      <div className={styles.pageAmbientBackground} style={{ background: 'rgba(20, 20, 20, 0.3)' }} />
      
      <div className={styles.detailsContent}>
        {/* Skeleton Poster */}
        <div className={styles.detailsPoster} style={{ background: 'rgba(255, 255, 255, 0.05)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ aspectRatio: '2/3', position: 'relative', overflow: 'hidden' }}>
            <div className={styles.skeletonShimmer} />
          </div>
        </div>

        {/* Skeleton Info */}
        <div className={styles.detailsInfo}>
          {/* Title skeleton */}
          <div style={{ 
            width: '70%', 
            height: '48px', 
            background: 'rgba(255, 255, 255, 0.08)', 
            borderRadius: '8px', 
            marginBottom: '16px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div className={styles.skeletonShimmer} />
          </div>

          {/* Meta row skeleton */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            {[80, 60, 70].map((w, i) => (
              <div key={i} style={{ 
                width: `${w}px`, 
                height: '28px', 
                background: 'rgba(255, 255, 255, 0.05)', 
                borderRadius: '4px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div className={styles.skeletonShimmer} />
              </div>
            ))}
          </div>

          {/* Actions skeleton */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '40px' }}>
            <div style={{ 
              width: '120px', 
              height: '44px', 
              background: 'rgba(255, 255, 255, 0.1)', 
              borderRadius: '8px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div className={styles.skeletonShimmer} />
            </div>
            <div style={{ 
              width: '140px', 
              height: '44px', 
              background: 'rgba(255, 255, 255, 0.05)', 
              borderRadius: '8px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div className={styles.skeletonShimmer} />
            </div>
          </div>

          {/* Description skeleton */}
          <div style={{ 
            width: '100%', 
            height: '80px', 
            background: 'rgba(255, 255, 255, 0.05)', 
            borderRadius: '6px', 
            marginBottom: '30px',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div className={styles.skeletonShimmer} />
          </div>

          {/* Episodes list skeleton */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ 
                width: '100%', 
                height: '64px', 
                background: 'rgba(255, 255, 255, 0.03)', 
                borderRadius: '8px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div className={styles.skeletonShimmer} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
