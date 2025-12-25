import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button, Input, ConfirmDialog } from '../index';
import { createAuthClient } from "better-auth/client";
import styles from '../../styles/Settings.module.css';
import { apiFetch } from '../../lib/apiFetch';
import { appMode } from '../../lib/app-mode';
import { isTauri } from '../../lib/auth-client';

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
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  // Check if in guest mode - cloud sync not available
  const isGuestMode = appMode.isGuest();

  useEffect(() => {
    if (isGuestMode) {
      setLoading(false);
      return;
    }
    loadSyncState();
    const interval = setInterval(loadSyncState, 5000);
    return () => clearInterval(interval);
  }, [isGuestMode]);

  async function loadSyncState() {
    try {
      const response = await apiFetch('/api/sync/status');
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
      // For Tauri, use the Tauri HTTP plugin which handles cookies properly
      // For web, use fetch with credentials
      let tokenResponse: Response;
      
      if (isTauri()) {
        // Use Tauri's HTTP plugin which handles cookies across origins
        const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
        tokenResponse = await tauriFetch(`${serverUrl}/api/sync/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else {
        // Web: use regular fetch with credentials
        tokenResponse = await fetch(`${serverUrl}/api/sync/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include'
        });
      }

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to generate sync token');
      }

      const { syncToken, userId } = await tokenResponse.json();

      if (!syncToken || !userId) {
        throw new Error('Invalid sync token response');
      }

      // Step 3: Configure local sync service
      const connectResponse = await apiFetch('/api/sync/connect', {
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
      toast.success('Connected', { description: 'Cloud sync is now enabled' });
    } catch (err: any) {
      setError(err.message);
      toast.error('Connection Failed', { description: err.message });
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      await apiFetch('/api/sync/disconnect', { method: 'POST' });
      setSyncState(null);
      toast.success('Disconnected', { description: 'Cloud sync has been disabled' });
    } catch (err) {
      console.error('Failed to disconnect:', err);
      toast.error('Disconnect Failed', { description: 'Failed to disconnect from cloud sync' });
    }
  }

  async function handleSyncNow() {
    const btn = document.getElementById('sync-now-btn') as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Syncing...';
    }

    try {
      await apiFetch('/api/sync/sync', { method: 'POST' });
      await loadSyncState();
      toast.success('Sync Complete', { description: 'Your data has been synchronized' });
    } catch (err) {
      console.error('Failed to sync:', err);
      toast.error('Sync Failed', { description: 'Failed to synchronize data' });
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Sync Now';
      }
    }
  }

  if (loading) {
    return <div className={styles.settingsCard}>Loading sync status...</div>;
  }

  // Guest mode: show upgrade option
  if (isGuestMode) {
    return (
      <div className={styles.settingsCard}>
        <h2 className={styles.sectionTitle}>Cloud Sync</h2>
        <div className={styles.settingItem} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
          <div className={styles.settingInfo}>
            <h3>Upgrade to Connected Mode</h3>
            <p>
              You're currently using Guest Mode. Cloud sync, multiple profiles, and cross-device synchronization 
              are available when connected to a Zentrio server.
            </p>
          </div>
          <Button 
            variant="primary" 
            onClick={() => {
              // Trigger upgrade flow
              appMode.upgradeToConnected();
              window.location.reload();
            }}
          >
            Upgrade to Connected Mode
          </Button>
        </div>
      </div>
    );
  }

  const isConnected = syncState && syncState.auth_token;

  return (
    <div className={styles.settingsCard}>
      <h2 className={styles.sectionTitle}>Cloud Sync</h2>

      {isConnected ? (
        <div className={styles.syncConnected}>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <h3>Connection Status</h3>
              <p>Connected to {syncState.remote_url}</p>
            </div>
            <div className={styles.settingControl}>
              <div className={`${styles.statusIndicator} ${syncState.is_syncing ? styles.statusIndicatorSyncing : styles.statusIndicatorConnected}`}></div>
              <span>{syncState.is_syncing ? 'Syncing...' : 'Connected'}</span>
            </div>
          </div>

          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <h3>Last Sync</h3>
              <p>{syncState.last_sync_at ? new Date(syncState.last_sync_at).toLocaleString() : 'Never'}</p>
            </div>
            <div className={styles.settingControl}>
              <Button id="sync-now-btn" variant="primary" onClick={handleSyncNow}>
                Sync Now
              </Button>
              <Button variant="danger" onClick={() => setShowDisconnectDialog(true)}>
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.syncDisconnected}>
          <div className={styles.settingItem} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className={styles.settingInfo}>
              <h3>Connect to Cloud Sync</h3>
              <p>Connect your account to sync your data across devices.</p>
            </div>
          </div>

          <form onSubmit={handleConnect} className={styles.syncForm}>
            <div className={styles.formGroup}>
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

            <div className={styles.formGroup}>
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

            <div className={styles.formGroup}>
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



      <ConfirmDialog
        isOpen={showDisconnectDialog}
        onClose={() => setShowDisconnectDialog(false)}
        onConfirm={handleDisconnect}
        title="Disconnect Cloud Sync"
        message="Are you sure you want to disconnect? This will stop synchronization."
        confirmText="Disconnect"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}