import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, Compass, Library, Search, User, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createHoverPreloader } from '../../utils/route-preloader'
import styles from '../../styles/Streaming.module.css'
import { useState, useRef, useEffect } from 'react'

interface NavbarProps {
  profileId: number | string
  profile?: any
  /** Optional hint for skeletons/SSR; Navbar computes active state from location */
  activePage?: string
}

export const Navbar = ({ profileId, profile }: NavbarProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const [showOverlay, setShowOverlay] = useState(false)
  const [isAnimatingOut, setIsAnimatingOut] = useState(false)
  const overlayInputRef = useRef<HTMLInputElement>(null)
  
  // Create hover preloaders for each route
  const homePreloader = createHoverPreloader('streaming-home')
  const explorePreloader = createHoverPreloader('streaming-explore')
  const libraryPreloader = createHoverPreloader('streaming-library')
  const searchPreloader = createHoverPreloader('streaming-search')
  const profilesPreloader = createHoverPreloader('/profiles')

  useEffect(() => {
    if (showOverlay && overlayInputRef.current) {
        setTimeout(() => overlayInputRef.current?.focus(), 50)
    }
  }, [showOverlay])

  const handleSearchClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowOverlay(true)
  }

  // Navigate to search page immediately when user types
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value.trim()) {
      setIsAnimatingOut(true)
      // Navigate immediately - search page will handle focus
      navigate(`/streaming/${profileId}/search?q=${encodeURIComponent(value)}&from=overlay`)
      // Clean up overlay after a brief moment
      setTimeout(() => {
        setShowOverlay(false)
        setIsAnimatingOut(false)
      }, 100)
    }
  }

  const handleOverlaySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    const q = formData.get('q') as string
    if (q.trim()) {
        setShowOverlay(false)
        navigate(`/streaming/${profileId}/search?q=${encodeURIComponent(q)}`)
    }
  }

  const isActive = (path: string, exact = false) => {
    const fullPath = `/streaming/${profileId}${path}`
    if (exact) {
      return location.pathname === fullPath
    }
    return location.pathname.startsWith(fullPath)
  }

  const items: Array<{
    to: string;
    icon: typeof Home;
    label: string;
    path: string;
    exact?: boolean;
    id?: string;
    onClick?: (e: React.MouseEvent) => void;
    onMouseEnter: () => void;
    onFocus: () => void;
  }> = [
      { to: `/streaming/${profileId}`, icon: Home, label: 'Home', path: '', exact: true, ...homePreloader },
      { to: `/streaming/${profileId}/explore`, icon: Compass, label: 'Explore', path: '/explore', ...explorePreloader },
      { to: `/streaming/${profileId}/library`, icon: Library, label: 'Library', path: '/library', ...libraryPreloader },
      { to: `/streaming/${profileId}/search`, icon: Search, label: 'Search', path: '/search', id: 'navSearchBtn', onClick: handleSearchClick, ...searchPreloader }
  ]

  const activeIndex = items.findIndex((item) => isActive(item.path, item.exact))
  const safeActiveIndex = activeIndex === -1 ? 0 : activeIndex

  return (
    <>
      <nav className={styles.streamingNavbar} id="streamingNavbar">
        <div 
            className={styles.navLeft}
            style={{ '--active-index': safeActiveIndex } as React.CSSProperties}
        >
            <div className={styles.activeIndicator} />
            {items.map(({ to, icon: Icon, label, path, exact, id, onMouseEnter, onFocus, onClick, ...linkProps }) => (
                <Link 
                    key={to}
                    to={to} 
                    className={`${styles.navLink} ${isActive(path, exact) ? styles.active : ''}`}
                    title={label}
                    id={id}
                    onMouseEnter={onMouseEnter}
                    onFocus={onFocus}
                    onClick={onClick}
                >
                    <div className="relative z-10 flex flex-col items-center gap-1">
                        <Icon size={24} />
                        <span>{label}</span>
                    </div>
                </Link>
            ))}
        </div>

        <div className={styles.navRight}>
          <Link 
            to="/profiles" 
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
          </Link>
        </div>
      </nav>

      <AnimatePresence>
        {showOverlay && (
          <motion.div 
            className={styles.searchOverlay} 
            id="searchOverlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: isAnimatingOut ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div 
                className={styles.searchContainer}
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ 
                  scale: 1, 
                  opacity: isAnimatingOut ? 0 : 1,
                  y: isAnimatingOut ? -200 : 0
                }}
                exit={{ opacity: 0, y: -100 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            >
              <Search className={styles.searchIcon} />
              <form onSubmit={handleOverlaySubmit}>
                <input
                  ref={overlayInputRef}
                  type="text"
                  name="q"
                  placeholder="Search movies & series..."
                  autoComplete="off"
                  onChange={handleInputChange}
                />
              </form>
              <button 
                className={styles.closeSearch} 
                onClick={() => setShowOverlay(false)}
                aria-label="Close Search"
              >
                <X size={20} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
