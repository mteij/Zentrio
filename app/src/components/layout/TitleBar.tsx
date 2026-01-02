import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/apiFetch';
import { getServerUrl } from '../../lib/auth-client';
import { useAuthStore } from '../../stores/authStore';

// Helper to check if we're running in Tauri
const isTauri = () => {
  if (typeof window === 'undefined') return false;
  // Tauri 2.x uses __TAURI_INTERNALS__, but with withGlobalTauri: true also exposes __TAURI__
  return !!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__;
};

// Detect desktop platform (for titlebar styling)
const getDesktopPlatform = (): 'macos' | 'windows' | 'linux' => {
  if (typeof navigator === 'undefined') return 'windows';
  const platform = navigator.platform?.toLowerCase() || '';
  if (platform.includes('mac')) return 'macos';
  if (platform.includes('linux')) return 'linux';
  return 'windows';
};

export function TitleBar() {
  const [isVisible, setIsVisible] = useState(() => isTauri());
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMobilePlatform, setIsMobilePlatform] = useState(false);
  const [platform] = useState(getDesktopPlatform);
  const initialized = useRef(false);
  const navigate = useNavigate();
  
  // Detect mobile platform (Android/iOS) to hide titlebar
  useEffect(() => {
    const detectMobilePlatform = async () => {
      if (!isTauri()) return;
      
      try {
        const { platform: getPlatform } = await import('@tauri-apps/plugin-os');
        const os = await getPlatform();
        
        if (os === 'android' || os === 'ios') {
          setIsMobilePlatform(true);
          // Add mobile class to body for CSS safe area handling
          document.body.classList.add('is-mobile');
          document.body.classList.remove('has-titlebar');
        }
      } catch (e) {
        // Plugin not available or not in Tauri - ignore
        console.log('[TitleBar] OS detection failed:', e);
      }
    };
    
    detectMobilePlatform();
  }, []);
  
  // Add body class once on mount if in Tauri
  useEffect(() => {
    if (isVisible) {
      document.body.classList.add('has-titlebar');
    }
    return () => {
      document.body.classList.remove('has-titlebar');
    };
  }, [isVisible]);
  
  // Initialize Tauri window controls
  useEffect(() => {
    if (!isVisible || initialized.current) return;
    initialized.current = true;
    
    const initTauri = async () => {
      try {
        // Get Tauri APIs
        const tauriGlobal = (window as any).__TAURI__;
        if (!tauriGlobal) {
          console.log('[TitleBar] __TAURI__ not available yet');
          return;
        }

        // Get the current window
        const appWindow = tauriGlobal.window?.getCurrentWindow?.();
        if (!appWindow) {
          console.log('[TitleBar] Could not get current window');
          return;
        }

        console.log('[TitleBar] Window controls initialized');
        
        // Track maximized state
        const updateMaximizedState = async () => {
          try {
            setIsMaximized(await appWindow.isMaximized());
          } catch (e) {}
        };
        updateMaximizedState();

        const minimizeBtn = document.getElementById('titlebar-minimize');
        const maximizeBtn = document.getElementById('titlebar-maximize');
        const closeBtn = document.getElementById('titlebar-close');

        const handleMinimize = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          appWindow.minimize();
        };
        
        const handleMaximize = async (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            if (await appWindow.isMaximized()) {
              await appWindow.unmaximize();
              setIsMaximized(false);
            } else {
              await appWindow.maximize();
              setIsMaximized(true);
            }
          } catch (err) {
            console.error('[TitleBar] Maximize toggle failed', err);
          }
        };
        
        const handleClose = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          appWindow.close();
        };

        minimizeBtn?.addEventListener('click', handleMinimize);
        maximizeBtn?.addEventListener('click', handleMaximize);
        closeBtn?.addEventListener('click', handleClose);

        // Deep link listener for auth callbacks
        if (tauriGlobal.event?.listen) {
          tauriGlobal.event.listen('deep-link://new-url', async (event: any) => {
            let url = '';
            if (Array.isArray(event.payload) && event.payload.length > 0) {
              url = event.payload[0];
            } else if (typeof event.payload === 'string') {
              url = event.payload;
            }
            
            if (url && url.startsWith('zentrio://auth/callback')) {
              try {
                const urlObj = new URL(url);
                const authCode = urlObj.searchParams.get('auth_code');
                
                if (authCode) {
                  // Exchange secure authorization code for session
                  const res = await apiFetch('/api/auth/mobile-callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ authCode })
                  });
                  
                  if (res.ok) {
                    const data = await res.json();
                    
                    if (data.success && data.user) {
                      // Store session directly to localStorage (auth store's persist key)
                      // This bypasses the React state update which would trigger
                      // OnboardingWizard's auto-complete effect
                      const sessionData = {
                        state: {
                          user: data.user,
                          session: {
                            user: data.user,
                            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                            token: data.token
                          },
                          isAuthenticated: true,
                          isLoading: false,
                          error: null,
                          lastActivity: Date.now()
                        },
                        version: 0
                      };
                      localStorage.setItem('zentrio-auth-storage', JSON.stringify(sessionData));
                      
                      // Set app mode and navigate
                      localStorage.setItem('zentrio_app_mode', 'connected');
                      
                      // Check if we're on settings page (account linking) vs initial login
                      // For account linking, just reload to update the linked accounts list
                      const currentPath = window.location.pathname;
                      if (currentPath === '/settings') {
                        // Account linking - just reload to refresh linked accounts
                        window.location.reload();
                      } else {
                        // Initial login - navigate to profiles
                        window.location.href = '/profiles';
                      }
                      return;
                    }
                  } else {
                    console.error('[TitleBar] Auth code exchange failed');
                  }
                } else {
                  console.error('[TitleBar] No auth_code in callback URL');
                }
              } catch (err) {
                console.error('[TitleBar] Auth callback error', err);
              }
            }
          });
        }
      } catch (err) {
        console.error('[TitleBar] Failed to initialize titlebar controls', err);
      }
    };

    initTauri();
  }, [isVisible]);

  // Don't render anything if not in Tauri or on mobile platform
  if (!isVisible || isMobilePlatform) {
    return null;
  }

  const isMac = platform === 'macos';

  return (
    <>
      <div id="app-titlebar" className={`titlebar ${isMac ? 'titlebar-mac' : 'titlebar-win'}`}>
        {/* macOS: Controls on left, then drag region */}
        {isMac && (
          <div className="titlebar-controls titlebar-controls-mac">
            <div className="titlebar-button mac-close" id="titlebar-close" title="Close">
              <svg width="8" height="8" viewBox="0 0 8 8">
                <path d="M1 1L7 7M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="titlebar-button mac-minimize" id="titlebar-minimize" title="Minimize">
              <svg width="8" height="2" viewBox="0 0 8 2">
                <path d="M0 1H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="titlebar-button mac-maximize" id="titlebar-maximize" title={isMaximized ? "Restore" : "Maximize"}>
              <svg width="8" height="8" viewBox="0 0 8 8">
                {isMaximized ? (
                  <path d="M1 3L4 0.5L7 3L7 7.5H1V3Z" stroke="currentColor" fill="none" strokeWidth="1"/>
                ) : (
                  <path d="M0 4L4 0L8 4L8 8H0V4Z" stroke="currentColor" fill="none" strokeWidth="1"/>
                )}
              </svg>
            </div>
          </div>
        )}

        <div className="titlebar-drag-region" data-tauri-drag-region>
          <div className="titlebar-title">
            <span className="titlebar-app-name">Zentrio</span>
          </div>
        </div>

        {/* Windows/Linux: Controls on right */}
        {!isMac && (
          <div className="titlebar-controls titlebar-controls-win">
            <div className="titlebar-button win-minimize" id="titlebar-minimize" title="Minimize">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="titlebar-button win-maximize" id="titlebar-maximize" title={isMaximized ? "Restore" : "Maximize"}>
              <svg width="12" height="12" viewBox="0 0 12 12">
                {isMaximized ? (
                  <>
                    <rect x="3" y="1" width="8" height="8" rx="1" stroke="currentColor" fill="none" strokeWidth="1"/>
                    <rect x="1" y="3" width="8" height="8" rx="1" stroke="currentColor" fill="var(--glass-bg)" strokeWidth="1"/>
                  </>
                ) : (
                  <rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" fill="none" strokeWidth="1.5"/>
                )}
              </svg>
            </div>
            <div className="titlebar-button win-close" id="titlebar-close" title="Close">
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        /* =============================================================================
           Modern Glassmorphism Title Bar
           ============================================================================= */
        
        .titlebar {
          height: 32px;
          background: linear-gradient(to bottom, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.15) 60%, transparent 100%);
          user-select: none;
          display: flex;
          align-items: center;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 99999;
          transition: background 0.3s ease;
        }

        .titlebar:hover {
          background: linear-gradient(to bottom, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.2) 60%, transparent 100%);
        }

        /* Drag Region */
        .titlebar-drag-region {
          flex: 1;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          padding-left: 16px;
          -webkit-app-region: drag;
          app-region: drag;
        }

        /* Title */
        .titlebar-title {
          display: flex;
          align-items: center;
          gap: 6px;
          pointer-events: none;
        }

        .titlebar-app-name {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-muted, #888);
          font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
          letter-spacing: 0.02em;
          opacity: 0.7;
          transition: opacity var(--transition-normal, 0.2s ease);
        }

        .titlebar:hover .titlebar-app-name {
          opacity: 1;
        }

        /* Controls Container */
        .titlebar-controls {
          display: flex;
          -webkit-app-region: no-drag;
          app-region: no-drag;
          z-index: 100000;
        }

        /* =============================================================================
           Windows/Linux Style Controls
           ============================================================================= */
        
        .titlebar-controls-win {
          height: 100%;
        }

        .titlebar-win .titlebar-button {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          width: 46px;
          height: 32px;
          cursor: pointer;
          transition: background var(--transition-normal, 0.2s ease);
          color: var(--text-muted, #888);
        }

        .titlebar-win .titlebar-button:hover {
          color: var(--text, #fff);
        }

        .titlebar-win .win-minimize:hover,
        .titlebar-win .win-maximize:hover {
          background: var(--glass-bg-light, rgba(255, 255, 255, 0.1));
        }

        .titlebar-win .win-close:hover {
          background: #e81123;
          color: #fff;
        }

        /* =============================================================================
           macOS Style Controls (Traffic Lights)
           ============================================================================= */
        
        .titlebar-controls-mac {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-left: 12px;
          height: 100%;
        }

        .titlebar-mac .titlebar-button {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition-fast, 0.15s ease);
        }

        .titlebar-mac .titlebar-button svg {
          opacity: 0;
          transition: opacity var(--transition-fast, 0.15s ease);
        }

        .titlebar-mac:hover .titlebar-button svg {
          opacity: 1;
        }

        .titlebar-mac .mac-close {
          background: #ff5f57;
          color: #4d0000;
        }

        .titlebar-mac .mac-close:hover {
          background: #ff5f57;
        }

        .titlebar-mac .mac-minimize {
          background: #febc2e;
          color: #594d00;
        }

        .titlebar-mac .mac-minimize:hover {
          background: #febc2e;
        }

        .titlebar-mac .mac-maximize {
          background: #28c840;
          color: #004d00;
        }

        .titlebar-mac .mac-maximize:hover {
          background: #28c840;
        }

        /* Inactive state - grayed out buttons */
        .titlebar-mac .titlebar-button:not(:hover) {
          filter: saturate(0.7);
        }

        .titlebar-controls-mac:hover .titlebar-button {
          filter: saturate(1);
        }
      `}} />
    </>
  )
}