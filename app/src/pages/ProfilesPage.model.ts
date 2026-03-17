import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '../lib/adminApi'
import { apiFetch } from '../lib/apiFetch'
import { appMode } from '../lib/app-mode'
import { isTauri } from '../lib/auth-client'
import { useAuthStore } from '../stores/authStore'
import { createLogger } from '../utils/client-logger'

const log = createLogger('ProfilesPage')

export interface Profile {
  id: number
  name: string
  avatar: string
  avatar_style?: string
  isDefault?: boolean
  nsfw_filter_enabled?: boolean
  nsfw_age_rating?: number
  settings_profile_id?: number
}

export interface ProfilesScreenModel {
  profiles: Profile[]
  loading: boolean
  editMode: boolean
  showModal: boolean
  editingProfile: Profile | null
  showLogoutConfirm: boolean
  isGuestMode: boolean
  isAdmin: boolean
  navigation: {
    goBack: () => void
    goToSettings: () => void
    goToAdmin: () => void
  }
  actions: {
    setEditMode: (value: boolean) => void
    toggleEditMode: () => void
    handleProfileClick: (profile: Profile) => void
    handleCreateProfile: () => void
    handleEditProfile: (profile: Profile) => void
    handleModalClose: () => void
    handleProfileSaved: () => void
    openLogoutConfirm: () => void
    closeLogoutConfirm: () => void
    confirmLogout: () => Promise<void>
  }
}

export function useProfilesScreenModel(): ProfilesScreenModel {
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    try {
      const cached = localStorage.getItem('zentrioProfiles')
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(() => !localStorage.getItem('zentrioProfiles'))
  const [editMode, setEditMode] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const navigate = useNavigate()

  const isGuestMode = appMode.isGuest()
  const { session, isLoading: authLoading, isAuthenticated, user: authUser } = useAuthStore()

  const { data: adminStatus } = useQuery({
    queryKey: ['admin-status'],
    queryFn: () => adminApi.getStatus(),
    staleTime: Infinity,
    retry: false,
  })

  const sessionUser = useAuthStore.getState().session?.user as any
  const effectiveRole = (authUser as any)?.role || sessionUser?.role
  const hasAdminRole = new Set(['superadmin', 'admin', 'moderator', 'readonly']).has(String(effectiveRole || '').toLowerCase())
  const isAdmin = isAuthenticated && hasAdminRole && (adminStatus?.enabled ?? false)
  const isTauriEnv = isTauri()

  const loadProfiles = useCallback(async (retryCount = 0) => {
    try {
      const res = await apiFetch('/api/profiles')
      log.debug(`API Response: ${res.status}`, { ok: res.ok, url: res.url })

      if (res.status === 401) {
        if (retryCount >= 2) {
          log.debug('Session expired (401) and max retries reached, redirecting to login...')
          navigate('/')
          return
        }

        log.debug('Session expired (401), attempting refresh...')
        const refreshed = await useAuthStore.getState().refreshSession()
        log.debug('Refresh result:', refreshed)

        if (refreshed) {
          log.debug('Refresh success, waiting for token propagation...')
          await new Promise((resolve) => setTimeout(resolve, 100))
          const newToken = useAuthStore.getState().session?.token
          log.debug('New token available:', !!newToken)
          return loadProfiles(retryCount + 1)
        }

        log.debug('Refresh failed, redirecting to login...')
        navigate('/')
        return
      }

      if (res.ok) {
        const data = await res.json()
        log.debug('Profiles loaded:', data)
        setProfiles(data)
        localStorage.setItem('zentrioProfiles', JSON.stringify(data))
        if (data.length === 0) {
          log.debug('No profiles found, retrying once in 1s to handle potential consistency delay...')
          setTimeout(async () => {
            try {
              const retryRes = await apiFetch('/api/profiles')
              if (retryRes.ok) {
                const retryData = await retryRes.json()
                log.debug('Retry profiles loaded:', retryData)
                setProfiles(retryData)
                localStorage.setItem('zentrioProfiles', JSON.stringify(retryData))
              }
            } catch {
              // Ignore delayed retry failures.
            }
          }, 1000)
        }
      }
    } catch (error) {
      log.error('Failed to load profiles:', error)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    if (isGuestMode) {
      log.debug('Guest mode, loading profiles directly...')
      loadProfiles(0)
      return
    }

    if (authLoading) {
      log.debug('Waiting for auth to load...')
      return
    }

    if (isTauriEnv && isAuthenticated && !session?.token) {
      log.debug('Authenticated but waiting for session token (Tauri mode)...')

      const unsubscribe = useAuthStore.subscribe(
        (state) => state.session?.token,
        (token) => {
          if (token) {
            log.debug('Token now available via subscription, loading profiles...')
            loadProfiles(0)
            unsubscribe()
          }
        },
      )

      const fallbackTimer = setTimeout(() => {
        const freshToken = useAuthStore.getState().session?.token
        if (freshToken) {
          log.debug('Token found via fallback timeout, loading profiles...')
          loadProfiles(0)
        } else {
          log.debug('Still no token after timeout, loading anyway (may fail)...')
          loadProfiles(0)
        }
        unsubscribe()
      }, 500)

      return () => {
        unsubscribe()
        clearTimeout(fallbackTimer)
      }
    }

    log.debug('Auth ready, loading profiles...', {
      authLoading,
      isAuthenticated,
      hasToken: !!session?.token,
      isTauriEnv,
    })
    loadProfiles(0)
  }, [authLoading, isAuthenticated, isGuestMode, isTauriEnv, loadProfiles, session?.token])

  const handleEditProfile = (profile: Profile) => {
    setEditingProfile(profile)
    setShowModal(true)
  }

  const handleProfileClick = (profile: Profile) => {
    if (editMode) {
      handleEditProfile(profile)
      return
    }

    localStorage.setItem('selectedProfile', JSON.stringify(profile))
    navigate(`/streaming/${profile.id}`)
  }

  const handleCreateProfile = () => {
    setEditingProfile(null)
    setShowModal(true)
  }

  const handleLogout = async () => {
    if (isGuestMode) {
      appMode.clear()
      localStorage.removeItem('zentrio_server_url')
      window.location.href = '/'
      return
    }

    try {
      await useAuthStore.getState().logout()
      navigate('/')
    } catch (error) {
      log.error('Logout failed', error)
    }
  }

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    }
  }

  return {
    profiles,
    loading,
    editMode,
    showModal,
    editingProfile,
    showLogoutConfirm,
    isGuestMode,
    isAdmin,
    navigation: {
      goBack,
      goToSettings: () => navigate('/settings'),
      goToAdmin: () => navigate('/admin'),
    },
    actions: {
      setEditMode,
      toggleEditMode: () => setEditMode((current) => !current),
      handleProfileClick,
      handleCreateProfile,
      handleEditProfile,
      handleModalClose: () => {
        setShowModal(false)
        setEditingProfile(null)
      },
      handleProfileSaved: () => {
        void loadProfiles()
        setShowModal(false)
        setEditingProfile(null)
      },
      openLogoutConfirm: () => setShowLogoutConfirm(true),
      closeLogoutConfirm: () => setShowLogoutConfirm(false),
      confirmLogout: handleLogout,
    },
  }
}
