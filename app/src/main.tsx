import './index.css'
import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { ErrorBoundary, TitleBar } from './components'
import { SplashScreen } from './components'
import { ProtectedRoute, PublicRoute } from './components/auth/AuthGuards'
import { isTauri, resetAuthClient } from './lib/auth-client'
import { useState, useEffect } from 'react'
import { preloadCommonRoutes } from './utils/route-preloader'
// Initialize toast bridge for legacy window.addToast calls
import './utils/toast'
import { CastProvider } from './contexts/CastContext'
import { StreamingHomeSkeleton, StreamingDetailsSkeleton } from './components/streaming/StreamingLoaders'

import { appMode, AppMode } from './lib/app-mode'
import { OnboardingWizard } from './components/onboarding'

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
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

function AppRoutes() {
  const location = useLocation()
  const navigate = useNavigate()
  
  // App mode state (guest vs connected)
  const [mode, setMode] = useState<AppMode | null | 'web'>(() => {
    // Web apps always use connected mode (same-origin auth)
    if (!isTauri()) return 'web';
    return appMode.get();
  });
  
  // Server URL state (for connected mode in Tauri)
  const [serverUrl, setServerUrl] = useState<string | null>(() => {
    if (!isTauri()) return "web";
    if (appMode.isGuest()) return "guest"; // Guest mode uses local server
    return localStorage.getItem("zentrio_server_url");
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

  // First launch in Tauri - show onboarding wizard
  // Skip if we are on the 2FA page (which happens during login flow)
  if (isTauri() && (mode === null || (mode === 'connected' && !serverUrl)) && location.pathname !== '/two-factor') {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }
  
  return (
    <Routes>
      {/* Public routes - redirect authenticated users based on login behavior */}
      <Route path="/" element={<Suspense fallback={<SplashScreen />}><PublicRoute><LandingPage version="2.0.0" /></PublicRoute></Suspense>} />
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
        <Route index element={
          <Suspense fallback={<StreamingHomeSkeleton />}>
            <StreamingHome />
          </Suspense>
        } />
        <Route path="explore" element={
          <Suspense fallback={<StreamingHomeSkeleton />}>
            <StreamingExplore />
          </Suspense>
        } />
        <Route path="library" element={
          <Suspense fallback={<StreamingHomeSkeleton />}>
            <StreamingLibrary />
          </Suspense>
        } />
        <Route path="library/:listId" element={
          <Suspense fallback={<StreamingHomeSkeleton />}>
            <StreamingLibrary />
          </Suspense>
        } />
        <Route path="search" element={
          <Suspense fallback={<StreamingHomeSkeleton />}>
            <StreamingSearch />
          </Suspense>
        } />
        <Route path="catalog/:manifestUrl/:type/:id" element={
          <Suspense fallback={<StreamingHomeSkeleton />}>
            <StreamingCatalog />
          </Suspense>
        } />
        <Route path=":type/:id" element={
          <Suspense fallback={<StreamingDetailsSkeleton />}>
            <StreamingDetails />
          </Suspense>
        } />
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
        </CastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)