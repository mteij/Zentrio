export function CloudSyncSettings() {
  return (
    <div id="cloud-sync-settings-container" className="settings-card">
      <h2 className="section-title">Cloud Sync</h2>
      
      <div id="sync-loading">Loading sync status...</div>
      
      {/* Connected State */}
      <div id="sync-connected" style={{ display: 'none' }}>
        <div className="setting-item">
          <div className="setting-info">
            <h3>Connection Status</h3>
            <p id="sync-connection-info">Connected to server</p>
          </div>
          <div className="setting-control">
            <span id="sync-status-indicator" className="status-indicator connected"></span>
            <span id="sync-status-text">Connected</span>
          </div>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <h3>Last Sync</h3>
            <p id="sync-last-time">Never</p>
          </div>
          <div className="setting-control">
            <button id="sync-now-btn" className="btn btn-primary">Sync Now</button>
            <button id="sync-disconnect-btn" className="btn btn-danger">Disconnect</button>
          </div>
        </div>
      </div>

      {/* Disconnected State */}
      <div id="sync-disconnected" style={{ display: 'none' }}>
        <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <div className="setting-info">
            <h3>Connect to Cloud Sync</h3>
            <p>Connect your account to sync your data across devices.</p>
          </div>
        </div>

        <form id="sync-connect-form" className="sync-form">
          <div className="form-group">
            <label htmlFor="sync-server-url">Server URL</label>
            <input
              type="url"
              id="sync-server-url"
              placeholder="https://zentrio.eu"
              defaultValue="https://zentrio.eu"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="sync-email">Email</label>
            <input
              type="email"
              id="sync-email"
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="sync-password">Password</label>
            <input
              type="password"
              id="sync-password"
              placeholder="••••••••"
              required
            />
          </div>

          <div id="sync-error" className="error-message" style={{ display: 'none' }}></div>

          <button type="submit" id="sync-connect-btn" className="btn btn-primary">
            Connect
          </button>
        </form>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            // Cloud Sync functionality
            let syncState = null;
            let syncInterval = null;
            let syncConfig = null;

            async function loadSyncConfig() {
              try {
                const response = await fetch('/api/sync/config');
                if (response.ok) {
                  syncConfig = await response.json();
                  
                  // Pre-fill server URL if configured
                  if (syncConfig.serverUrl && syncConfig.mode === 'cloud') {
                    const serverUrlInput = document.getElementById('sync-server-url');
                    if (serverUrlInput) {
                      serverUrlInput.value = syncConfig.serverUrl;
                    }
                  }
                }
              } catch (error) {
                console.error('Failed to load sync config:', error);
              }
            }

            async function loadSyncState() {
              try {
                const response = await fetch('/api/sync/status');
                if (response.ok) {
                  syncState = await response.json();
                  updateSyncUI();
                }
              } catch (error) {
                console.error('Failed to load sync state:', error);
                document.getElementById('sync-loading').style.display = 'none';
                document.getElementById('sync-disconnected').style.display = 'block';
              }
            }

            function updateSyncUI() {
              const loading = document.getElementById('sync-loading');
              const connected = document.getElementById('sync-connected');
              const disconnected = document.getElementById('sync-disconnected');

              loading.style.display = 'none';

              if (syncState && syncState.auth_token) {
                connected.style.display = 'block';
                disconnected.style.display = 'none';

                // Update connection info
                const connectionInfo = document.getElementById('sync-connection-info');
                connectionInfo.textContent = \`Connected to \${syncState.remote_url}\`;

                // Update status indicator
                const indicator = document.getElementById('sync-status-indicator');
                const statusText = document.getElementById('sync-status-text');
                
                if (syncState.is_syncing) {
                  indicator.className = 'status-indicator syncing';
                  statusText.textContent = 'Syncing...';
                } else {
                  indicator.className = 'status-indicator connected';
                  statusText.textContent = 'Connected';
                }

                // Update last sync time
                const lastTime = document.getElementById('sync-last-time');
                if (syncState.last_sync_at) {
                  lastTime.textContent = new Date(syncState.last_sync_at).toLocaleString();
                } else {
                  lastTime.textContent = 'Never';
                }
              } else {
                connected.style.display = 'none';
                disconnected.style.display = 'block';
              }
            }

            async function handleConnect(e) {
              e.preventDefault();
              
              const serverUrl = document.getElementById('sync-server-url').value;
              const email = document.getElementById('sync-email').value;
              const password = document.getElementById('sync-password').value;
              const connectBtn = document.getElementById('sync-connect-btn');
              const errorDiv = document.getElementById('sync-error');

              connectBtn.disabled = true;
              connectBtn.textContent = 'Connecting...';
              errorDiv.style.display = 'none';

              try {
                // Step 1: Sign in with Better Auth
                const authResponse = await fetch(\`\${serverUrl}/api/auth/sign-in/email\`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include', // Important for cookies
                  body: JSON.stringify({
                    email,
                    password,
                    rememberMe: true
                  })
                });

                if (!authResponse.ok) {
                  const errorData = await authResponse.json().catch(() => ({}));
                  throw new Error(errorData.message || 'Authentication failed');
                }

                // Step 2: Get a sync token for the Tauri client
                const tokenResponse = await fetch(\`\${serverUrl}/api/sync/token\`, {
                  method: 'POST',
                  credentials: 'include' // Include the session cookie
                });

                if (!tokenResponse.ok) {
                  throw new Error('Failed to generate sync token');
                }

                const tokenData = await tokenResponse.json();
                const syncToken = tokenData.syncToken;
                const userId = tokenData.userId || JSON.parse(atob(syncToken)).userId;

                if (!syncToken || !userId) {
                  throw new Error('Invalid sync token response');
                }

                // Step 3: Connect to local sync service with the token
                const connectResponse = await fetch('/api/sync/connect', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    remoteUrl: serverUrl,
                    token: syncToken, // Use the proper sync token
                    userId
                  })
                });

                if (connectResponse.ok) {
                  await loadSyncState();
                } else {
                  throw new Error('Failed to connect sync service');
                }
              } catch (error) {
                errorDiv.textContent = error.message;
                errorDiv.style.display = 'block';
              } finally {
                connectBtn.disabled = false;
                connectBtn.textContent = 'Connect';
              }
            }

            async function handleDisconnect() {
              if (!confirm('Are you sure you want to disconnect? This will stop synchronization.')) {
                return;
              }

              try {
                const response = await fetch('/api/sync/disconnect', { method: 'POST' });
                if (response.ok) {
                  syncState = null;
                  updateSyncUI();
                  
                  // Clear form
                  document.getElementById('sync-email').value = '';
                  document.getElementById('sync-password').value = '';
                }
              } catch (error) {
                console.error('Failed to disconnect:', error);
              }
            }

            async function handleSyncNow() {
              const syncBtn = document.getElementById('sync-now-btn');
              syncBtn.disabled = true;
              syncBtn.textContent = 'Syncing...';

              try {
                const response = await fetch('/api/sync/sync', { method: 'POST' });
                if (response.ok) {
                  await loadSyncState();
                }
              } catch (error) {
                console.error('Failed to sync:', error);
              } finally {
                syncBtn.disabled = false;
                syncBtn.textContent = 'Sync Now';
              }
            }

            // Initialize
            document.addEventListener('DOMContentLoaded', () => {
              // Load configuration first
              loadSyncConfig().then(() => {
                // Load sync state
                loadSyncState();
              });
              
              // Set up polling
              syncInterval = setInterval(loadSyncState, 5000);

              // Event listeners
              document.getElementById('sync-connect-form').addEventListener('submit', handleConnect);
              document.getElementById('sync-disconnect-btn').addEventListener('click', handleDisconnect);
              document.getElementById('sync-now-btn').addEventListener('click', handleSyncNow);
            });

            // Cleanup on page unload
            window.addEventListener('beforeunload', () => {
              if (syncInterval) {
                clearInterval(syncInterval);
              }
            });
          `,
        }}
      />

      <style>{`
        .status-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 8px;
        }

        .status-indicator.connected {
          background-color: #10b981;
        }

        .status-indicator.syncing {
          background-color: #f59e0b;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .sync-form {
          max-width: 400px;
          margin-top: 20px;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          color: #b3b3b3;
          font-size: 14px;
        }

        .form-group input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #555;
          border-radius: 4px;
          background: #333;
          color: white;
          font-size: 14px;
        }

        .form-group input:focus {
          outline: none;
          border-color: var(--accent, #e50914);
        }

        .error-message {
          color: #ef4444;
          font-size: 14px;
          margin-top: 10px;
          padding: 8px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 4px;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: var(--accent, #e50914);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: var(--btn-primary-bg-hover, #f40612);
        }

        .btn-danger {
          background: #dc3545;
          color: white;
        }

        .btn-danger:hover:not(:disabled) {
          background: #c82333;
        }
      `}</style>
    </div>
  );
}