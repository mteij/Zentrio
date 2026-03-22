import type { ReactNode } from 'react'
import styles from './StandardTopBar.module.css'

interface StandardTopBarProps {
  title: string
  subtitle?: string
  leftSlot?: ReactNode
  rightSlot?: ReactNode
  className?: string
}

function mergeClassName(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(' ')
}

export function StandardTopBar({ title, subtitle, leftSlot, rightSlot, className }: StandardTopBarProps) {
  return (
    <div className={mergeClassName(styles.bar, className)}>
      {leftSlot ? <div className={styles.leftSlot}>{leftSlot}</div> : null}
      <div className={styles.titleGroup}>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
      {rightSlot ? <div className={styles.rightSlot}>{rightSlot}</div> : null}
    </div>
  )
}

export default StandardTopBar
