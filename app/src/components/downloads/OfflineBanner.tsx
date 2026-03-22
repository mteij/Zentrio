import { ArrowRight, WifiOff } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import styles from './OfflineBanner.module.css'

interface Props {
  visible: boolean
}

export function OfflineBanner({ visible }: Props) {
  const navigate = useNavigate()
  const { profileId } = useParams<{ profileId: string }>()

  if (!visible) return null

  return (
    <div className={styles.banner} role="alert">
      <span className={styles.bannerIcon}>
        <WifiOff size={16} aria-hidden="true" />
      </span>
      <div className={styles.bannerText}>
        <span className={styles.bannerTitle}>You&apos;re offline</span>
        <span className={styles.bannerSub}>Streaming unavailable</span>
      </div>
      <button
        className={styles.bannerBtn}
        onClick={() => navigate(`/streaming/${profileId}/downloads`)}
      >
        Downloads
        <ArrowRight size={13} aria-hidden="true" />
      </button>
    </div>
  )
}
