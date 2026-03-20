import type { LucideIcon } from 'lucide-react'
import { TvFocusItem, TvFocusZone } from './TvFocusContext'
import styles from './TvPageScaffold.module.css'

export interface TvRailMenuItem {
  id: string
  label: string
  icon: LucideIcon
  active?: boolean
  disabled?: boolean
  ariaLabel?: string
  onActivate: () => void
}

export interface TvRailMenuProps {
  zoneId: string
  items: TvRailMenuItem[]
  nextUp?: string
  nextDown?: string
  nextLeft?: string
  nextRight?: string
}

export function TvRailMenu({
  zoneId,
  items,
  nextUp,
  nextDown,
  nextLeft,
  nextRight,
}: TvRailMenuProps) {
  return (
    <TvFocusZone
      id={zoneId}
      orientation="vertical"
      nextUp={nextUp}
      nextDown={nextDown}
      nextLeft={nextLeft}
      nextRight={nextRight}
    >
      {items.map((item, index) => {
        const Icon = item.icon
        return (
          <TvFocusItem
            key={item.id}
            id={`${zoneId}-${item.id}`}
            index={index}
            className={`${styles.railMenuItem} ${item.active ? styles.railMenuItemActive : ''}`}
            onActivate={item.onActivate}
            aria-current={item.active ? 'page' : undefined}
            aria-label={item.ariaLabel || item.label}
            disabled={item.disabled}
          >
            <span className={styles.railMenuIcon} aria-hidden="true">
              <Icon size={20} />
            </span>
            <span className={styles.railMenuLabel}>{item.label}</span>
          </TvFocusItem>
        )
      })}
    </TvFocusZone>
  )
}
