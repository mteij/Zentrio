import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../../lib/apiFetch';

// Helper to check if we're running in Tauri
const isTauri = () => {
  if (typeof window === 'undefined') return false;
  // Tauri 2.x uses __TAURI_INTERNALS__, but with withGlobalTauri: true also exposes __TAURI__
  return !!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__;
};

export function TitleBar() {
  const [isVisible, setIsVisible] = useState(() => isTauri());
  const initialized = useRef(false);
  
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
              appWindow.unmaximize();
            } else {
              appWindow.maximize();
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

        // Deep link listener
        if (tauriGlobal.event?.listen) {
          tauriGlobal.event.listen('deep-link://new-url', async (event: any) => {
            console.log('[TitleBar] Deep link received:', event.payload);
            
            let url = '';
            if (Array.isArray(event.payload) && event.payload.length > 0) {
              url = event.payload[0];
            } else if (typeof event.payload === 'string') {
              url = event.payload;
            }
            
            if (url && url.startsWith('zentrio://auth/callback')) {
              try {
                const urlObj = new URL(url);
                const sessionToken = urlObj.searchParams.get('session_token');
                
                const res = await apiFetch('/api/auth/mobile-callback', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url, sessionToken })
                });
                
                const data = await res.json();
                if (res.ok) {
                  window.location.href = '/profiles';
                } else {
                  console.error('[TitleBar] Auth callback failed', data);
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

  // Don't render anything if not in Tauri
  if (!isVisible) {
    return null;
  }

  return (
    <>
      <div id="app-titlebar" className="titlebar">
        <div className="titlebar-drag-region" data-tauri-drag-region>
          <div className="titlebar-title">Zentrio</div>
        </div>
        <div className="titlebar-controls">
          <div className="titlebar-button" id="titlebar-minimize">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
            </svg>
          </div>
          <div className="titlebar-button" id="titlebar-maximize">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          </div>
          <div className="titlebar-button titlebar-close" id="titlebar-close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .titlebar {
          height: 32px;
          background: #141414;
          user-select: none;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 99999;
          flex-shrink: 0;
        }
        .titlebar-drag-region {
          flex: 1;
          height: 100%;
          display: flex;
          align-items: center;
          padding-left: 16px;
          -webkit-app-region: drag;
        }
        .titlebar-title {
            font-size: 12px;
            color: #aaa;
            pointer-events: none;
            font-family: system-ui, -apple-system, sans-serif;
        }
        .titlebar-controls {
          display: flex;
          -webkit-app-region: no-drag;
          z-index: 100000;
        }
        .titlebar-button {
          display: inline-flex;
          justify-content: center;
          align-items: center;
          width: 46px;
          height: 32px;
          cursor: pointer;
          transition: background 0.2s;
          color: #fff;
        }
        .titlebar-button:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .titlebar-close:hover {
          background: #e81123;
        }
      `}} />
    </>
  )
}