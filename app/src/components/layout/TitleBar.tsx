export function TitleBar() {
  const script = `
    (function() {
      // Only run if in Tauri
      if (!window.__TAURI__) return;
      
      const titlebar = document.getElementById('app-titlebar');
      if (titlebar) {
        titlebar.style.display = 'flex';
        document.body.classList.add('has-titlebar');
      }

      try {
        const appWindow = window.__TAURI__.window.getCurrentWindow();

        document.getElementById('titlebar-minimize')?.addEventListener('click', () => appWindow.minimize());
        document.getElementById('titlebar-maximize')?.addEventListener('click', async () => {
          try {
            if (await appWindow.isMaximized()) {
              appWindow.unmaximize();
            } else {
              appWindow.maximize();
            }
          } catch (e) {
            console.error('Maximize toggle failed', e);
          }
        });
        document.getElementById('titlebar-close')?.addEventListener('click', () => appWindow.close());
      } catch (e) {
        console.error('Failed to initialize titlebar controls', e);
      }
      // Deep link listener
      if (window.__TAURI__) {
        // Listen for deep links
        // The event name is 'deep-link://new-url' as per tauri-plugin-deep-link documentation
        // But we should also check if the payload is an array or string
        window.__TAURI__.event.listen('deep-link://new-url', async (event) => {
          console.log('Deep link received:', event.payload);
          
          let url = '';
          if (Array.isArray(event.payload) && event.payload.length > 0) {
            url = event.payload[0];
          } else if (typeof event.payload === 'string') {
            url = event.payload;
          }
          
          if (url && url.startsWith('zentrio://auth/callback')) {
             // Handle auth callback
             try {
               // Extract session token from URL if present
               const urlObj = new URL(url);
               const sessionToken = urlObj.searchParams.get('session_token');
               
               if (sessionToken) {
                   // Manually set the cookie
                   // Note: This might not work if HttpOnly is required, but for Tauri it might be fine
                   // Or we can use a special endpoint to set the cookie
                   
                   // Better approach: Send the token to the backend to verify and set the cookie
                   const res = await fetch('/api/auth/mobile-callback', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ url, sessionToken })
                   });
                   
                   const data = await res.json();
                   if (res.ok) {
                     // Reload to pick up the session
                     window.location.href = '/profiles';
                   } else {
                     console.error('Auth callback failed', data);
                     if (window.addToast) window.addToast('error', 'Login Failed', data.error || 'Authentication failed');
                   }
               } else {
                   // Fallback to existing flow (might fail due to cookie mismatch)
                   const res = await fetch('/api/auth/mobile-callback', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ url })
                   });
                   const data = await res.json();
                   if (res.ok) {
                     window.location.href = '/profiles';
                   } else {
                     console.error('Auth callback failed', data);
                     if (window.addToast) window.addToast('error', 'Login Failed', data.error || 'Authentication failed');
                   }
               }
             } catch (e) {
               console.error('Auth callback error', e);
               if (window.addToast) window.addToast('error', 'Login Error', 'Network error during authentication');
             }
          }
        });
      }
    })();
  `;

  return (
    <>
      <div id="app-titlebar" className="titlebar" style={{ display: 'none' }}>
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
        
        body.has-titlebar {
          padding-top: 32px;
        }
        
        /* Adjust layout when titlebar is present */
        body.has-titlebar .header {
          top: 32px;
        }
      `}} />
      <script dangerouslySetInnerHTML={{__html: script}} />
    </>
  )
}