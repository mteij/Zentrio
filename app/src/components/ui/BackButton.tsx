import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import styles from '../../styles/Settings.module.css'

interface BackButtonProps {
  to?: string
  onClick?: () => void
  label?: string
  className?: string
  /** 
   * 'floating' = fixed position (default for settings)
   * 'static' = inline/block flow (for custom layout)
   */
  variant?: 'floating' | 'static'
}

export function BackButton({ to, onClick, label = 'Back', className = '', variant = 'floating' }: BackButtonProps) {
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
      className={`${variant === 'floating' ? styles.backBtn : styles.backBtnStatic} ${className}`}
    >
      <ChevronLeft size={18} />
      {label}
    </button>
  )
}
