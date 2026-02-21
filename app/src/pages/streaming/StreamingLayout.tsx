import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navbar } from '../../components/layout/Navbar'
import { useEffect } from 'react'
import { apiFetch, apiFetchJson } from '../../lib/apiFetch'
import { preloadCommonRoutes, shouldPreload } from '../../utils/route-preloader'

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

  const { data: profile, error } = useQuery({
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

  // Preload all streaming route chunks AND prefetch data on mount for instant navigation
  useEffect(() => {
    if (!profileId) return
    
    // Preload route chunks (code splitting)
    const cleanupPreload = preloadCommonRoutes()

    const canAggressivePrefetch = shouldPreload()
    if (!canAggressivePrefetch) {
      return cleanupPreload
    }
    
    // Prefetch dashboard data (used by both Home and Explore)
    queryClient.prefetchQuery({
      queryKey: ['dashboard', profileId],
      queryFn: () => apiFetchJson(`/api/streaming/dashboard?profileId=${profileId}`),
      staleTime: 1000 * 60 * 5 // 5 minutes
    })
    
    // Prefetch filters data (used by Explore)
    queryClient.prefetchQuery({
      queryKey: ['filters', profileId],
      queryFn: () => apiFetchJson(`/api/streaming/filters?profileId=${profileId}`),
      staleTime: 1000 * 60 * 10 // 10 minutes
    })

    return cleanupPreload
  }, [profileId, queryClient])

  // Determine if we are on a page where the navbar should be hidden
  // Player page: ends with /player
  // Details page: /streaming/:profileId/:type/:id (where :type is not one of the reserved keywords)
  const isPlayer = location.pathname.endsWith('/player')
  
  // Get the path segments after /streaming/:profileId
  const pathParts = location.pathname.split(`/streaming/${profileId}`)[1]?.split('/').filter(Boolean) || []
  const firstSegment = pathParts[0]
  
  // Reserved main routes that SHOULD show navbar
  const mainRoutes = ['explore', 'library', 'search']
  const isCatalog = firstSegment === 'catalog'
  const searchParams = new URLSearchParams(location.search)
  const isExploreSeeAll = firstSegment === 'explore' && (searchParams.has('genre') || searchParams.has('type'))
  
  // If we have a first segment matching a type (e.g. 'movie', 'series') and it's not a reserved route,
  // then it's a details page.
  // Note: Home page has empty pathParts or firstSegment undefined
  const isDetails = firstSegment && !mainRoutes.includes(firstSegment) && !isPlayer

  const shouldHideNavbar = isPlayer || isDetails || isCatalog || isExploreSeeAll

  return (
    <>
      {!shouldHideNavbar && <Navbar profileId={profileId === 'guest' ? 'guest' : parseInt(profileId!)} profile={profile} />}
      <Outlet />
    </>
  )
}
