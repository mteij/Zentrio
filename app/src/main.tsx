import './index.css'
import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { ErrorBoundary, TitleBar } from './components'
import { SplashScreen } from './components'
import { ProtectedRoute, PublicRoute } from './components/auth/AuthGuards'
import { isTauri, resetAuthClient, authClient } from './lib/auth-client'
import { listen } from '@tauri-apps/api/event'
import { toast } from 'sonner'
import { apiFetch } from './lib/apiFetch'
import { useAuthStore } from './stores/authStore'
import { useState, useEffect } from 'react'
import { preloadCommonRoutes } from './utils/route-preloader'
// Initialize toast bridge for legacy window.addToast calls
import './utils/toast'
import { CastProvider } from './contexts/CastContext'
import { StreamingHomeSkeleton } from './components/streaming/StreamingLoaders'

import { appMode, AppMode } from './lib/app-mode'
import { OnboardingWizard } from './components/onboarding'
import { AppLifecycleProvider } from './lib/app-lifecycle'
// Import safe area insets CSS plugin for mobile safe area support
import '@saurl/tauri-plugin-safe-area-insets-css-api'

// Lazy load all pages for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage as React.ComponentType<{version?: string}> })))
const ProfilesPage = lazy(() => import('./pages/ProfilesPage').then(m => ({ default: m.ProfilesPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const ExploreAddonsPage = lazy(() => import('./pages/ExploreAddonsPage').then(m => ({ default: m.ExploreAddonsPage })))
const SignInPage = lazy(() => import('./pages/auth/SignInPage').then(m => ({ default: m.SignInPage })))
const SignUpPage = lazy(() => import('./pages/auth/SignUpPage').then(m => ({ default: m.SignUpPage })))
const TwoFactorPage = lazy(() => import('./pages/auth/TwoFactorPage').then(m => ({ default: m.TwoFactorPage })))

// Streaming pages
const StreamingLayout = lazy(() => import('./pages/streaming/StreamingLayout').then(m => ({ default: m.StreamingLayout })))
const StreamingHome = lazy(() => import('./pages/streaming/Home').then(m => ({ default: m.StreamingHome })))
const StreamingDetails = lazy(() => import('./pages/streaming/Details').then(m => ({ default: m.StreamingDetails })))
const StreamingPlayer = lazy(() => import('./pages/streaming/Player').then(m => ({ default: m.StreamingPlayer })))
const StreamingExplore = lazy(() => import('./pages/streaming/Explore').then(m => ({ default: m.StreamingExplore })))
const StreamingLibrary = lazy(() => import('./pages/streaming/Library').then(m => ({ default: m.StreamingLibrary })))
const StreamingSearch = lazy(() => import('./pages/streaming/Search').then(m => ({ default: m.StreamingSearch })))
const StreamingCatalog = lazy(() => import('./pages/streaming/Catalog').then(m => ({ default: m.StreamingCatalog })))

// Share invite page
const ShareInvitePage = lazy(() => import('./pages/ShareInvitePage').then(m => ({ default: m.ShareInvitePage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data stays fresh for 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes - garbage collection time
      retry: 1,
      refetchOnWindowFocus: false, // Don't refetch on window focus for streaming data
      // Note: Don't set refetchOnMount: false globally - it breaks initial data loading
      // Individual queries can set refetchOnMount: false if they have pre-fetched data
      refetchOnReconnect: true, // Only refetch on network reconnect
    },
  },
})

function AppRoutes() {
  const location = useLocation()
  const navigate = useNavigate()
  
  // App mode state (guest vs connected)
  const [mode, setMode] = useState<AppMode | null | 'web'>(() => {
    const tauriDetected = isTauri();
    const storedMode = appMode.get();
    console.log('[AppRoutes] Initializing mode:', { 
      isTauri: tauriDetected, 
      storedMode,
      hasTauriInternals: typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__,
      hasTauriGlobal: typeof window !== 'undefined' && !!(window as any).__TAURI__
    });
    // Web apps always use connected mode (same-origin auth)
    if (!tauriDetected) return 'web';
    return storedMode;
  });
  
  // Server URL state (for connected mode in Tauri)
  const [serverUrl, setServerUrl] = useState<string | null>(() => {
    if (!isTauri()) return "web";
    if (appMode.isGuest()) return "guest"; // Guest mode uses local server
    const stored = localStorage.getItem("zentrio_server_url");
    console.log('[AppRoutes] Initializing serverUrl:', { stored, isGuest: appMode.isGuest() });
    return stored;
  });

  // Preload common routes after mount
  useEffect(() => {
    console.log('AppRoutes: MOUNTED')
    preloadCommonRoutes()
    return () => console.log('AppRoutes: UNMOUNTED')
  }, [])

  // Log location changes
  useEffect(() => {
    console.log('AppRoutes: Location changed to', location.pathname)
  }, [location.pathname])

  // Handle Deep Links (Magic Link)
  useEffect(() => {
    if (isTauri()) {
      const unlistenPromise = listen('deep-link://new-url', async (event) => {
        const url = event.payload as string
        console.log('[App] Deep link received:', url)
        
        if (url.startsWith('zentrio://auth/magic-link') || url.includes('token=')) {
          try {
            // Parse url to get token
            const urlObj = new URL(url)
            const token = urlObj.searchParams.get('token')
            
            if (token) {
              toast.info('Verifying magic link...')
              
              // We must manually call the verify endpoint because authClient.signIn.magicLink 
              // targets the initiation endpoint.
              // We add a safe callbackURL to ensure the server redirects to a valid HTTP/Path 
              // that the fetch client can handle (avoiding 'zentrio://' redirect loop issues in fetch)
              await apiFetch(`/api/auth/magic-link/verify?token=${token}&callbackURL=/profiles`)
              
              toast.success('Signed in successfully')
              
              // Refresh auth state and update store
              const { data } = await authClient.getSession();
              if (data?.user) {
                 useAuthStore.getState().login(data.user);
                 
                 // Update app mode to exit onboarding
                 appMode.set('connected');
                 setMode('connected');
                 
                 // Ensure server URL is set (it should be from previous steps, or default)
                 const currentServer = localStorage.getItem('zentrio_server_url') || 'https://app.zentrio.eu';
                 setServerUrl(currentServer);
              }
              navigate('/profiles')
            }
          } catch (e) {
            console.error('Failed to handle magic link', e)
            toast.error('Failed to sign in with magic link')
          }
        }
      })
      
      return () => {
        unlistenPromise.then(unlisten => unlisten())
      }
    }
  }, [navigate])

  // Handle onboarding completion
  const handleOnboardingComplete = (selectedMode: AppMode, selectedServerUrl?: string) => {
    console.log('[AppRoutes] handleOnboardingComplete called', { selectedMode, selectedServerUrl });
    // Persist completion state
    appMode.set(selectedMode);
    
    setMode(selectedMode);
    if (selectedMode === 'guest') {
      setServerUrl('guest');
    } else if (selectedServerUrl) {
      localStorage.setItem('zentrio_server_url', selectedServerUrl); // Ensure persistence
      setServerUrl(selectedServerUrl);
      resetAuthClient();
    }
    // Navigate to the appropriate page
    // Guest mode now goes to profiles page too, to allow profile selection/management
    navigate('/profiles');
  };

  // Get auth loading state for Tauri loading gate
  const { isLoading: authLoading, isAuthenticated } = useAuthStore();

  // Calculate if we should show onboarding (needs to be before hooks for consistent order)
  const isTauriApp = isTauri();
  const isGuestMode = appMode.isGuest();
  const shouldShowOnboarding = isTauriApp && (mode === null || (mode === 'connected' && !serverUrl)) && location.pathname !== '/two-factor';

  // Tauri apps: Show splash screen while auth is loading
  // This prevents the landing page from ever flashing
  // NOTE: Must be AFTER all hooks but BEFORE any conditional returns (except onboarding)
  useEffect(() => {
    // Skip if onboarding wizard will be shown or if still loading
    if (shouldShowOnboarding || authLoading) return;
    
    if (isTauriApp && mode && mode !== 'web' && location.pathname === '/') {
      // Redirect based on auth state
      if (isAuthenticated || isGuestMode) {
        console.log('[AppRoutes] Tauri app at root (authenticated/guest), redirecting to /profiles');
        navigate('/profiles', { replace: true });
      } else {
        console.log('[AppRoutes] Tauri app at root (not authenticated), redirecting to /signin');
        navigate('/signin', { replace: true });
      }
    }
  }, [location.pathname, mode, navigate, shouldShowOnboarding, authLoading, isAuthenticated, isGuestMode, isTauriApp]);

  // First launch in Tauri - show onboarding wizard
  // Skip if we are on the 2FA page (which happens during login flow)
  if (shouldShowOnboarding) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

  // Tauri loading gate: Wait for auth state before rendering routes
  // This prevents the web landing page from flashing on app reopen
  if (isTauriApp && authLoading && location.pathname === '/') {
    console.log('[AppRoutes] Tauri app waiting for auth state...');
    return <SplashScreen />;
  }
  
  return (
    <Routes>
      {/* Public routes - redirect authenticated users based on login behavior */}
      <Route path="/" element={<Suspense fallback={<SplashScreen />}><PublicRoute><LandingPage version={__APP_VERSION__} /></PublicRoute></Suspense>} />
      <Route path="/signin" element={<Suspense fallback={<SplashScreen />}><PublicRoute><SignInPage /></PublicRoute></Suspense>} />
      <Route path="/register" element={<Suspense fallback={<SplashScreen />}><PublicRoute><SignUpPage /></PublicRoute></Suspense>} />
      <Route path="/two-factor" element={<Suspense fallback={<SplashScreen />}><TwoFactorPage /></Suspense>} />
      
      {/* Share invitation page (accessible without auth, but accept requires auth) */}
      <Route path="/share/:token" element={<Suspense fallback={<SplashScreen />}><ShareInvitePage /></Suspense>} />
      
      {/* Protected routes - require authentication */}
      <Route path="/profiles" element={<Suspense fallback={<SplashScreen />}><ProtectedRoute><ProfilesPage /></ProtectedRoute></Suspense>} />
      <Route path="/settings" element={<Suspense fallback={<SplashScreen />}><ProtectedRoute><SettingsPage /></ProtectedRoute></Suspense>} />
      <Route path="/settings/explore-addons" element={<Suspense fallback={<SplashScreen />}><ProtectedRoute><ExploreAddonsPage /></ProtectedRoute></Suspense>} />
      
      {/* Streaming Routes with Nested Layout */}
      <Route path="/streaming/:profileId" element={
        <Suspense fallback={<StreamingHomeSkeleton />}>
          <ProtectedRoute>
            <StreamingLayout />
          </ProtectedRoute>
        </Suspense>
      }>
        <Route index element={<StreamingHome />} />
        <Route path="explore" element={<StreamingExplore />} />
        <Route path="library" element={<StreamingLibrary />} />
        <Route path="library/:listId" element={<StreamingLibrary />} />
        <Route path="search" element={<StreamingSearch />} />
        <Route path="catalog/:manifestUrl/:type/:id" element={<StreamingCatalog />} />
        <Route path=":type/:id" element={<StreamingDetails />} />
        <Route path="player" element={
          <Suspense fallback={<div className="bg-black text-white w-full h-screen flex items-center justify-center">Loading Player...</div>}>
            <StreamingPlayer />
          </Suspense>
        } />
      </Route>
      {/* Add other routes here */}
    </Routes>
  )
}


// Initialize Tauri overrides if environment matches
if (isTauri()) {
  // Prevent default context menu in Tauri for a native app feel
  document.addEventListener('contextmenu', (e) => {
    // Check if the target or any parent has data-native-context-menu attribute
    // This allows specific elements to still show system menu if needed (e.g. inputs)
    const target = e.target as HTMLElement
    if (!target.closest('[data-native-context-menu]')) {
      e.preventDefault()
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <CastProvider>
          <AppLifecycleProvider>
            <BrowserRouter>
              <TitleBar />
              <AppRoutes />
              <Toaster 
                theme="dark"
                position="top-right"
                richColors
                closeButton
                toastOptions={{
                  style: {
                    background: 'rgba(20, 20, 20, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(12px)',
                  },
                }}
              />
            </BrowserRouter>
          </AppLifecycleProvider>
        </CastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)