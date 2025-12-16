import './index.css'
import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { ErrorBoundary } from './components'
import { LoadingSpinner } from './components'
import { ServerSelector } from './components/auth/ServerSelector'
import { isTauri } from './lib/auth-client'
import { useState, useEffect } from 'react'
import { preloadCommonRoutes } from './utils/route-preloader'
// Initialize toast bridge for legacy window.addToast calls
import './utils/toast'

// Lazy load all pages for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage as React.ComponentType<{version?: string}> })))
const ProfilesPage = lazy(() => import('./pages/ProfilesPage').then(m => ({ default: m.ProfilesPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const ExploreAddonsPage = lazy(() => import('./pages/ExploreAddonsPage').then(m => ({ default: m.ExploreAddonsPage })))
const SignInPage = lazy(() => import('./pages/auth/SignInPage').then(m => ({ default: m.SignInPage })))
const SignUpPage = lazy(() => import('./pages/auth/SignUpPage').then(m => ({ default: m.SignUpPage })))

// Streaming pages
const StreamingHome = lazy(() => import('./pages/streaming/Home').then(m => ({ default: m.StreamingHome })))
const StreamingDetails = lazy(() => import('./pages/streaming/Details').then(m => ({ default: m.StreamingDetails })))
const StreamingPlayer = lazy(() => import('./pages/streaming/Player').then(m => ({ default: m.StreamingPlayer })))
const StreamingExplore = lazy(() => import('./pages/streaming/Explore').then(m => ({ default: m.StreamingExplore })))
const StreamingLibrary = lazy(() => import('./pages/streaming/Library').then(m => ({ default: m.StreamingLibrary })))
const StreamingSearch = lazy(() => import('./pages/streaming/Search').then(m => ({ default: m.StreamingSearch })))
const StreamingCatalog = lazy(() => import('./pages/streaming/Catalog').then(m => ({ default: m.StreamingCatalog })))

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
  const [serverUrl, setServerUrl] = useState<string | null>(() => {
    // If not in Tauri, we don't need a specific server URL (uses origin)
    // If in Tauri, we check if one is set.
    if (!isTauri()) return "web"; 
    return localStorage.getItem("zentrio_server_url");
  });

  // Preload common routes after mount
  useEffect(() => {
    preloadCommonRoutes()
  }, [])

  if (!serverUrl) {
    const isDev = import.meta.env.DEV;
    return <ServerSelector 
      showDevMode={isDev}
      onServerSelected={(url) => {
        setServerUrl(url);
        window.location.reload(); // Reload to re-initialize auth client with new URL
      }} 
    />;
  }
  
  return (
    <Suspense fallback={<LoadingSpinner fullScreen size="lg" />}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LandingPage version="2.0.0" />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/register" element={<SignUpPage />} />
        <Route path="/profiles" element={<ProfilesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/settings/explore-addons" element={<ExploreAddonsPage />} />
        <Route path="/streaming/:profileId" element={<StreamingHome />} />
        <Route path="/streaming/:profileId/explore" element={<StreamingExplore />} />
        <Route path="/streaming/:profileId/library" element={<StreamingLibrary />} />
        <Route path="/streaming/:profileId/library/:listId" element={<StreamingLibrary />} />
        <Route path="/streaming/:profileId/search" element={<StreamingSearch />} />
        <Route path="/streaming/:profileId/catalog/:manifestUrl/:type/:id" element={<StreamingCatalog />} />
        <Route path="/streaming/:profileId/:type/:id" element={<StreamingDetails />} />
        <Route path="/streaming/:profileId/player" element={<StreamingPlayer />} />
        {/* Add other routes here */}
      </Routes>
    </Suspense>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
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
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)