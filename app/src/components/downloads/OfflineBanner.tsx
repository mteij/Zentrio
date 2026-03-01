import { WifiOff } from 'lucide-react'
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
      <WifiOff size={14} />
      <span>You&apos;re offline</span>
      <button
        className={styles.bannerLink}
        onClick={() => navigate(`/streaming/${profileId}/downloads`)}
      >
        Go to Downloads →
      </button>
    </div>
  )
}
