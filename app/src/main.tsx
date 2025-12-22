import './index.css'
import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { ErrorBoundary } from './components'
import { LoadingSpinner } from './components'
import { ServerSelector } from './components/auth/ServerSelector'
import { ProtectedRoute, PublicRoute } from './components/auth/AuthGuards'
import { isTauri } from './lib/auth-client'
import { useState, useEffect } from 'react'
import { preloadCommonRoutes } from './utils/route-preloader'
// Initialize toast bridge for legacy window.addToast calls
import './utils/toast'
import { CastProvider } from './contexts/CastContext'

// Lazy load all pages for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage as React.ComponentType<{version?: string}> })))
const ProfilesPage = lazy(() => import('./pages/ProfilesPage').then(m => ({ default: m.ProfilesPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const ExploreAddonsPage = lazy(() => import('./pages/ExploreAddonsPage').then(m => ({ default: m.ExploreAddonsPage })))
const SignInPage = lazy(() => import('./pages/auth/SignInPage').then(m => ({ default: m.SignInPage })))
const SignUpPage = lazy(() => import('./pages/auth/SignUpPage').then(m => ({ default: m.SignUpPage })))
const TwoFactorPage = lazy(() => import('./pages/auth/TwoFactorPage').then(m => ({ default: m.TwoFactorPage })))

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
    console.log('AppRoutes: MOUNTED')
    preloadCommonRoutes()
    return () => console.log('AppRoutes: UNMOUNTED')
  }, [])

  // Log location changes
  useEffect(() => {
    console.log('AppRoutes: Location changed to', location.pathname)
  }, [location.pathname])

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
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#141414' }} />}>
      <Routes>
        {/* Public routes - redirect authenticated users based on login behavior */}
        <Route path="/" element={<PublicRoute><LandingPage version="2.0.0" /></PublicRoute>} />
        <Route path="/signin" element={<PublicRoute><SignInPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><SignUpPage /></PublicRoute>} />
        <Route path="/two-factor" element={<TwoFactorPage />} />
        
        {/* Protected routes - require authentication */}
        <Route path="/profiles" element={<ProtectedRoute><ProfilesPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/settings/explore-addons" element={<ProtectedRoute><ExploreAddonsPage /></ProtectedRoute>} />
        <Route path="/streaming/:profileId" element={<ProtectedRoute><StreamingHome /></ProtectedRoute>} />
        <Route path="/streaming/:profileId/explore" element={<ProtectedRoute><StreamingExplore /></ProtectedRoute>} />
        <Route path="/streaming/:profileId/library" element={<ProtectedRoute><StreamingLibrary /></ProtectedRoute>} />
        <Route path="/streaming/:profileId/library/:listId" element={<ProtectedRoute><StreamingLibrary /></ProtectedRoute>} />
        <Route path="/streaming/:profileId/search" element={<ProtectedRoute><StreamingSearch /></ProtectedRoute>} />
        <Route path="/streaming/:profileId/catalog/:manifestUrl/:type/:id" element={<ProtectedRoute><StreamingCatalog /></ProtectedRoute>} />
        <Route path="/streaming/:profileId/:type/:id" element={<ProtectedRoute><StreamingDetails /></ProtectedRoute>} />
        <Route path="/streaming/:profileId/player" element={<ProtectedRoute><StreamingPlayer /></ProtectedRoute>} />
        {/* Add other routes here */}
      </Routes>
    </Suspense>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <CastProvider>
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
        </CastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)