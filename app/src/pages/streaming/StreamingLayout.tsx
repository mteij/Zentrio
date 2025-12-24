import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Navbar } from '../../components/layout/Navbar'
import { useEffect } from 'react'

const fetchProfile = async (profileId: string) => {
  const res = await fetch(`/api/streaming/dashboard?profileId=${profileId}`)
  if (!res.ok) {
     if (res.status === 401) throw new Error('Unauthorized')
     throw new Error('Failed to load profile')
  }
  const data = await res.json()
  return data.profile
}

export const StreamingLayout = () => {
  const { profileId } = useParams<{ profileId: string }>()
  const navigate = useNavigate()
  const location = useLocation()

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

  // Determine if we are on a page where the navbar should be hidden
  // Player page: ends with /player
  // Details page: /streaming/:profileId/:type/:id (where :type is not one of the reserved keywords)
  const isPlayer = location.pathname.endsWith('/player')
  
  // Get the path segments after /streaming/:profileId
  const pathParts = location.pathname.split(`/streaming/${profileId}`)[1]?.split('/').filter(Boolean) || []
  const firstSegment = pathParts[0]
  
  // Reserved main routes that SHOULD show navbar
  const mainRoutes = ['explore', 'library', 'search', 'catalog']
  
  // If we have a first segment matching a type (e.g. 'movie', 'series') and it's not a reserved route,
  // then it's a details page.
  // Note: Home page has empty pathParts or firstSegment undefined
  const isDetails = firstSegment && !mainRoutes.includes(firstSegment) && !isPlayer

  const shouldHideNavbar = isPlayer || isDetails

  return (
    <>
      {!shouldHideNavbar && <Navbar profileId={parseInt(profileId!)} profile={profile} />}
      <Outlet />
    </>
  )
}
