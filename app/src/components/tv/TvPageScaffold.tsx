import type { ReactNode } from 'react'
import { UserRound } from 'lucide-react'
import { ZENTRIO_LOGO_192_URL } from '../../lib/brand-assets'
import { TvFocusItem, TvFocusScope, TvFocusZone, type TvFocusScopeProps } from './TvFocusContext'
import { useAuthStore } from '../../stores/authStore'
import { buildAvatarUrl, sanitizeImgSrc } from '../../lib/url'
import styles from './TvPageScaffold.module.css'

function mergeClassName(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(' ')
}

interface StoredSelectedProfile {
  id?: string | number
  name?: string
  avatar?: string
  avatar_style?: string
}

function readSelectedProfile(): StoredSelectedProfile | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem('selectedProfile')
    if (!raw) return null
    return JSON.parse(raw) as StoredSelectedProfile
  } catch {
    return null
  }
}

export interface TvPageScaffoldProps extends Pick<TvFocusScopeProps, 'initialZoneId' | 'onBack'> {
  title: string
  eyebrow?: string
  description?: string
  rail?: ReactNode
  railHeaderAction?: ReactNode
  brandAction?: {
    zoneId: string
    itemId: string
    onActivate: () => void
    nextRight?: string
    nextDown?: string
    hint?: string
  }
  headerAside?: ReactNode
  children: ReactNode
  className?: string
  hideHeader?: boolean
  railMode?: 'expanded' | 'compact'
}

export function TvPageScaffold({
  title,
  eyebrow,
  description,
  rail,
  railHeaderAction,
  brandAction,
  headerAside,
  children,
  className,
  initialZoneId,
  onBack,
  hideHeader = false,
  railMode = 'compact',
}: TvPageScaffoldProps) {
  const user = useAuthStore((state) => state.user)
  const selectedProfile = readSelectedProfile()
  const profileAvatar = selectedProfile?.avatar
    ? sanitizeImgSrc(buildAvatarUrl(selectedProfile.avatar, selectedProfile.avatar_style || 'bottts-neutral'))
    : ''
  const identityTitle = selectedProfile?.name || user?.name || user?.username || user?.email || 'Zentrio'

  return (
    <TvFocusScope
      initialZoneId={initialZoneId}
      onBack={onBack}
      className={mergeClassName(
        styles.root,
        railMode === 'compact' ? styles.compactRail : styles.expandedRail,
        railMode === 'compact' ? 'tvRailCompact' : 'tvRailExpanded',
        className,
      )}
    >
      <aside className={styles.rail}>
        {brandAction ? (
          <TvFocusZone
            id={brandAction.zoneId}
            orientation="vertical"
            nextRight={brandAction.nextRight}
            nextDown={brandAction.nextDown}
          >
            <TvFocusItem
              id={brandAction.itemId}
              className={styles.brandButton}
              onActivate={brandAction.onActivate}
              aria-label={brandAction.hint ? `${identityTitle}, ${brandAction.hint}` : identityTitle}
            >
              {profileAvatar ? (
                <img src={profileAvatar} alt={identityTitle} className={styles.brandImage} />
              ) : user || selectedProfile ? (
                <div className={styles.identityIcon} aria-hidden="true">
                  <UserRound size={24} />
                </div>
              ) : (
                <img src={ZENTRIO_LOGO_192_URL} alt="Zentrio" className={styles.brandImage} />
              )}
              <div className={styles.brandText}>
                <div className={styles.brandTitle}>{identityTitle}</div>
              </div>
              {brandAction.hint ? <span className={styles.brandHint}>{brandAction.hint}</span> : null}
            </TvFocusItem>
          </TvFocusZone>
        ) : (
          <div className={styles.brand}>
            {profileAvatar ? (
              <img src={profileAvatar} alt={identityTitle} className={styles.brandImage} />
            ) : user || selectedProfile ? (
              <div className={styles.identityIcon} aria-hidden="true">
                <UserRound size={24} />
              </div>
            ) : (
              <img src={ZENTRIO_LOGO_192_URL} alt="Zentrio" className={styles.brandImage} />
            )}
            <div className={styles.brandText}>
              <div className={styles.brandTitle}>{identityTitle}</div>
            </div>
          </div>
        )}
        {railHeaderAction ? <div className={styles.railHeaderAction}>{railHeaderAction}</div> : null}
        {rail ? <div className={styles.railContent}>{rail}</div> : null}
      </aside>

      <main className={styles.main}>
        {!hideHeader ? (
          <header className={styles.header}>
            <div className={styles.headerCopy}>
              {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
              <h1 className={styles.title}>{title}</h1>
              {description ? <p className={styles.description}>{description}</p> : null}
            </div>
            {headerAside ? <div className={styles.headerAside}>{headerAside}</div> : null}
          </header>
        ) : null}

        <div className={styles.content}>{children}</div>
      </main>
    </TvFocusScope>
  )
}

export interface TvSectionProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export function TvSection({ title, subtitle, children }: TvSectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          {subtitle ? <p className={styles.sectionSubtitle}>{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

export interface TvShelfProps {
  zoneId: string
  initialItemId?: string
  nextUp?: string
  nextDown?: string
  nextLeft?: string
  nextRight?: string
  children: ReactNode
}

export function TvShelf({
  zoneId,
  initialItemId,
  nextUp,
  nextDown,
  nextLeft,
  nextRight,
  children,
}: TvShelfProps) {
  return (
    <TvFocusZone
      id={zoneId}
      orientation="horizontal"
      initialItemId={initialItemId}
      nextUp={nextUp}
      nextDown={nextDown}
      nextLeft={nextLeft}
      nextRight={nextRight}
    >
      <div className={styles.shelf}>{children}</div>
    </TvFocusZone>
  )
}

export interface TvGridProps {
  zoneId: string
  columns?: number
  initialItemId?: string
  nextUp?: string
  nextDown?: string
  nextLeft?: string
  nextRight?: string
  children: ReactNode
}

export function TvGrid({
  zoneId,
  columns = 4,
  initialItemId,
  nextUp,
  nextDown,
  nextLeft,
  nextRight,
  children,
}: TvGridProps) {
  return (
    <TvFocusZone
      id={zoneId}
      orientation="grid"
      columns={columns}
      initialItemId={initialItemId}
      nextUp={nextUp}
      nextDown={nextDown}
      nextLeft={nextLeft}
      nextRight={nextRight}
    >
      <div className={styles.grid} style={{ ['--tv-grid-columns' as string]: String(columns) }}>
        {children}
      </div>
    </TvFocusZone>
  )
}

export interface TvActionStripProps {
  zoneId: string
  children: ReactNode
  nextUp?: string
  nextDown?: string
  nextLeft?: string
  nextRight?: string
}

export function TvActionStrip({ zoneId, children, nextUp, nextDown, nextLeft, nextRight }: TvActionStripProps) {
  return (
    <TvFocusZone
      id={zoneId}
      orientation="horizontal"
      nextUp={nextUp}
      nextDown={nextDown}
      nextLeft={nextLeft}
      nextRight={nextRight}
    >
      <div className={styles.actionStrip}>{children}</div>
    </TvFocusZone>
  )
}

export interface TvDialogProps {
  title: string
  open: boolean
  onBack?: () => void
  initialZoneId?: string
  children: ReactNode
}

export function TvDialog({ title, open, onBack, initialZoneId, children }: TvDialogProps) {
  if (!open) return null

  return (
    <div className={styles.dialogBackdrop}>
      <TvFocusScope initialZoneId={initialZoneId} onBack={onBack}>
        <div className={styles.dialogSurface} role="dialog" aria-modal="true" aria-label={title}>
          <h2 className={styles.dialogTitle}>{title}</h2>
          <div className={styles.dialogBody}>{children}</div>
        </div>
      </TvFocusScope>
    </div>
  )
}
