import { Outlet, useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LoadErrorState } from '../../components'
import { Navbar } from '../../components/layout/Navbar'
import { StandardShell } from '../../components/layout/StandardShell'
import { OfflineBanner } from '../../components/downloads/OfflineBanner'
import { useOfflineMode } from '../../hooks/useOfflineMode'
import { useDownloads } from '../../hooks/useDownloads'
import { useEffect } from 'react'
import { apiFetch, apiFetchJson } from '../../lib/apiFetch'
import { getPlatformCapabilities } from '../../lib/platform-capabilities'
import { buildAvatarUrl, sanitizeImgSrc } from '../../lib/url'
import { shouldPreload } from '../../utils/route-preloader'
import { useAuthStore } from '../../stores/authStore'
import { createLogger } from '../../utils/client-logger'
import { Search, User } from 'lucide-react'
import styles from '../../styles/Streaming.module.css'

const log = createLogger('StreamingLayout')

const fetchProfile = async (profileId: string) => {
  // Use lightweight profile endpoint instead of heavy dashboard
  if (profileId === 'guest') {
    // For guest, we might need a specific handling or just use the list
    // But let's assume /api/profiles/guest works or we handle it via ID if guest has IDs
    // The previous code passed "guest" string, but profileId param is string.
    // If it's literally "guest", we might need to fetch the guest profile differently or it might return the first guest profile?
    // Actually, in the code `profileId === 'guest' ? 'guest' : parseInt(profileId!)`.
    // If profileId is a number string, we fetch that.
    return { name: 'Guest', avatar: 'guest', id: 'guest' }
  }

  const res = await apiFetch(`/api/profiles/${profileId}`)
  if (!res.ok) {
     if (res.status === 401) throw new Error('Unauthorized')
     throw new Error('Failed to load profile')
  }
  const profile = await res.json()
  return profile
}

export const StreamingLayout = () => {
  const { profileId } = useParams<{ profileId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const platform = getPlatformCapabilities()

  // Initialize download store + event listeners for this profile
  useDownloads(profileId)
  const { isOnline } = useOfflineMode(profileId)

  const { data: profile, error, isFetching, refetch } = useQuery({
    queryKey: ['streaming-profile', profileId],
    queryFn: () => fetchProfile(profileId!),
    enabled: !!profileId,
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: (failureCount, error) => {
      if (error.message === 'Unauthorized') return false
      return failureCount < 2
    }
  })

  useEffect(() => {
    if (error?.message === 'Unauthorized') {
      log.debug('401 Unauthorized received, logging out locally...');
      useAuthStore.getState().logout();
      navigate('/')
    }
  }, [error, navigate])

  // React immediately when streaming settings changed (e.g. parental age limit)
  useEffect(() => {
    const invalidateStreamingQueries = () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const [scope] = query.queryKey as [string, ...unknown[]]
          return ['dashboard', 'filters', 'catalog-items', 'catalog', 'explore-genre'].includes(String(scope))
        }
      })
    }

    const handleSettingsUpdated = () => {
      invalidateStreamingQueries()
    }

    window.addEventListener('streaming-settings-updated', handleSettingsUpdated)

    // Catch updates made while user was on Settings page (outside streaming layout)
    if (sessionStorage.getItem('streaming-settings-dirty') === '1') {
      sessionStorage.removeItem('streaming-settings-dirty')
      invalidateStreamingQueries()
    }

    return () => {
      window.removeEventListener('streaming-settings-updated', handleSettingsUpdated)
    }
  }, [queryClient])

  // Defer data prefetching to reduce mount-time network/CPU bursts (stutter prevention)
  useEffect(() => {
    if (!profileId) return

    const canAggressivePrefetch = shouldPreload()
    if (!canAggressivePrefetch) {
      return
    }

    const isExplore = location.pathname.startsWith(`/streaming/${profileId}/explore`)
    const isHome =
      location.pathname === `/streaming/${profileId}` ||
      location.pathname === `/streaming/${profileId}/`

    const timer = setTimeout(() => {
      // If we're on Home, avoid immediate duplicate dashboard pressure.
      if (!isHome) {
        queryClient.prefetchQuery({
          queryKey: ['dashboard', profileId],
          queryFn: () => apiFetchJson(`/api/streaming/dashboard?profileId=${profileId}`),
          staleTime: 1000 * 60 * 5
        })
      }

      // If we're on Explore, avoid immediate duplicate filters pressure.
      if (!isExplore) {
        queryClient.prefetchQuery({
          queryKey: ['filters', profileId],
          queryFn: () => apiFetchJson(`/api/streaming/filters?profileId=${profileId}`),
          staleTime: 1000 * 60 * 10
        })
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [profileId, queryClient, location.pathname])

  useEffect(() => {
    if (platform.canUseRemoteNavigation) return

    const findVerticalScrollTarget = (element: HTMLElement | null): HTMLElement | null => {
      let current = element

      // Stop before body/html — both get computed overflow-y:auto from overflow-x:hidden
      // which makes them appear scrollable, but body.scrollTop is a no-op in standards mode.
      // The fallback (document.scrollingElement) correctly handles page-level scrolling.
      while (current && current !== document.body && current !== document.documentElement) {
        const style = window.getComputedStyle(current)
        const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY) && current.scrollHeight > current.clientHeight
        if (canScrollY) return current
        current = current.parentElement
      }

      return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : document.documentElement
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.defaultPrevented) return
      if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return

      const target = event.target as HTMLElement | null
      if (!target) return

      if (target.closest('[data-row-scroll-container="true"]')) return
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return

      const scrollTarget = findVerticalScrollTarget(target)
      if (!scrollTarget || scrollTarget.scrollHeight <= scrollTarget.clientHeight) return

      event.preventDefault()
      scrollTarget.scrollTop += event.deltaY
    }

    document.addEventListener('wheel', handleWheel, { passive: false, capture: true })
    return () => {
      document.removeEventListener('wheel', handleWheel, true)
    }
  }, [platform.canUseRemoteNavigation])

  if (error?.message === 'Unauthorized') {
    return null
  }

  if (error) {
    const errorMessage = error.message && error.message !== 'Failed to load profile'
      ? error.message
      : 'Failed to load, try again.'

    return (
      <LoadErrorState
        message={errorMessage}
        onRetry={() => {
          void refetch()
        }}
        isRetrying={isFetching}
        onBack={() => {
          if (window.history.length > 1) {
            navigate(-1)
            return
          }
          navigate('/profiles')
        }}
      />
    )
  }

  // Determine if we are on a page where the navbar should be hidden
  // Player page: ends with /player
  // Details page: /streaming/:profileId/:type/:id (where :type is not one of the reserved keywords)
  const isPlayer = location.pathname.endsWith('/player')
  
  // Get the path segments after /streaming/:profileId
  const pathParts = location.pathname.split(`/streaming/${profileId}`)[1]?.split('/').filter(Boolean) || []
  const firstSegment = pathParts[0]
  
  // Reserved main routes that SHOULD show navbar
  const mainRoutes = ['explore', 'library', 'search', 'downloads']
  const isCatalog = firstSegment === 'catalog'
  const searchParams = new URLSearchParams(location.search)
  const isExploreSeeAll = firstSegment === 'explore' && (searchParams.has('genre') || searchParams.has('type'))
  // If we have a first segment matching a type (e.g. 'movie', 'series') and it's not a reserved route,
  // then it's a details page.
  // Note: Home page has empty pathParts or firstSegment undefined
  const isDetails = firstSegment && !mainRoutes.includes(firstSegment) && !isPlayer

  const shouldHideNavbar = platform.canUseRemoteNavigation || isPlayer || isDetails || isCatalog || isExploreSeeAll
  const showMobileHeader = !shouldHideNavbar
    && platform.standardNavPlacement === 'bottom'
    && firstSegment !== 'search'
    && firstSegment !== 'library'
    && firstSegment !== 'explore'
    && firstSegment !== 'downloads'
  const searchPath = `/streaming/${profileId}/search`
  const mobileHeader = showMobileHeader ? (
    <div className={styles.streamingMobileHeader}>
      <button
        type="button"
        className={styles.streamingMobileSearch}
        aria-label="Search movies and series"
        onClick={() => {
          navigate(searchPath, { state: { focusSearch: true } })
        }}
      >
        <Search size={18} aria-hidden="true" />
        <span>Search movies & series</span>
      </button>

      <Link
        to="/profiles"
        className={styles.streamingMobileProfileButton}
        aria-label={profile?.name ? `Switch profile. Current profile: ${profile.name}` : 'Switch profile'}
        title="Switch Profile"
        >
          <div className={styles.streamingMobileProfileAvatar}>
            {profile?.avatar ? (
            <img
              src={sanitizeImgSrc(buildAvatarUrl(profile.avatar, profile.avatar_style || 'bottts-neutral'))}
              alt=""
            />
            ) : (
              <User size={18} aria-hidden="true" />
            )}
          </div>
      </Link>
    </div>
  ) : undefined

  return (
    <StandardShell
      navPlacement="auto"
      header={mobileHeader}
      headerVisibility="mobile"
      nav={!shouldHideNavbar ? <Navbar profileId={profileId === 'guest' ? 'guest' : parseInt(profileId!)} profile={profile} /> : undefined}
    >
      {/* CSS var tells OfflineBanner how far below the sticky top bar it should stick on mobile */}
      <div style={{ '--mobile-bar-height': showMobileHeader ? '68px' : '48px' } as object}>
        <OfflineBanner visible={!isOnline && !shouldHideNavbar} />
      </div>
      <Outlet />
    </StandardShell>
  )
}
