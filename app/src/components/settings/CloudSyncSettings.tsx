import { useState, useEffect } from 'react';
import { Button } from '../Button';
import { Input } from '../Input';
import { createAuthClient } from "better-auth/client";

interface SyncState {
  id: number;
  remote_url: string;
  remote_user_id: string;
  auth_token: string;
  last_sync_at: string | null;
  is_syncing: boolean;
}

export function CloudSyncSettings() {
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState('https://app.zentrio.eu');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    loadSyncState();
    const interval = setInterval(loadSyncState, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadSyncState() {
    try {
      const response = await fetch('/api/sync/status');
      if (response.ok) {
        const data = await response.json();
        setSyncState(data);
        if (data?.remote_url) {
          setServerUrl(data.remote_url);
        }
      }
    } catch (err) {
      console.error('Failed to load sync state:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(e: any) {
    e.preventDefault();
    setConnecting(true);
    setError(null);

    try {
      // Step 1: Authenticate with the remote server
      // We use the auth client but point it to the remote server
      const remoteAuth = createAuthClient({
        baseURL: serverUrl
      });

      const { data: signInData, error: signInError } = await remoteAuth.signIn.email({
        email,
        password,
      });

      if (signInError) {
        throw new Error(signInError.message || 'Authentication failed');
      }

      // Step 2: Get a sync token from the remote server
      // We need to make an authenticated request to the remote server
      // The auth client handles the session cookie/token
      const tokenResponse = await fetch(`${serverUrl}/api/sync/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Important: include credentials to send the session cookie we just got
        credentials: 'include' 
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to generate sync token');
      }

      const { syncToken, userId } = await tokenResponse.json();

      if (!syncToken || !userId) {
        throw new Error('Invalid sync token response');
      }

      // Step 3: Configure local sync service
      const connectResponse = await fetch('/api/sync/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remoteUrl: serverUrl,
          token: syncToken,
          userId
        })
      });

      if (!connectResponse.ok) {
        throw new Error('Failed to configure local sync service');
      }

      await loadSyncState();
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect? This will stop synchronization.')) {
      return;
    }

    try {
      await fetch('/api/sync/disconnect', { method: 'POST' });
      setSyncState(null);
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  }

  async function handleSyncNow() {
    const btn = document.getElementById('sync-now-btn') as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Syncing...';
    }

    try {
      await fetch('/api/sync/sync', { method: 'POST' });
      await loadSyncState();
    } catch (err) {
      console.error('Failed to sync:', err);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Sync Now';
      }
    }
  }

  if (loading) {
    return <div className="settings-card">Loading sync status...</div>;
  }

  const isConnected = syncState && syncState.auth_token;

  return (
    <div className="settings-card">
      <h2 className="section-title">Cloud Sync</h2>

      {isConnected ? (
        <div className="sync-connected">
          <div className="setting-item">
            <div className="setting-info">
              <h3>Connection Status</h3>
              <p>Connected to {syncState.remote_url}</p>
            </div>
            <div className="setting-control">
              <div className={`status-indicator ${syncState.is_syncing ? 'syncing' : 'connected'}`}></div>
              <span>{syncState.is_syncing ? 'Syncing...' : 'Connected'}</span>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h3>Last Sync</h3>
              <p>{syncState.last_sync_at ? new Date(syncState.last_sync_at).toLocaleString() : 'Never'}</p>
            </div>
            <div className="setting-control">
              <Button id="sync-now-btn" variant="primary" onClick={handleSyncNow}>
                Sync Now
              </Button>
              <Button variant="danger" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="sync-disconnected">
          <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className="setting-info">
              <h3>Connect to Cloud Sync</h3>
              <p>Connect your account to sync your data across devices.</p>
            </div>
          </div>

          <form onSubmit={handleConnect} className="sync-form">
            <div className="form-group">
              <label htmlFor="sync-server-url">Server URL</label>
              <Input
                type="text"
                id="sync-server-url"
                value={serverUrl}
                onChange={(e: any) => setServerUrl(e.target.value)}
                placeholder="https://app.zentrio.eu"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="sync-email">Email</label>
              <Input
                type="email"
                id="sync-email"
                value={email}
                onChange={(e: any) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="sync-password">Password</label>
              <Input
                type="password"
                id="sync-password"
                value={password}
                onChange={(e: any) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="error-message" style={{ color: '#ef4444', marginBottom: '15px' }}>
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" disabled={connecting}>
              {connecting ? 'Connecting...' : 'Connect'}
            </Button>
          </form>
        </div>
      )}

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
      `}</style>
    </div>
  );
}