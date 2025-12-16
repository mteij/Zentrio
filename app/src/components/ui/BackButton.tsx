import { useNavigate } from 'react-router-dom'
import styles from '../../styles/Settings.module.css'

interface BackButtonProps {
  to?: string
  onClick?: () => void
  label?: string
  className?: string
}

export function BackButton({ to, onClick, label = 'Back', className = '' }: BackButtonProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else if (to) {
      navigate(to)
    } else {
      navigate(-1)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`${styles.backBtn} ${className}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
      </svg>
      {label}
    </button>
  )
}
