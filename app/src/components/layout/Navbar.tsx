import { Compass, Download, Home, Library, Search, User } from 'lucide-react'
import { startTransition, useMemo } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useOfflineDownloadCapability } from '../../hooks/useOfflineDownloadCapability'
import { getPlatformCapabilities } from '../../lib/platform-capabilities'
import { buildAvatarUrl, sanitizeImgSrc } from '../../lib/url'
import styles from '../../styles/Streaming.module.css'
import { createHoverPreloader } from '../../utils/route-preloader'

interface NavbarProps {
  profileId: number | string
  profile?: any
  /** Optional hint for skeletons/SSR; Navbar computes active state from location */
  activePage?: 'home' | 'explore' | 'library' | 'downloads' | 'search'
}

export const Navbar = ({ profileId, profile, activePage }: NavbarProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const platform = getPlatformCapabilities()

  const homePreloader = useMemo(() => createHoverPreloader('streaming-home'), [])
  const explorePreloader = useMemo(() => createHoverPreloader('streaming-explore'), [])
  const libraryPreloader = useMemo(() => createHoverPreloader('streaming-library'), [])
  const downloadsPreloader = useMemo(() => createHoverPreloader('streaming-downloads'), [])
  const searchPreloader = useMemo(() => createHoverPreloader('streaming-search'), [])
  const profilesPreloader = useMemo(() => createHoverPreloader('/profiles'), [])
  const searchPath = `/streaming/${profileId}/search`
  const { isAvailable: canUseOfflineDownloads } = useOfflineDownloadCapability(profileId)

  const isActive = (path: string, exact = false) => {
    const fullPath = `/streaming/${profileId}${path}`
    if (exact) {
      return location.pathname === fullPath
    }
    return location.pathname.startsWith(fullPath)
  }

  const items: Array<{
    to: string
    icon: typeof Home
    label: string
    path: string
    key: 'home' | 'explore' | 'library' | 'downloads' | 'search'
    exact?: boolean
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void
    onMouseEnter: () => void
    onFocus: () => void
  }> = [
    { to: `/streaming/${profileId}`, icon: Home, label: 'Home', path: '', key: 'home', exact: true, ...homePreloader },
    { to: `/streaming/${profileId}/explore`, icon: Compass, label: 'Explore', path: '/explore', key: 'explore', ...explorePreloader },
    { to: `/streaming/${profileId}/library`, icon: Library, label: 'Library', path: '/library', key: 'library', ...libraryPreloader },
    ...(canUseOfflineDownloads ? [{ to: `/streaming/${profileId}/downloads`, icon: Download, label: 'Downloads', path: '/downloads', key: 'downloads' as const, ...downloadsPreloader }] : []),
    {
      to: searchPath,
      icon: Search,
      label: 'Search',
      path: '/search',
      key: 'search',
      onClick: (event) => {
        event.preventDefault()

        if (location.pathname.startsWith(searchPath)) {
          window.dispatchEvent(new CustomEvent('search:focus-input'))
          return
        }

        startTransition(() => {
          navigate(searchPath, { state: { focusSearch: true } })
        })
      },
      ...searchPreloader,
    },
  ]

  const isBottomNav = platform.standardNavPlacement === 'bottom'
  const navItems = isBottomNav ? items.filter((item) => item.key !== 'search') : items
  const profileDisplayName = profile?.name?.trim() || 'Guest'

  return (
    <nav
      className={`${styles.streamingNavbar} ${isBottomNav ? styles.streamingNavbarBottom : styles.streamingNavbarSide}`}
      id="streamingNavbar"
      aria-label="Streaming navigation"
    >
      <div className={styles.navLeft}>
        {navItems.map(({ to, icon: Icon, label, path, exact, key, onMouseEnter, onFocus, onClick }) => {
          const itemIsActive = activePage ? activePage === key : isActive(path, exact)

          return (
            <a
              key={to}
              href={to}
              className={`${styles.navLink} ${itemIsActive ? styles.active : ''}`}
              title={label}
              aria-label={label}
              aria-current={itemIsActive ? 'page' : undefined}
              onMouseEnter={onMouseEnter}
              onFocus={onFocus}
              onClick={(event) => {
                if (onClick) {
                  onClick(event)
                  return
                }

                event.preventDefault()
                startTransition(() => {
                  navigate(to)
                })
              }}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
            </a>
          )
        })}
      </div>

      {!isBottomNav ? (
        <div className={styles.navRight}>
          <Link
            to="/profiles"
            className={styles.navProfile}
            aria-label={profile?.name ? `Switch profile. Current profile: ${profile.name}` : 'Switch profile'}
            title="Switch Profile"
            {...profilesPreloader}
          >
            <div className={styles.navAvatar} key={profile?.avatar ? 'avatar-img' : 'avatar-icon'}>
              {profile?.avatar ? (
                <img
                  src={sanitizeImgSrc(buildAvatarUrl(profile.avatar, profile.avatar_style || 'bottts-neutral'))}
                  alt=""
                />
              ) : (
                <User size={18} aria-hidden="true" />
              )}
            </div>
            <span>{profileDisplayName}</span>
          </Link>
        </div>
      ) : null}
    </nav>
  )
}

export default Navbar
