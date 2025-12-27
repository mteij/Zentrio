import { RefreshCw } from 'lucide-react'
import styles from '../../styles/Streaming.module.css'

interface StreamRefreshButtonProps {
  onRefresh: () => void
  isLoading: boolean
  cacheAgeMs?: number | null
  className?: string
}

/**
 * Refresh button for stream lists with cache age display
 */
export function StreamRefreshButton({ 
  onRefresh, 
  isLoading, 
  cacheAgeMs, 
  className = '' 
}: StreamRefreshButtonProps) {
  // Format cache age for display
  const formatCacheAge = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ago`
  }

  return (
    <button
      className={`${styles.refreshBtn} ${className}`}
      onClick={onRefresh}
      disabled={isLoading}
      title={cacheAgeMs ? `Cached ${formatCacheAge(cacheAgeMs)} - Click to refresh` : 'Refresh streams'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        background: 'rgba(255, 255, 255, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '6px',
        color: '#fff',
        fontSize: '0.85rem',
        cursor: isLoading ? 'wait' : 'pointer',
        opacity: isLoading ? 0.6 : 1,
        transition: 'all 0.2s ease'
      }}
    >
      <RefreshCw 
        size={14} 
        style={{ 
          animation: isLoading ? 'spin 1s linear infinite' : 'none' 
        }} 
      />
      {cacheAgeMs !== null && cacheAgeMs !== undefined && cacheAgeMs > 0 ? (
        <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
          {formatCacheAge(cacheAgeMs)}
        </span>
      ) : (
        <span>Refresh</span>
      )}
    </button>
  )
}

// Add spin animation via inline style (or use existing CSS)
const spinKeyframes = `
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`

// Inject keyframes if not present
if (typeof document !== 'undefined' && !document.getElementById('spin-keyframes')) {
  const style = document.createElement('style')
  style.id = 'spin-keyframes'
  style.textContent = spinKeyframes
  document.head.appendChild(style)
}
