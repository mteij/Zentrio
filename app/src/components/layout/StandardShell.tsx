import type { ElementType, ReactNode } from 'react'
import { getPlatformCapabilities, type StandardNavPlacement } from '../../lib/platform-capabilities'
import styles from './StandardShell.module.css'

type HeaderVisibility = 'always' | 'mobile' | 'desktop'

interface StandardShellProps {
  children: ReactNode
  nav?: ReactNode
  navPlacement?: 'auto' | StandardNavPlacement
  header?: ReactNode
  headerVisibility?: HeaderVisibility
  className?: string
  contentClassName?: string
  contentAs?: 'div' | 'main'
}

function mergeClassName(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(' ')
}

export function StandardShell({
  children,
  nav,
  navPlacement = 'none',
  header,
  headerVisibility = 'always',
  className,
  contentClassName,
  contentAs = 'div',
}: StandardShellProps) {
  const platform = getPlatformCapabilities()
  const resolvedNavPlacement: StandardNavPlacement = !nav
    ? 'none'
    : navPlacement === 'auto'
      ? platform.standardNavPlacement
      : navPlacement

  const ContentTag = contentAs as ElementType

  return (
    <div
      className={mergeClassName(
        styles.root,
        resolvedNavPlacement === 'side' ? styles.rootNavSide : null,
        resolvedNavPlacement === 'bottom' ? styles.rootNavBottom : null,
        className,
      )}
    >
      {header ? (
        <div
          className={mergeClassName(
            styles.header,
            headerVisibility === 'always'
              ? styles.headerAlways
              : headerVisibility === 'mobile'
                ? styles.headerMobileOnly
                : styles.headerDesktopOnly,
          )}
        >
          {header}
        </div>
      ) : null}

      {resolvedNavPlacement === 'side' ? (
        <div className={styles.sideNav}>
          <div className={styles.sideNavInner}>{nav}</div>
        </div>
      ) : null}

      <ContentTag className={mergeClassName(styles.content, contentClassName)}>
        {children}
      </ContentTag>

      {resolvedNavPlacement === 'bottom' ? (
        <div className={styles.bottomNav}>
          <div className={styles.bottomNavInner}>{nav}</div>
        </div>
      ) : null}
    </div>
  )
}

export default StandardShell
