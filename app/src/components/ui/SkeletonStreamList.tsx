import styles from '../../styles/Streaming.module.css'

export function SkeletonStreamList() {
  return (
    <div className={styles.streamList} style={{ marginTop: '20px' }}>
       {/* Skeleton Filter */}
      <div style={{ 
        width: '240px', 
        height: '42px', 
        background: 'rgba(255, 255, 255, 0.05)', 
        borderRadius: '12px',
        marginBottom: '24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div className={styles.skeletonShimmer} />
      </div>

      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ 
            height: '84px', 
            background: 'rgba(255, 255, 255, 0.05)', 
            borderRadius: '12px',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.02)'
        }}>
            <div className={styles.skeletonShimmer} />
        </div>
      ))}
    </div>
  )
}
