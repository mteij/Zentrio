import { Home, Compass, Library, Search, User, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { createHoverPreloader } from '../../utils/route-preloader'
import styles from '../../styles/Streaming.module.css'

interface NavbarProps {
  profileId: number
  activePage?: 'home' | 'series' | 'movie' | 'library' | 'search' | 'explore'
  profile?: any
}

export const Navbar = ({ profileId, activePage, profile }: NavbarProps) => {
  // Create hover preloaders for each route
  const homePreloader = createHoverPreloader('streaming-home')
  const explorePreloader = createHoverPreloader('streaming-explore')
  const libraryPreloader = createHoverPreloader('streaming-library')
  const searchPreloader = createHoverPreloader('streaming-search')
  const profilesPreloader = createHoverPreloader('/profiles')

  return (
    <>
      <nav className={styles.streamingNavbar} id="streamingNavbar">
        <div className={styles.navLeft}>
          <a 
            href={`/streaming/${profileId}`} 
            className={`${styles.navLink} ${activePage === 'home' ? styles.active : ''}`} 
            title="Home"
            {...homePreloader}
          >
            <Home size={24} />
            <span>Home</span>
          </a>
          <a 
            href={`/streaming/${profileId}/explore`} 
            className={`${styles.navLink} ${activePage === 'explore' ? styles.active : ''}`} 
            title="Explore"
            {...explorePreloader}
          >
            <Compass size={24} />
            <span>Explore</span>
          </a>
          <a 
            href={`/streaming/${profileId}/library`} 
            className={`${styles.navLink} ${activePage === 'library' ? styles.active : ''}`} 
            title="My List"
            {...libraryPreloader}
          >
            <Library size={24} />
            <span>My List</span>
          </a>
          <a 
            href={`/streaming/${profileId}/search`} 
            className={`${styles.navLink} ${activePage === 'search' ? styles.active : ''}`} 
            title="Search" 
            id="navSearchBtn"
            {...searchPreloader}
          >
            <Search size={24} />
            <span>Search</span>
          </a>
        </div>

        <div className={styles.navRight}>
          <a 
            href="/profiles" 
            className={styles.navProfile} 
            aria-label="Switch Profile" 
            title="Switch Profile"
            {...profilesPreloader}
          >
            <div className={styles.navAvatar} key={profile?.avatar ? 'avatar-img' : 'avatar-icon'}>
              {profile?.avatar ? (
                <img 
                  src={profile.avatar.startsWith('http') || profile.avatar.startsWith('data:') 
                    ? profile.avatar 
                    : `/api/avatar/${encodeURIComponent(profile.avatar)}?style=${encodeURIComponent(profile.avatar_style || 'bottts-neutral')}`} 
                  alt={profile.name} 
                />
              ) : (
                <User size={20} />
              )}
            </div>
          </a>
        </div>
      </nav>

      {/* Search Overlay */}
      <div className={styles.searchOverlay} id="searchOverlay">
        <div className={styles.searchContainer}>
          <Search className={styles.searchIcon} />
          <form action={`/streaming/${profileId}/search`} method="get" id="overlaySearchForm" style={{ width: '100%' }}>
            <input
              type="text"
              name="q"
              id="overlaySearchInput"
              placeholder="Search movies & series..."
              autoComplete="off"
            />
          </form>
          <button className={styles.closeSearch} id="closeSearchBtn" aria-label="Close Search">
            <X size={32} />
          </button>
        </div>
      </div>
    </>
  )
}
