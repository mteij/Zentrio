import React, { lazy, Suspense, useEffect, useState } from 'react'
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

function AppInitializer({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      // If we are in a text-based environment (test/node), ready immediately
      if (typeof window === 'undefined') {
        setReady(true);
        return;
      }

      // Check for Tauri injection
      // On Android, this might take a few milliseconds
      let attempts = 0;
      const checkTauri = () => {
        // Check standard Tauri injection points
        const isTauriRequest = 
          (window as any).__TAURI_INTERNALS__ !== undefined || 
          (window as any).__TAURI__ !== undefined ||
          (window as any).__TAURI_IPC__ !== undefined;

        if (isTauriRequest) {
          console.log('[AppInitializer] Tauri detected!');
          setReady(true);
          return;
        }

        // If not detected yet, and we are locally potentially in a WebView (heuristic?)
        // Actually, just wait a short burst to see if it appears. 
        // If it's a browser, it will never appear, so we timeout.
        if (attempts < 5) { // Wait up to 250ms
          attempts++;
          setTimeout(checkTauri, 50);
        } else {
          console.log('[AppInitializer] Tauri not detected, assuming Web Mode.');
          setReady(true);
        }
      };

      checkTauri();
    };

    init();
  }, []);

  if (!ready) {
    return <SplashScreen />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const location = useLocation()
  const navigate = useNavigate()
  
  // App mode state (guest vs connected)
  const [mode, setMode] = useState<AppMode | null | 'web'>(() => {
    // Now that we waited for initialization, isTauri() is reliable
    const tauriDetected = isTauri();
    const storedMode = appMode.get();
    
    console.log('[AppRoutes] Initializing mode:', { 
      isTauri: tauriDetected, 
      storedMode
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

  // Handle OAuth callback in browser mode
  useEffect(() => {
    // Only handle in browser (not Tauri)
    if (isTauri()) return;
    
    // Check if we're on an OAuth callback URL
    const handleOAuthCallback = async () => {
      const path = window.location.pathname;
      const search = window.location.search;
      
      // Check for OAuth callback (either direct callback or after redirect)
      if (path.includes('/callback/') || search.includes('code=') || search.includes('state=')) {
        console.log('[App] OAuth callback detected in browser, fetching session...');
        
        try {
          // Use authClient to get session - this will use the cookie set by the server
          const sessionRes = await authClient.getSession();
          const sessionData = sessionRes?.data || sessionRes;
          
          if (sessionData?.user) {
            console.log('[App] Browser OAuth: Session found, logging in user:', sessionData.user.email);
            
            // Update auth store
            useAuthStore.getState().login(sessionData.user, {
              user: sessionData.user,
              token: sessionData.session?.token,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            });
            
            // Clean URL and redirect to profiles
            window.history.replaceState({}, '', '/profiles');
            return true;
          } else {
            console.log('[App] Browser OAuth: No session found after callback');
          }
        } catch (e) {
          console.error('[App] Browser OAuth: Error fetching session:', e);
        }
      }
      return false;
    };
    
    handleOAuthCallback();
  }, []);

  // Handle Deep Links (Magic Link and OAuth) - Tauri only
  useEffect(() => {
    if (isTauri()) {
      const handleDeepLinkUrl = async (url: string) => {
        console.log('[App] Deep link received:', url)
        
        if (url.startsWith('zentrio://auth/magic-link') || url.includes('token=')) {
          // Handle magic link authentication
          try {
             const urlObj = new URL(url)
             const token = urlObj.searchParams.get('token')
             if (token) {
                 toast.info('Verifying magic link...')
                 await apiFetch(`/api/auth/magic-link/verify?token=${token}&callbackURL=/profiles`)
                 toast.success('Signed in successfully')
                  const sessionRes = await authClient.getSession();
                  const sessionData = sessionRes?.data || sessionRes;
                  
                  if (sessionData?.user) {
                      // Update auth store with session token
                      useAuthStore.getState().login(sessionData.user, {
                        user: sessionData.user,
                        token: sessionData.session?.token,
                        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                      });
                     
                     // Wait for state propagation
                     await new Promise(resolve => setTimeout(resolve, 100));
                     console.log('[App] Magic link login complete, token:', sessionData.session?.token ? `...${sessionData.session.token.slice(-6)}` : 'none');
                     
                     appMode.set('connected');
                     setMode('connected');
                     const currentServer = localStorage.getItem('zentrio_server_url') || 'https://app.zentrio.eu';
                     setServerUrl(currentServer);
                     
                     navigate('/profiles')
                 }
             }
          } catch(e) {
            console.error('Failed to handle magic link', e)
            toast.error('Failed to sign in with magic link')
          }
        } else if (url.includes('auth_code') || url.includes('code=')) {
          // Handle social login callback with auth code
          try {
            console.log('[App] Processing auth code from deep link');
            const urlObj = new URL(url);
            const authCode = urlObj.searchParams.get('auth_code') || urlObj.searchParams.get('code');
            
            console.log('[App] Extracted auth code:', authCode ? 'FOUND' : 'MISSING');

            if (authCode) {
              toast.info('Finalizing sign in...');
              
              // Exchange the auth code for a session
              console.log('[App] Exchanging auth code...');
              const response = await apiFetch('/api/auth/mobile-callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ authCode })
              });
              
              console.log('[App] Mobile callback response status:', response.status);
              
              if (response.ok) {
                const data = await response.json();
                console.log('[App] Mobile callback data:', data);
                
                if (data.user) {
                  toast.success(`Welcome back, ${data.user.name || 'User'}!`, { duration: 5000 });
                  console.log('[App] 🟢 Mobile login successful!', data.user.email);
                  
                  // Update auth store FIRST
                  useAuthStore.setState({ 
                      user: data.user,
                      session: {
                          user: data.user,
                          token: data.token,
                          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                      },
                      isAuthenticated: true,
                      isLoading: false, // FORCE loading false to unblock UI
                      isFreshLogin: true, // Prevent rehydration from triggering refresh
                      lastActivity: Date.now()
                  });
                  console.log('[App] Auth store updated with user:', data.user.email);
                  
                  // Wait for Zustand state to propagate AFTER login
                  // This ensures the token is readable via getState() before navigation
                  await new Promise(resolve => setTimeout(resolve, 100));
                  
                  // Verify token propagation
                  const verifiedToken = useAuthStore.getState().session?.token;
                  console.log('[App] Token after propagation delay:', verifiedToken ? `...${verifiedToken.slice(-6)}` : 'MISSING');
                  
                  // Update app mode
                  appMode.set('connected');
                  setMode('connected');
                  
                  // Ensure server URL is set correctly AND persisted
                  let currentServer = localStorage.getItem('zentrio_server_url');
                  
                  // In dev mode on Tauri, default to localhost if not set
                  if (!currentServer && import.meta.env.DEV && isTauri()) {
                      currentServer = 'http://localhost:3000';
                  }
                  
                  // Fallback to prod
                  if (!currentServer) {
                      currentServer = 'https://app.zentrio.eu';
                  }
                  
                  // PERSIST IT so auth-client.ts picks it up on reload
                  localStorage.setItem('zentrio_server_url', currentServer);
                  setServerUrl(currentServer);
                  console.log('[App] ServerUrl persisted:', currentServer);
                  
                  // Force a hard reload to /profiles to ensure fresh state
                  // This is safer than navigate() when changing auth state deeply
                  console.log('[App] Hard redirecting to /profiles');
                  window.location.href = '/profiles';
                } else {
                   console.error('[App] No user data in callback response');
                   throw new Error('No user data returned');
                }
              } else {
                 const errorText = await response.text();
                 console.error('[App] Callback response not OK:', errorText);
                 throw new Error('Failed to exchange auth code');
              }
            } else {
                console.warn('[App] No auth code found in deep link');
            }
          } catch (e) {
            console.error('Failed to handle auth code deep link', e);
            toast.error('Sign in failed. Please try again.');
          }
        }
      };

      // 1. Listen to custom desktop events (Windows/Linux manual handling)
      const unlistenPromise = listen('zentrio-deep-link', async (event) => {
        let url = ''
        if (Array.isArray(event.payload) && event.payload.length > 0) {
          url = event.payload[0]
        } else if (typeof event.payload === 'string') {
          url = event.payload
        }
        await handleDeepLinkUrl(url);
      });

      // 2. Listen to official mobile deep links
      let unlistenMobile: (() => void) | null = null;
      import('@tauri-apps/plugin-deep-link').then(({ onOpenUrl }) => {
          onOpenUrl((urls) => {
              if (urls && urls.length > 0) {
                  handleDeepLinkUrl(urls[0]);
              }
          }).then(unlisten => {
              unlistenMobile = unlisten;
          }).catch(err => console.error('[App] Failed to init mobile deep link', err));
      }).catch(() => { /* plugin might not be installed, ignore */ });
      
      return () => {
        unlistenPromise.then(unlisten => unlisten())
        if (unlistenMobile) unlistenMobile();
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
  
  // Track if we've completed the initial auth check to prevent race conditions
  // This prevents showing OnboardingWizard before auth rehydration completes
  const [initialAuthCheckDone, setInitialAuthCheckDone] = useState(false);
  
  useEffect(() => {
    // Only mark initial check as done when loading transitions from true to false
    if (!authLoading && !initialAuthCheckDone) {
      // Add a small delay to ensure state has fully propagated
      const timer = setTimeout(() => {
        console.log('[AppRoutes] Initial auth check completed', { isAuthenticated, isGuestMode });
        setInitialAuthCheckDone(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [authLoading, initialAuthCheckDone, isAuthenticated, isGuestMode]);
  
  // Show OnboardingWizard in Tauri when:
  // 1. Mode has never been set (first launch)
  // 2. Mode is connected but no server URL (incomplete setup)
  // 3. Mode is connected, server URL is set, initial auth check done, but user is NOT authenticated (session expired)
  //    This ensures Tauri users get the native OnboardingWizard instead of web LandingPage
  // Exception: Don't show during 2FA flow
  const shouldShowOnboarding = isTauriApp && (
    mode === null ||
    (mode === 'connected' && !serverUrl) ||
    (mode === 'connected' && serverUrl && initialAuthCheckDone && !isAuthenticated && !isGuestMode)
  ) && location.pathname !== '/two-factor';

  // Tauri apps: Show splash screen while auth is loading or waiting for initial check
  // This prevents the landing page from ever flashing
  // NOTE: Must be AFTER all hooks but BEFORE any conditional returns (except onboarding)
  useEffect(() => {
    // Skip if onboarding wizard will be shown or if still loading
    if (shouldShowOnboarding) return;
    
    // Auth redirect is now handled by the pages themselves (PublicRoute/ProtectedRoute)
    // The previous logic here caused a race condition with deep links
    if (isTauriApp && mode && mode !== 'web' && location.pathname === '/' && initialAuthCheckDone) {
       // Only redirect to profiles if explicitly authenticated
       // Otherwise let the router handle it (LandingPage -> SignIn)
       if (isAuthenticated || isGuestMode) {
          console.log('[AppRoutes] Tauri app at root (authenticated/guest), redirecting to /profiles');
          navigate('/profiles', { replace: true });
       }
    }
  }, [location.pathname, mode, navigate, shouldShowOnboarding, isAuthenticated, isGuestMode, isTauriApp, initialAuthCheckDone]);

  // First launch in Tauri - show onboarding wizard
  // Skip if we are on the 2FA page (which happens during login flow)
  if (shouldShowOnboarding) {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

  // Tauri loading gate: Wait for auth state before rendering routes
  // This prevents the web landing page from flashing on app reopen
  // Wait for BOTH authLoading to complete AND initial check to be done
  if (isTauriApp && (authLoading || !initialAuthCheckDone) && location.pathname === '/') {
    console.log('[AppRoutes] Tauri app waiting for auth state...', { authLoading, initialAuthCheckDone });
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

export default function App() {
  // Initialize Tauri overrides if environment matches
  useEffect(() => {
    if (isTauri()) {
      // Prevent default context menu in Tauri for a native app feel
      const handleContextMenu = (e: MouseEvent) => {
        // Check if the target or any parent has data-native-context-menu attribute
        // This allows specific elements to still show system menu if needed (e.g. inputs)
        const target = e.target as HTMLElement
        if (!target.closest('[data-native-context-menu]')) {
          e.preventDefault()
        }
      };
      
      document.addEventListener('contextmenu', handleContextMenu);
      return () => document.removeEventListener('contextmenu', handleContextMenu);
    }
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <CastProvider>
          <AppLifecycleProvider>
             <AppInitializer>
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
             </AppInitializer>
          </AppLifecycleProvider>
        </CastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
