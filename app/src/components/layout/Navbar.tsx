import { AnimatePresence, motion } from 'framer-motion'
import { Compass, Download, Home, Library, Search, User, X } from 'lucide-react'
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useOfflineDownloadCapability } from '../../hooks/useOfflineDownloadCapability'
import { buildAvatarUrl, sanitizeImgSrc } from '../../lib/url'
import styles from '../../styles/Streaming.module.css'
import { createHoverPreloader } from '../../utils/route-preloader'

interface NavbarProps {
  profileId: number | string
  profile?: any
  /** Optional hint for skeletons/SSR; Navbar computes active state from location */
  activePage?: string
}

interface FloatingRect {
  top: number
  left: number
  width: number
  height: number
}

export const Navbar = ({ profileId, profile }: NavbarProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const [showOverlay, setShowOverlay] = useState(false)
  const [overlayQuery, setOverlayQuery] = useState('')
  const [isAnimatingToSearch, setIsAnimatingToSearch] = useState(false)
  const [sourceRect, setSourceRect] = useState<FloatingRect | null>(null)
  const [targetRect, setTargetRect] = useState<FloatingRect | null>(null)
  const overlayShellRef = useRef<HTMLDivElement>(null)
  const overlayInputRef = useRef<HTMLInputElement>(null)
  const handoffStartedRef = useRef(false)

  const homePreloader = useMemo(() => createHoverPreloader('streaming-home'), [])
  const explorePreloader = useMemo(() => createHoverPreloader('streaming-explore'), [])
  const libraryPreloader = useMemo(() => createHoverPreloader('streaming-library'), [])
  const downloadsPreloader = useMemo(() => createHoverPreloader('streaming-downloads'), [])
  const searchPreloader = useMemo(() => createHoverPreloader('streaming-search'), [])
  const profilesPreloader = useMemo(() => createHoverPreloader('/profiles'), [])
  const searchPath = `/streaming/${profileId}/search`
  const { isAvailable: canUseOfflineDownloads } = useOfflineDownloadCapability(profileId)

  const buildSearchHref = useCallback((query: string, includeOverlayMarker: boolean) => {
    const params = new URLSearchParams()
    if (query.trim()) {
      params.set('q', query)
    }
    if (includeOverlayMarker) {
      params.set('from', 'overlay')
    }

    const search = params.toString()
    return search ? `${searchPath}?${search}` : searchPath
  }, [searchPath])

  const resetOverlay = useCallback(() => {
    handoffStartedRef.current = false
    setShowOverlay(false)
    setOverlayQuery('')
    setIsAnimatingToSearch(false)
    setSourceRect(null)
    setTargetRect(null)
  }, [])

  const completeHandoff = useCallback(() => {
    const destination = buildSearchHref(overlayQuery, false)

    handoffStartedRef.current = false
    setShowOverlay(false)
    setIsAnimatingToSearch(false)
    setSourceRect(null)
    setTargetRect(null)

    startTransition(() => {
      navigate(destination, { replace: true })
    })

    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('search:focus-input'))
    })
  }, [buildSearchHref, navigate, overlayQuery])

  useEffect(() => {
    if (!showOverlay) return

    const frame = requestAnimationFrame(() => {
      const input = overlayInputRef.current
      if (!input) return
      input.focus()
      const len = input.value.length
      input.setSelectionRange(len, len)
    })

    return () => cancelAnimationFrame(frame)
  }, [showOverlay, isAnimatingToSearch, targetRect])

  useEffect(() => {
    if (!showOverlay || isAnimatingToSearch || handoffStartedRef.current) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        resetOverlay()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isAnimatingToSearch, resetOverlay, showOverlay])

  useEffect(() => {
    if (!handoffStartedRef.current || !showOverlay || isAnimatingToSearch) return
    if (!location.pathname.startsWith(searchPath)) return

    let cancelled = false
    let attempts = 0
    let frameId = 0

    const findTarget = () => {
      if (cancelled) return

      const searchInputShell = document.getElementById('streamingSearchInputShell')
      if (searchInputShell) {
        const rect = searchInputShell.getBoundingClientRect()
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        })
        setIsAnimatingToSearch(true)
        return
      }

      attempts += 1
      if (attempts > 90) {
        completeHandoff()
        return
      }

      frameId = requestAnimationFrame(findTarget)
    }

    frameId = requestAnimationFrame(findTarget)

    return () => {
      cancelled = true
      cancelAnimationFrame(frameId)
    }
  }, [completeHandoff, isAnimatingToSearch, location.pathname, searchPath, showOverlay])

  useEffect(() => {
    if (!handoffStartedRef.current || !showOverlay || isAnimatingToSearch) return

    const timer = window.setTimeout(() => {
      const destination = buildSearchHref(overlayQuery, true)
      startTransition(() => {
        navigate(destination, { replace: true })
      })
    }, 140)

    return () => window.clearTimeout(timer)
  }, [buildSearchHref, isAnimatingToSearch, navigate, overlayQuery, showOverlay])

  const handleSearchClick = (e: React.MouseEvent) => {
    e.preventDefault()

    if (location.pathname.startsWith(searchPath)) {
      window.dispatchEvent(new CustomEvent('search:focus-input'))
      return
    }

    setOverlayQuery('')
    setSourceRect(null)
    setTargetRect(null)
    setIsAnimatingToSearch(false)
    handoffStartedRef.current = false
    setShowOverlay(true)
  }

  const startSearchHandoff = (value: string) => {
    if (handoffStartedRef.current) return

    const shell = overlayShellRef.current
    if (!shell) {
      startTransition(() => {
        navigate(buildSearchHref(value, false), { state: { focusSearch: true } })
      })
      resetOverlay()
      return
    }

    const rect = shell.getBoundingClientRect()
    setSourceRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    })

    handoffStartedRef.current = true

    startTransition(() => {
      navigate(buildSearchHref(value, true))
    })
  }

  const handleOverlayInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setOverlayQuery(value)

    if (!handoffStartedRef.current && value.trim()) {
      startSearchHandoff(value)
    }
  }

  const handleOverlaySubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (overlayQuery.trim()) {
      startSearchHandoff(overlayQuery)
      return
    }

    startTransition(() => {
      navigate(searchPath, { state: { focusSearch: true } })
    })
    resetOverlay()
  }

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
    exact?: boolean
    id?: string
    onClick?: (e: React.MouseEvent) => void
    onMouseEnter: () => void
    onFocus: () => void
  }> = [
    { to: `/streaming/${profileId}`, icon: Home, label: 'Home', path: '', exact: true, ...homePreloader },
    { to: `/streaming/${profileId}/explore`, icon: Compass, label: 'Explore', path: '/explore', ...explorePreloader },
    { to: `/streaming/${profileId}/library`, icon: Library, label: 'Library', path: '/library', ...libraryPreloader },
    ...(canUseOfflineDownloads ? [{ to: `/streaming/${profileId}/downloads`, icon: Download, label: 'Downloads', path: '/downloads', ...downloadsPreloader }] : []),
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
          {items.map(({ to, icon: Icon, label, path, exact, id, onMouseEnter, onFocus, onClick }) => (
            <a
              key={to}
              href={to}
              className={`${styles.navLink} ${isActive(path, exact) ? styles.active : ''}`}
              title={label}
              id={id}
              onMouseEnter={onMouseEnter}
              onFocus={onFocus}
              onClick={(e) => {
                if (onClick) {
                  onClick(e)
                  return
                }
                e.preventDefault()
                startTransition(() => {
                  navigate(to)
                })
              }}
            >
              <div className="relative z-10 flex flex-col items-center gap-1">
                <Icon size={24} />
                <span>{label}</span>
              </div>
            </a>
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
                  src={sanitizeImgSrc(buildAvatarUrl(profile.avatar, profile.avatar_style || 'bottts-neutral'))}
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
            onClick={() => {
              if (!handoffStartedRef.current) {
                resetOverlay()
              }
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: isAnimatingToSearch ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <motion.div
              ref={overlayShellRef}
              className={styles.searchContainer}
              onClick={(e) => e.stopPropagation()}
              initial={sourceRect ? false : { scale: 0.96, opacity: 0, y: 18 }}
              animate={isAnimatingToSearch && sourceRect && targetRect
                ? {
                    top: targetRect.top,
                    left: targetRect.left,
                    width: targetRect.width,
                    height: targetRect.height,
                    borderRadius: Math.max(targetRect.height / 2, 24),
                    scale: 1,
                    opacity: 1,
                    y: 0,
                  }
                : {
                    scale: 1,
                    opacity: 1,
                    y: 0,
                  }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={() => {
                if (isAnimatingToSearch) {
                  completeHandoff()
                }
              }}
              style={isAnimatingToSearch && sourceRect
                ? {
                    position: 'fixed',
                    top: sourceRect.top,
                    left: sourceRect.left,
                    width: sourceRect.width,
                    height: sourceRect.height,
                    maxWidth: 'none',
                    zIndex: 2101,
                  }
                : undefined}
            >
              <Search className={styles.searchIcon} />
              <form onSubmit={handleOverlaySubmit}>
                <input
                  ref={overlayInputRef}
                  type="text"
                  name="q"
                  placeholder="Search movies & series..."
                  autoComplete="off"
                  value={overlayQuery}
                  onChange={handleOverlayInputChange}
                />
              </form>
              {!handoffStartedRef.current && (
                <button
                  className={styles.closeSearch}
                  onClick={resetOverlay}
                  aria-label="Close Search"
                  type="button"
                >
                  <X size={20} />
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
