import type { ReactNode } from 'react'
import { Compass, Download, Home, Library, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TvPageScaffold, TvRailMenu, type TvPageScaffoldProps } from '../../components/tv'
import { useOfflineDownloadCapability } from '../../hooks/useOfflineDownloadCapability'

export type StreamingTvNavKey = 'home' | 'search' | 'explore' | 'library' | 'downloads'

interface StreamingTvScaffoldProps extends Omit<TvPageScaffoldProps, 'rail' | 'railHeaderAction'> {
  profileId: string
  activeNav?: StreamingTvNavKey
  children: ReactNode
}

export function StreamingTvScaffold({
  profileId,
  activeNav,
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
      railMode="adaptive"
      brandAction={{
        zoneId: 'streaming-profile-switch',
        itemId: 'streaming-profile-switch-button',
        onActivate: () => navigate('/profiles'),
        nextUp: 'streaming-rail',
        nextRight: firstContentZoneId,
      }}
      rail={(
        <TvRailMenu
          zoneId="streaming-rail"
          nextDown="streaming-profile-switch"
          nextRight={firstContentZoneId}
          items={navItems.map((item) => ({
            id: item.id,
            label: item.label,
            icon: item.icon,
            active: item.id === activeNav,
            onActivate: () => navigate(item.path),
          }))}
        />
      )}
    >
      {children}
    </TvPageScaffold>
  )
}

export default StreamingTvScaffold
