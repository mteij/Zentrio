import type { ReactNode } from 'react'
import { Compass, Download, Home, Library, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TvFocusItem, TvFocusZone, TvPageScaffold, type TvPageScaffoldProps } from '../../components/tv'
import { useOfflineDownloadCapability } from '../../hooks/useOfflineDownloadCapability'
import styles from './StreamingTvScaffold.module.css'

export type StreamingTvNavKey = 'home' | 'search' | 'explore' | 'library' | 'downloads'

interface StreamingTvScaffoldProps extends Omit<TvPageScaffoldProps, 'rail' | 'railHeaderAction'> {
  profileId: string
  activeNav?: StreamingTvNavKey
  expandedRail?: boolean
  children: ReactNode
}

export function StreamingTvScaffold({
  profileId,
  activeNav,
  expandedRail = false,
  initialZoneId,
  children,
  ...props
}: StreamingTvScaffoldProps) {
  const navigate = useNavigate()
  const { isAvailable: canUseOfflineDownloads, isLoading: isDownloadCapabilityLoading, isTv } = useOfflineDownloadCapability(profileId)

  const navItems = [
    { id: 'home' as const, label: 'Home', icon: Home, path: `/streaming/${profileId}` },
    { id: 'search' as const, label: 'Search', icon: Search, path: `/streaming/${profileId}/search` },
    { id: 'explore' as const, label: 'Explore', icon: Compass, path: `/streaming/${profileId}/explore` },
    { id: 'library' as const, label: 'Library', icon: Library, path: `/streaming/${profileId}/library` },
    ...(!isTv || isDownloadCapabilityLoading || canUseOfflineDownloads
      ? [{ id: 'downloads' as const, label: 'Downloads', icon: Download, path: `/streaming/${profileId}/downloads` }]
      : []),
  ]

  const firstContentZoneId = initialZoneId || 'streaming-rail'

  return (
    <TvPageScaffold
      {...props}
      initialZoneId={initialZoneId}
      railMode={expandedRail ? 'expanded' : 'compact'}
      brandAction={{
        zoneId: 'streaming-profile-switch',
        itemId: 'streaming-profile-switch-button',
        onActivate: () => navigate('/profiles'),
        nextRight: firstContentZoneId,
        nextDown: 'streaming-rail',
        hint: expandedRail ? 'Switch' : undefined,
      }}
      rail={(
        <TvFocusZone
          id="streaming-rail"
          orientation="vertical"
          nextUp="streaming-profile-switch"
          nextRight={firstContentZoneId}
        >
          {navItems.map((item, index) => {
            const Icon = item.icon
            const isActive = item.id === activeNav
            return (
              <TvFocusItem
                key={item.id}
                id={`streaming-rail-${item.id}`}
                index={index}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                onActivate={() => navigate(item.path)}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={20} />
                {expandedRail ? <span className={styles.navLabel}>{item.label}</span> : null}
              </TvFocusItem>
            )
          })}
        </TvFocusZone>
      )}
    >
      {children}
    </TvPageScaffold>
  )
}

export default StreamingTvScaffold
