import styles from '../../styles/Player.module.css'

/**
 * A minimal skeleton for the player page - shows a dark screen with buffering indicator
 * since a video player skeleton makes the most sense as a dark canvas
 */
export function SkeletonPlayer() {
  return (
    <div className={styles.playerWrapper} style={{ background: '#000' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid rgba(255, 255, 255, 0.1)',
          borderTopColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
