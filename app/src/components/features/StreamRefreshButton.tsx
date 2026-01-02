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
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        background: 'transparent',
        border: 'none',
        borderRadius: '4px',
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: '0.75rem',
        cursor: isLoading ? 'wait' : 'pointer',
        opacity: isLoading ? 0.5 : 1,
        transition: 'all 0.15s ease'
      }}
      onMouseEnter={(e) => {
        if (!isLoading) {
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <RefreshCw 
        size={12} 
        style={{ 
          animation: isLoading ? 'spin 1s linear infinite' : 'none' 
        }} 
      />
      {cacheAgeMs !== null && cacheAgeMs !== undefined && cacheAgeMs > 0 && (
        <span>{formatCacheAge(cacheAgeMs)}</span>
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
