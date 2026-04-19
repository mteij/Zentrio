import React, { lazy, Suspense, useEffect, useState } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'
import { LazyMotion, domAnimation } from 'framer-motion'
import { Toaster } from 'sonner'
import { ErrorBoundary, TitleBar, ScrollToTop } from './components'
import { SplashScreen } from './components'
import { ProtectedRoute, PublicRoute, AdminGuard } from './components/auth/AuthGuards'
import { isTauri, resetAuthClient, authClient } from './lib/auth-client'
import { getAppTarget } from './lib/app-target'
import { listen } from '@tauri-apps/api/event'
import { toast } from 'sonner'
import { apiFetch } from './lib/apiFetch'
import { useAuthStore } from './stores/authStore'
import { preloadCommonRoutes } from './utils/route-preloader'
import { getLoginBehaviorRedirectPath } from './hooks/useLoginBehavior'
// Initialize toast bridge for legacy window.addToast calls
import './utils/toast'
import { CastProvider } from './contexts/CastContext'
import { StreamingHomeSkeleton } from './components/streaming/StreamingLoaders'
import { appMode, AppMode } from './lib/app-mode'
import { getPlatformCapabilities } from './lib/platform-capabilities'
import { waitForTauriRuntime } from './lib/runtime-env'
import { TvFocusProvider } from './components/tv'
import { useOfflineDownloadCapability } from './hooks/useOfflineDownloadCapability'
const OnboardingWizard = lazy(() =>
  import('./components/onboarding').then((m) => ({ default: m.OnboardingWizard }))
)
import { AppLifecycleProvider } from './lib/app-lifecycle'
// Import safe area insets CSS plugin for mobile safe area support
import '@saurl/tauri-plugin-safe-area-insets-css-api'
import { createLogger } from './utils/client-logger'

const log = createLogger('App')

// Lazy load all pages for code splitting
const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((m) => ({
    default: m.LandingPage as React.ComponentType<{ version?: string }>,
  }))
)
const ProfilesPage = lazy(() =>
  import('./pages/ProfilesPage').then((m) => ({ default: m.ProfilesPage }))
)
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)
const ExploreAddonsPage = lazy(() =>
  import('./pages/ExploreAddonsRoute').then((m) => ({ default: m.ExploreAddonsRoute }))
)
const TmdbAddonConfigPage = lazy(() =>
  import('./pages/TmdbAddonConfigPage').then((m) => ({ default: m.TmdbAddonConfigPage }))
)
const SignInPage = lazy(() =>
  import('./pages/auth/SignInPage').then((m) => ({ default: m.SignInPage }))
)
const SignUpPage = lazy(() =>
  import('./pages/auth/SignUpPage').then((m) => ({ default: m.SignUpPage }))
)
const TwoFactorPage = lazy(() =>
  import('./pages/auth/TwoFactorPage').then((m) => ({ default: m.TwoFactorPage }))
)
const ActivateDevicePage = lazy(() =>
  import('./pages/ActivateDevicePage').then((m) => ({ default: m.ActivateDevicePage }))
)

// Streaming pages
const StreamingLayout = lazy(() =>
  import('./pages/streaming/StreamingLayout').then((m) => ({ default: m.StreamingLayout }))
)
const StreamingHome = lazy(() =>
  import('./pages/streaming/Home').then((m) => ({ default: m.StreamingHome }))
)
const StreamingDetails = lazy(() =>
  import('./pages/streaming/DetailsRoute').then((m) => ({ default: m.StreamingDetailsRoute }))
)
const StreamingPlayer = lazy(() =>
  import('./pages/streaming/PlayerRoute').then((m) => ({ default: m.StreamingPlayerRoute }))
)
const StreamingExplore = lazy(() =>
  import('./pages/streaming/ExploreRoute').then((m) => ({ default: m.StreamingExploreRoute }))
)
const StreamingLibrary = lazy(() =>
  import('./pages/streaming/LibraryRoute').then((m) => ({ default: m.StreamingLibraryRoute }))
)
const StreamingSearch = lazy(() =>
  import('./pages/streaming/Search').then((m) => ({ default: m.StreamingSearch }))
)
const StreamingCatalog = lazy(() =>
  import('./pages/streaming/Catalog').then((m) => ({ default: m.StreamingCatalog }))
)
const StreamingDownloads = lazy(() =>
  import('./pages/streaming/Downloads').then((m) => ({ default: m.StreamingDownloads }))
)
// Share invite page
const ShareInvitePage = lazy(() =>
  import('./pages/ShareInvitePage').then((m) => ({ default: m.ShareInvitePage }))
)

// Admin pages
const AdminLayout = lazy(() =>
  import('./pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout }))
)
const DashboardPage = lazy(() =>
  import('./pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage }))
)
const SystemPage = lazy(() =>
  import('./pages/admin/SystemPage').then((m) => ({ default: m.SystemPage }))
)
const UsersPage = lazy(() =>
  import('./pages/admin/UsersPage').then((m) => ({ default: m.UsersPage }))
)
const AuditPage = lazy(() =>
  import('./pages/admin/AuditPage').then((m) => ({ default: m.AuditPage }))
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60, // 1 hour - TMDB metadata rarely changes
      gcTime: 1000 * 60 * 60 * 2, // 2 hours - keep data in memory longer
      retry: 1,
      refetchOnWindowFocus: false, // Don't refetch on window focus for streaming data
      // Note: Don't set refetchOnMount: false globally - it breaks initial data loading
      // Individual queries can set refetchOnMount: false if they have pre-fetched data
      refetchOnReconnect: true, // Only refetch on network reconnect
    },
  },
})

// Persist the query cache to localStorage.
// This lets all platforms (web, desktop, mobile, TV) show stale data immediately
// on reconnect or cold-start instead of loading spinners.
// Queries can opt out with meta: { persist: false } (e.g. auth session, admin endpoints).
//
// Note: lz-string compression was removed — it ran synchronously on the main thread
// on every cache write, causing noticeable jank on page loads.
// The raw JSON is a few hundred KB at most, well within localStorage limits.
const queryPersister = createAsyncStoragePersister({
  storage:
    typeof window !== 'undefined'
      ? {
          getItem: async (key) => await get(key),
          setItem: async (key, value) => await set(key, value),
          removeItem: async (key) => await del(key),
        }
      : undefined,
  key: 'zentrio-query-cache',
  throttleTime: 3000, // write at most once per 3 s to reduce main-thread pressure
})

function AppInitializer({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const init = async () => {
      // If we are in a text-based environment (test/node), ready immediately
      if (typeof window === 'undefined') {
        setReady(true)
        return
      }

      const tauriDetected = await waitForTauriRuntime()
      if (tauriDetected) {
        log.debug('Tauri detected!')
      } else {
        log.debug('Tauri not detected, assuming Web Mode.')
      }
      setReady(true)
    }

    init()
  }, [])

  if (!ready) {
    return <SplashScreen />
  }

  return <>{children}</>
}

function AutoUpdateChecker() {
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app')
        const { platform } = await import('@tauri-apps/plugin-os')
        const currentVersion = await getVersion()
        const osName = await platform()

        log.info('[UPDATER-DEBUG] AutoUpdateChecker starting...', { currentVersion, osName })

        if (osName !== 'windows' && osName !== 'macos') {
          log.info('[UPDATER-DEBUG] Platform not supported for auto-update, skipping')
          return
        }

        const { check } = await import('@tauri-apps/plugin-updater')
        log.info('[UPDATER-DEBUG] Calling tauri check() from AutoUpdateChecker...')
        const update = await check()

        log.info(
          '[UPDATER-DEBUG] AutoUpdateChecker check() returned:',
          update ? `update v${update.version}` : 'null'
        )

        if (update) {
          log.info('[UPDATER-DEBUG] Auto update available:', { version: update.version })
          const { toast } = await import('sonner')
          toast.info('Update available', {
            description: `Zentrio ${update.version} is ready to install.`,
            duration: 8000,
            action: {
              label: 'Install',
              onClick: async () => {
                try {
                  log.info('[UPDATER-DEBUG] Starting auto update install...')
                  const { relaunch } = await import('@tauri-apps/plugin-process')
                  let downloaded = 0
                  let contentLength = 0
                  await update.downloadAndInstall((event: any) => {
                    if (event.event === 'Started') {
                      contentLength = event.data?.contentLength ?? 0
                      log.info('[UPDATER-DEBUG] Download started', { contentLength })
                    } else if (event.event === 'Progress') {
                      downloaded += event.data?.chunkLength ?? 0
                    } else if (event.event === 'Finished') {
                      log.info('[UPDATER-DEBUG] Download finished, relaunching...')
                    }
                  })
                  await relaunch()
                } catch (e) {
                  log.error('[UPDATER-DEBUG] Auto update install failed:', e)
                  toast.error('Update failed', { description: 'Please try again later.' })
                }
              },
            },
          })
        } else {
          log.info('[UPDATER-DEBUG] No update available from auto checker')
        }
      } catch (e) {
        log.error('[UPDATER-DEBUG] Auto update check failed:', e)
      }
    }

    const timer = setTimeout(checkForUpdates, 5000)
    return () => clearTimeout(timer)
  }, [])

  return null
}

function AppRoutes() {
  const location = useLocation()
  const navigate = useNavigate()
  const platform = getPlatformCapabilities()

  // App mode state (guest vs connected)
  const [mode, setMode] = useState<AppMode | null | 'web'>(() => {
    // Now that we waited for initialization, isTauri() is reliable
    const tauriDetected = isTauri()
    const storedMode = appMode.get()

    log.debug('Initializing mode:', {
      isTauri: tauriDetected,
      storedMode,
    })

    // Web apps always use connected mode (same-origin auth)
    if (!tauriDetected) return 'web'

    return storedMode
  })

  // Server URL state (for connected mode in Tauri)
  const [serverUrl, setServerUrl] = useState<string | null>(() => {
    if (!isTauri()) return 'web'
    if (appMode.isGuest()) return 'guest' // Guest mode uses local server
    const stored = localStorage.getItem('zentrio_server_url')
    return stored
  })

  // Keep local sidecar gateway target synchronized with selected connected server.
  // This preserves auth behavior while enabling local-first read routing.
  useEffect(() => {
    if (!isTauri()) return

    const isConnected = mode === 'connected'
    if (!isConnected || !serverUrl || serverUrl === 'guest') {
      localStorage.removeItem('zentrio_local_gateway_url')
      localStorage.removeItem('zentrio_local_gateway_remote_url')
      return
    }

    localStorage.setItem('zentrio_local_gateway_enabled', '1')
    localStorage.setItem('zentrio_local_gateway_url', 'http://localhost:3000')
    localStorage.setItem('zentrio_local_gateway_remote_url', serverUrl)
  }, [mode, serverUrl])

  // Preload common routes after mount
  useEffect(() => {
    log.debug('AppRoutes: MOUNTED')
    preloadCommonRoutes()
    return () => log.debug('AppRoutes: UNMOUNTED')
  }, [])

  // Log location changes
  useEffect(() => {
    log.debug('AppRoutes: Location changed to', location.pathname)
  }, [location.pathname])

  // Handle OAuth callback in browser mode
  useEffect(() => {
    // Only handle in browser (not Tauri)
    if (isTauri()) return

    // Check if we're on an OAuth callback URL
    const handleOAuthCallback = async () => {
      const path = window.location.pathname
      const search = window.location.search

      // Check for OAuth callback (either direct callback or after redirect)
      if (path.includes('/callback/') || search.includes('code=') || search.includes('state=')) {
        log.debug('OAuth callback detected in browser, fetching session...')

        try {
          // Use authClient to get session - this will use the cookie set by the server
          const sessionRes = await authClient.getSession()
          const sessionData = (sessionRes as any)?.data ?? sessionRes

          if (sessionData?.user) {
            log.debug('Browser OAuth: Session found, logging in user:', sessionData.user.email)

            // Update auth store
            useAuthStore.getState().login(sessionData.user, {
              user: sessionData.user,
              token: sessionData.session?.token,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            })

            // Device activation needs to stay on its setup page after browser auth.
            if (window.location.pathname === '/activate') {
              window.history.replaceState({}, '', '/activate')
            } else {
              window.history.replaceState({}, '', '/profiles')
            }
            return true
          } else {
            log.debug('Browser OAuth: No session found after callback')
          }
        } catch (e) {
          log.error('Browser OAuth: Error fetching session:', e)
        }
      }
      return false
    }

    handleOAuthCallback()
  }, [])

  // Handle Deep Links (Magic Link and OAuth) - Tauri only
  useEffect(() => {
    if (isTauri()) {
      const handleDeepLinkUrl = async (url: string) => {
        log.debug('Deep link received:', url)

        if (url.startsWith('zentrio://auth/magic-link') || url.includes('token=')) {
          // Handle magic link authentication
          try {
            const urlObj = new URL(url)
            const token = urlObj.searchParams.get('token')
            if (token) {
              toast.info('Verifying magic link...')
              await apiFetch(
                `/api/auth/magic-link/verify?token=${encodeURIComponent(token)}&callbackURL=/profiles`
              )
              toast.success('Signed in successfully')
              const sessionRes = await authClient.getSession()
              const sessionData = (sessionRes as any)?.data ?? sessionRes

              if (sessionData?.user) {
                // Update auth store with session token
                useAuthStore.getState().login(sessionData.user, {
                  user: sessionData.user,
                  token: sessionData.session?.token,
                  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                })

                // Wait for state propagation
                await new Promise((resolve) => setTimeout(resolve, 100))
                log.debug('Magic link login complete, token present:', !!sessionData.session?.token)

                appMode.set('connected')
                setMode('connected')
                const currentServer =
                  localStorage.getItem('zentrio_server_url') || 'https://app.zentrio.eu'
                setServerUrl(currentServer)

                navigate(getLoginBehaviorRedirectPath())
              }
            }
          } catch (e) {
            log.error('Failed to handle magic link', e)
            toast.error('Failed to sign in with magic link')
          }
        } else if (url.startsWith('zentrio://launcher/open')) {
          try {
            const urlObj = new URL(url)
            const profileId = urlObj.searchParams.get('profileId')
            const type = urlObj.searchParams.get('type')
            const id = urlObj.searchParams.get('id')
            const season = urlObj.searchParams.get('season')
            const episode = urlObj.searchParams.get('episode')

            if (!profileId || !type || !id) {
              return
            }

            navigate(
              `/streaming/${encodeURIComponent(profileId)}/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,
              {
                state: {
                  autoPlay: true,
                  season: season ? parseInt(season, 10) : undefined,
                  episode: episode ? parseInt(episode, 10) : undefined,
                },
              }
            )
          } catch (e) {
            log.error('Failed to handle launcher deep link', e)
          }
        } else if (url.includes('auth_code') || url.includes('code=')) {
          // Handle social login callback with auth code
          try {
            log.debug('Processing auth code from deep link')
            const urlObj = new URL(url)
            const authCode = urlObj.searchParams.get('auth_code') || urlObj.searchParams.get('code')

            log.debug('Extracted auth code:', authCode ? 'FOUND' : 'MISSING')

            if (authCode) {
              toast.info('Finalizing sign in...')

              // Exchange the auth code for a session
              log.debug('Exchanging auth code...')
              const response = await apiFetch('/api/auth/mobile-callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ authCode }),
              })

              log.debug('Mobile callback response status:', response.status)

              if (response.ok) {
                const data = await response.json()
                log.debug('Mobile callback data:', data)

                if (data.user) {
                  toast.success(`Welcome back, ${data.user.name || 'User'}!`, { duration: 5000 })
                  log.debug('🟢 Mobile login successful!', data.user.email)

                  // Update auth store FIRST
                  useAuthStore.setState({
                    user: data.user,
                    session: {
                      user: data.user,
                      token: data.token,
                      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    },
                    isAuthenticated: true,
                    isLoading: false, // FORCE loading false to unblock UI
                    isFreshLogin: true, // Prevent rehydration from triggering refresh
                    lastActivity: Date.now(),
                  })
                  log.debug('Auth store updated with user:', data.user.email)

                  // Wait for Zustand state to propagate AFTER login
                  // This ensures the token is readable via getState() before navigation
                  await new Promise((resolve) => setTimeout(resolve, 100))

                  // Verify token propagation
                  const verifiedToken = useAuthStore.getState().session?.token
                  log.debug(
                    'Auth state propagation delay complete, token present:',
                    !!verifiedToken
                  )

                  // Update app mode
                  appMode.set('connected')
                  setMode('connected')

                  // Ensure server URL is set correctly AND persisted
                  let currentServer = localStorage.getItem('zentrio_server_url')

                  // In dev mode on Tauri, default to localhost if not set
                  if (!currentServer && import.meta.env.DEV && isTauri()) {
                    currentServer = 'http://localhost:3000'
                  }

                  // Fallback to prod
                  if (!currentServer) {
                    currentServer = 'https://app.zentrio.eu'
                  }

                  // PERSIST IT so auth-client.ts picks it up on reload
                  localStorage.setItem('zentrio_server_url', currentServer)
                  setServerUrl(currentServer)
                  log.debug('ServerUrl persisted:', currentServer)

                  // Force a hard reload to ensure fresh state
                  // This is safer than navigate() when changing auth state deeply
                  const postLoginPath = getLoginBehaviorRedirectPath()
                  log.debug('Hard redirecting to', postLoginPath)
                  window.location.href = postLoginPath
                } else {
                  log.error('No user data in callback response')
                  throw new Error('No user data returned')
                }
              } else {
                const errorText = await response.text()
                log.error('Callback response not OK:', errorText)
                throw new Error('Failed to exchange auth code')
              }
            } else {
              log.warn('No auth code found in deep link')
            }
          } catch (e) {
            log.error('Failed to handle auth code deep link', e)
            toast.error('Sign in failed. Please try again.')
          }
        }
      }

      // 1. Listen to custom desktop events (Windows/Linux manual handling)
      const unlistenPromise = listen('zentrio-deep-link', async (event) => {
        let url = ''
        if (Array.isArray(event.payload) && event.payload.length > 0) {
          url = event.payload[0]
        } else if (typeof event.payload === 'string') {
          url = event.payload
        }
        await handleDeepLinkUrl(url)
      })

      // 2. Listen to official mobile deep links
      let unlistenMobile: (() => void) | null = null
      import('@tauri-apps/plugin-deep-link')
        .then(({ onOpenUrl }) => {
          onOpenUrl((urls) => {
            if (urls && urls.length > 0) {
              handleDeepLinkUrl(urls[0])
            }
          })
            .then((unlisten) => {
              unlistenMobile = unlisten
            })
            .catch((err) => log.error('Failed to init mobile deep link', err))
        })
        .catch(() => {
          /* plugin might not be installed, ignore */
        })

      return () => {
        unlistenPromise.then((unlisten) => unlisten())
        if (unlistenMobile) unlistenMobile()
      }
    }
  }, [navigate])

  // Handle onboarding completion
  const handleOnboardingComplete = (selectedMode: AppMode, selectedServerUrl?: string) => {
    log.debug('handleOnboardingComplete called', { selectedMode, selectedServerUrl })
    // Persist completion state
    appMode.set(selectedMode)

    setMode(selectedMode)
    if (selectedMode === 'guest') {
      setServerUrl('guest')
    } else if (selectedServerUrl) {
      localStorage.setItem('zentrio_server_url', selectedServerUrl) // Ensure persistence
      setServerUrl(selectedServerUrl)
      resetAuthClient()
    }
    // Navigate to the appropriate page
    // Guest mode now goes to profiles page too, to allow profile selection/management
    navigate('/profiles')
  }

  // Get auth loading state for Tauri loading gate
  const { isLoading: authLoading, isAuthenticated } = useAuthStore()

  // Calculate if we should show onboarding (needs to be before hooks for consistent order)
  const isTauriApp = platform.canUseNativeShell
  const isGuestMode = appMode.isGuest()

  // Track if we've completed the initial auth check to prevent race conditions
  // This prevents showing OnboardingWizard before auth rehydration completes
  const [initialAuthCheckDone, setInitialAuthCheckDone] = useState(false)

  useEffect(() => {
    // Only mark initial check as done when loading transitions from true to false
    if (!authLoading && !initialAuthCheckDone) {
      // Add a small delay to ensure state has fully propagated
      const timer = setTimeout(() => {
        log.debug('Initial auth check completed', { isAuthenticated, isGuestMode })
        setInitialAuthCheckDone(true)
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [authLoading, initialAuthCheckDone, isAuthenticated, isGuestMode])

  // Show OnboardingWizard in Tauri when:
  // 1. Mode has never been set (first launch)
  // 2. Mode is connected but no server URL (incomplete setup)
  // 3. Mode is connected, server URL is set, initial auth check done, but user is NOT authenticated (session expired)
  //    This ensures Tauri users get the native OnboardingWizard instead of web LandingPage
  // Exception: Don't show during 2FA flow
  const shouldShowTvBrowserOnboarding =
    platform.canUseRemoteNavigation &&
    !isTauriApp &&
    initialAuthCheckDone &&
    !isAuthenticated &&
    (location.pathname === '/' ||
      location.pathname === '/signin' ||
      location.pathname === '/register')

  const shouldShowOnboarding =
    (isTauriApp &&
      (mode === null ||
        (mode === 'connected' && !serverUrl) ||
        (mode === 'connected' &&
          serverUrl &&
          initialAuthCheckDone &&
          !isAuthenticated &&
          !isGuestMode))) ||
    shouldShowTvBrowserOnboarding

  const shouldBlockOnboardingForPath =
    location.pathname === '/two-factor' || location.pathname === '/activate'

  // Tauri apps: Show splash screen while auth is loading or waiting for initial check
  // This prevents the landing page from ever flashing
  // NOTE: Must be AFTER all hooks but BEFORE any conditional returns (except onboarding)
  useEffect(() => {
    // Skip if onboarding wizard will be shown or if still loading
    if (shouldShowOnboarding) return

    // Auth redirect is now handled by the pages themselves (PublicRoute/ProtectedRoute)
    // The previous logic here caused a race condition with deep links
    if (isTauriApp && mode && mode !== 'web' && location.pathname === '/' && initialAuthCheckDone) {
      // Only redirect to profiles if explicitly authenticated
      // Otherwise let the router handle it (LandingPage -> SignIn)
      if (isAuthenticated || isGuestMode) {
        const dest = isGuestMode ? '/profiles' : getLoginBehaviorRedirectPath()
        log.debug('Tauri app at root (authenticated/guest), redirecting to', dest)
        navigate(dest, { replace: true })
      }
    }
  }, [
    location.pathname,
    mode,
    navigate,
    shouldShowOnboarding,
    isAuthenticated,
    isGuestMode,
    isTauriApp,
    initialAuthCheckDone,
  ])

  // First launch in Tauri - show onboarding wizard
  // Skip if we are on the 2FA page (which happens during login flow)
  if (shouldShowOnboarding && !shouldBlockOnboardingForPath) {
    return (
      <Suspense fallback={<SplashScreen />}>
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      </Suspense>
    )
  }

  // Tauri loading gate: Wait for auth state before rendering routes
  // This prevents the web landing page from flashing on app reopen
  // Wait for BOTH authLoading to complete AND initial check to be done
  if (isTauriApp && (authLoading || !initialAuthCheckDone) && location.pathname === '/') {
    log.debug('Tauri app waiting for auth state...', { authLoading, initialAuthCheckDone })
    return <SplashScreen />
  }

  return (
    <Routes>
      {/* Public routes - redirect authenticated users based on login behavior */}
      <Route
        path="/"
        element={
          <Suspense fallback={<SplashScreen />}>
            <PublicRoute>
              <LandingPage version={__APP_VERSION__} />
            </PublicRoute>
          </Suspense>
        }
      />
      <Route
        path="/signin"
        element={
          <Suspense fallback={<SplashScreen />}>
            <PublicRoute>
              <SignInPage />
            </PublicRoute>
          </Suspense>
        }
      />
      <Route
        path="/register"
        element={
          <Suspense fallback={<SplashScreen />}>
            <PublicRoute>
              <SignUpPage />
            </PublicRoute>
          </Suspense>
        }
      />
      <Route
        path="/two-factor"
        element={
          <Suspense fallback={<SplashScreen />}>
            <TwoFactorPage />
          </Suspense>
        }
      />
      <Route
        path="/activate"
        element={
          <Suspense fallback={<SplashScreen />}>
            <ActivateDevicePage />
          </Suspense>
        }
      />

      {/* Share invitation page (accessible without auth, but accept requires auth) */}
      <Route
        path="/share/:token"
        element={
          <Suspense fallback={<SplashScreen />}>
            <ShareInvitePage />
          </Suspense>
        }
      />

      {/* Protected routes - require authentication */}
      <Route
        path="/profiles"
        element={
          <Suspense fallback={<SplashScreen />}>
            <ProtectedRoute>
              <ProfilesPage />
            </ProtectedRoute>
          </Suspense>
        }
      />
      <Route
        path="/settings"
        element={
          <Suspense fallback={<SplashScreen />}>
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          </Suspense>
        }
      />
      <Route
        path="/settings/explore-addons"
        element={
          <Suspense fallback={<SplashScreen />}>
            <ProtectedRoute>
              <ExploreAddonsPage />
            </ProtectedRoute>
          </Suspense>
        }
      />
      <Route
        path="/settings/addons/tmdb-config"
        element={
          <Suspense fallback={<SplashScreen />}>
            <ProtectedRoute>
              <TmdbAddonConfigPage />
            </ProtectedRoute>
          </Suspense>
        }
      />

      {/* Admin routes - requires admin privileges */}
      <Route
        path="/admin"
        element={
          <Suspense fallback={<SplashScreen />}>
            <AdminGuard>
              <AdminLayout />
            </AdminGuard>
          </Suspense>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="system" element={<SystemPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>

      {/* Streaming Routes with Nested Layout */}
      <Route
        path="/streaming/:profileId"
        element={
          <Suspense fallback={<StreamingHomeSkeleton />}>
            <ProtectedRoute>
              <StreamingLayout />
            </ProtectedRoute>
          </Suspense>
        }
      >
        <Route index element={<StreamingHome />} />
        <Route path="explore" element={<StreamingExplore />} />
        <Route path="library" element={<StreamingLibrary />} />
        <Route path="library/:listId" element={<StreamingLibrary />} />
        <Route path="search" element={<StreamingSearch />} />
        <Route
          path="downloads"
          element={
            platform.canUseNativeShell ? (
              <RequireOfflineDownloads>
                <StreamingDownloads />
              </RequireOfflineDownloads>
            ) : (
              <Navigate to=".." replace />
            )
          }
        />
        <Route path="downloads/:mediaId" element={<Navigate to=".." replace />} />
        <Route path="catalog/:manifestUrl/:type/:id" element={<StreamingCatalog />} />
        <Route path=":type/:id" element={<StreamingDetails />} />
        <Route
          path="player"
          element={
            <Suspense
              fallback={
                <div className="bg-black text-white w-full h-screen flex items-center justify-center">
                  Loading Player...
                </div>
              }
            >
              <StreamingPlayer />
            </Suspense>
          }
        />
      </Route>
      {/* Add other routes here */}
    </Routes>
  )
}

function RequireOfflineDownloads({ children }: { children: React.ReactNode }) {
  const { profileId } = useParams<{ profileId: string }>()
  const platform = getPlatformCapabilities()
  const { isAvailable, isLoading, isTv } = useOfflineDownloadCapability(profileId)

  if (!platform.canUseNativeShell) {
    return <Navigate to=".." replace />
  }

  if (isTv && isLoading) {
    return <StreamingHomeSkeleton />
  }

  if (!isAvailable) {
    return <Navigate to={profileId ? `/streaming/${profileId}` : '/profiles'} replace />
  }

  return <>{children}</>
}

export default function App() {
  const platform = getPlatformCapabilities()

  // Initialize Tauri overrides if environment matches
  useEffect(() => {
    if (platform.canUseNativeShell) {
      // Prevent default context menu in Tauri for a native app feel
      const handleContextMenu = (e: MouseEvent) => {
        // Check if the target or any parent has data-native-context-menu attribute
        // This allows specific elements to still show system menu if needed (e.g. inputs)
        const target = e.target as HTMLElement
        if (!target.closest('[data-native-context-menu]')) {
          e.preventDefault()
        }
      }

      document.addEventListener('contextmenu', handleContextMenu)
      return () => document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [platform.canUseNativeShell])

  // Global wheel-scroll fix for all non-TV pages.
  //
  // Problem: body and html both get a computed overflow-y:auto from overflow-x:hidden,
  // which makes them appear scrollable to the browser's hit-test. But body.scrollTop is
  // a no-op in standards mode, so trackpad wheel events silently disappear on any page
  // that doesn't have its own scroll container above body in the DOM walk.
  //
  // Fix: capture every wheel event at the document root, find the first real scrollable
  // ancestor (skipping body/html), and drive scrollTop directly. The browser's native
  // scroll path is suppressed via preventDefault so we don't double-scroll.
  //
  // TV/remote platforms are excluded — they use focus-based navigation, not wheel scroll.
  useEffect(() => {
    if (platform.canUseRemoteNavigation) return

    const findVerticalScrollTarget = (element: HTMLElement | null): HTMLElement | null => {
      let current = element
      // Stop before body/html — both get computed overflow-y:auto from overflow-x:hidden
      // which makes them appear scrollable, but body.scrollTop is a no-op in standards mode.
      // The fallback (document.scrollingElement) correctly handles page-level scrolling.
      while (current && current !== document.body && current !== document.documentElement) {
        const style = window.getComputedStyle(current)
        const canScrollY =
          /(auto|scroll|overlay)/.test(style.overflowY) &&
          current.scrollHeight > current.clientHeight
        if (canScrollY) return current
        current = current.parentElement
      }
      return document.scrollingElement instanceof HTMLElement
        ? document.scrollingElement
        : document.documentElement
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.defaultPrevented) return

      const path = typeof event.composedPath === 'function' ? event.composedPath() : []
      const isInRowScrollContainer = path.some((node) => {
        return node instanceof HTMLElement && node.dataset.rowScrollContainer === 'true'
      })

      // Let dedicated horizontal scroll rows handle their own wheel events.
      // Use composedPath so this also works reliably with nested wrappers.
      if (isInRowScrollContainer) return

      // Ignore primarily-horizontal gestures (horizontal swipe, etc.)
      if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return
      const target = event.target as HTMLElement | null
      if (!target) return
      // Let form controls and dialogs handle their own scroll
      if (target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'))
        return
      const scrollTarget = findVerticalScrollTarget(target)
      if (!scrollTarget || scrollTarget.scrollHeight <= scrollTarget.clientHeight) return
      event.preventDefault()
      scrollTarget.scrollTop += event.deltaY
    }

    // Bubble phase is intentional: component-level wheel handlers (like row
    // horizontal scrollers) should run first and can opt out via preventDefault.
    document.addEventListener('wheel', handleWheel, { passive: false })
    return () => document.removeEventListener('wheel', handleWheel)
  }, [platform.canUseRemoteNavigation])

  return (
    <ErrorBoundary>
      <LazyMotion features={domAnimation}>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            maxAge: 1000 * 60 * 60 * 4, // 4 hours
            buster: __APP_VERSION__,
            dehydrateOptions: {
              shouldDehydrateQuery: (query) => {
                if (query.state.status !== 'success') return false
                // Opt-out via meta: { persist: false }
                if (query.meta?.persist === false) return false
                // Never persist admin queries — roles/permissions can change server-side
                const firstKey = query.queryKey[0]
                if (typeof firstKey === 'string' && firstKey.startsWith('admin')) return false
                return true
              },
            },
          }}
        >
          <CastProvider>
            <AppLifecycleProvider>
              <AppInitializer>
                <AutoUpdateChecker />
                <TvFocusProvider>
                  <BrowserRouter>
                    <ScrollToTop />
                    <TitleBar />
                    <AppRoutes />
                  </BrowserRouter>
                  {/* Toaster is intentionally outside BrowserRouter so it is never
                      unmounted by route transitions or Suspense boundaries. */}
                  <Toaster
                    theme="dark"
                    position={getAppTarget().isMobile ? 'top-center' : 'top-right'}
                    richColors
                    closeButton
                    duration={5000}
                    toastOptions={{
                      style: {
                        background: 'rgba(20, 20, 20, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(12px)',
                      },
                    }}
                  />
                </TvFocusProvider>
              </AppInitializer>
            </AppLifecycleProvider>
          </CastProvider>
        </PersistQueryClientProvider>
      </LazyMotion>
    </ErrorBoundary>
  )
}
