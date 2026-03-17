import { useContext, useId } from 'react'
import type { ReactNode } from 'react'
import { TvFocusItem, TvZoneContext } from './TvFocusContext'
import styles from './TvFocusable.module.css'

interface TvFocusableProps {
  children: ReactNode
  className?: string
  onActivate?: () => void
  ariaLabel?: string
  autoFocus?: boolean
}

export function TvFocusable({ children, className = '', onActivate, ariaLabel, autoFocus = false }: TvFocusableProps) {
  const zoneId = useContext(TvZoneContext)
  const itemId = useId()

  if (zoneId) {
    return (
      <TvFocusItem
        id={`${zoneId}-${itemId}`}
        className={`${styles.focusable} ${className}`.trim()}
        onActivate={onActivate}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
      >
        {children}
      </TvFocusItem>
    )
  }

  return (
    <button
      type="button"
      className={`${styles.focusable} ${className}`.trim()}
      onClick={onActivate}
      onFocus={(event) => {
        event.currentTarget.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        })
      }}
      aria-label={ariaLabel}
      autoFocus={autoFocus}
    >
      {children}
    </button>
  )
}
