import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../index'
import { authClient, getClientUrl } from '../../lib/auth-client'
import { apiFetch } from '../../lib/apiFetch'
import { appMode } from '../../lib/app-mode'

import { TwoFactorSetupModal } from '../auth/TwoFactorSetupModal'
import { ServerConnectionIndicator } from '../auth/ServerConnectionIndicator'
import { LoginBehaviorSettings } from './LoginBehaviorSettings'
import { TmdbSettings } from './TmdbSettings'
import { LinkedAccountsSettings } from './LinkedAccountsSettings'
import { UsernameModal } from './modals/UsernameModal'
import { EmailModal } from './modals/EmailModal'
import { PasswordModal } from './modals/PasswordModal'
import { UpdateSettings } from './UpdateSettings'
import styles from '../../styles/Settings.module.css'

// Error message mappings for account linking errors
const LINKING_ERROR_MESSAGES: Record<string, string> = {
  'account_already_linked_to_different_user': 'This account is already linked to a different user.',
  'account_already_linked': 'This account is already linked to your profile.',
  'invalid_state': 'Authentication session expired. Please try again.',
  'access_denied': 'Access was denied. Please try again.',
}

export function GeneralSettings() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Check if in guest mode
  const isGuestMode = appMode.isGuest()
  
  // Modals state
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showTwoFactorSetupModal, setShowTwoFactorSetupModal] = useState(false)

  // Form state
  const [tmdbApiKey, setTmdbApiKey] = useState('')
  const [tmdbKeyConfigured, setTmdbKeyConfigured] = useState(false)

  // Account linking state
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)
  const [linkedAccounts, setLinkedAccounts] = useState<{providerId: string, createdAt?: string}[]>([])
  const [availableProviders, setAvailableProviders] = useState<Record<string, boolean>>({})
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null)
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null)

  // Check for linking errors from URL params
  useEffect(() => {
    const errorCode = searchParams.get('error')
    if (errorCode) {
      const message = LINKING_ERROR_MESSAGES[errorCode] || `Account linking failed: ${errorCode.replace(/_/g, ' ')}`
      toast.error('Link Failed', { description: message })
      // Clear the error from URL
      searchParams.delete('error')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (isGuestMode) {
      setLoading(false)
      return
    }
    loadProfile()
    loadTmdbApiKey()
    loadAvailableProviders()
   }, [isGuestMode])

  const loadAvailableProviders = async () => {
    try {
      const res = await apiFetch('/api/auth/providers')
      if (res.ok) {
        const data = await res.json()
        setAvailableProviders(data)
      }
    } catch (e) {
      console.error('Failed to load providers:', e)
    }
  }

  const loadProfile = async () => {
    try {
      const res = await apiFetch('/api/user/profile')
      if (res.ok) {
        const data = await res.json()
        const profileData = data.data || data
        setProfile(profileData)
        setHasPassword(profileData.hasPassword ?? true)
        setLinkedAccounts(profileData.linkedAccounts ?? [])
      } else {
        // If profile load fails, we might be logged out or server is down
        // Don't auto-redirect here to avoid loops, just show error state
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadTmdbApiKey = async () => {
    try {
      const res = await apiFetch('/api/user/tmdb-api-key')
      if (res.ok) {
        const data = await res.json()
        if (data.data?.tmdb_api_key) {
            setTmdbApiKey(data.data.tmdb_api_key)
            setTmdbKeyConfigured(true)
        } else {
            setTmdbKeyConfigured(false)
        }
      }
    } catch (e) {
      console.error('Failed to load TMDB API key', e)
    }
  }

  const handleUpdateTmdbApiKey = async (clearKey?: boolean, keyValue?: string) => {
    const keyToSave = clearKey ? '' : (keyValue ?? tmdbApiKey)
    try {
        const res = await apiFetch('/api/user/tmdb-api-key', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ tmdb_api_key: keyToSave })
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
            if (clearKey) {
                setTmdbApiKey('')
                setTmdbKeyConfigured(false)
                toast.success('Success', { description: 'Personal API key removed' })
            } else {
                setTmdbApiKey(keyToSave)
                setTmdbKeyConfigured(!!keyToSave)
                toast.success('Success', { description: 'TMDB API Key updated successfully' })
            }
        } else {
            const message = data.message || 'Failed to update TMDB API Key'
            toast.error('Update Failed', { description: message })
        }
    } catch (e) {
        console.error(e)
        toast.error('Network Error', { description: 'Failed to update TMDB API Key' })
    }
  }

  // Handler for linking SSO providers
  const handleLinkProvider = async (provider: string) => {
    setLinkingProvider(provider)
    try {
      // In Tauri, we need to use the system browser for OAuth, just like login
      // The callback will go through native-redirect and deep link back
      if ((window as any).__TAURI__) {
        const { openUrl } = await import('@tauri-apps/plugin-opener')
        const serverUrl = localStorage.getItem('zentrio_server_url') || 'https://app.zentrio.eu'
        
        // First, get a link code from the server (this authenticates the browser session)
        const codeRes = await apiFetch('/api/auth/link-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        
        if (!codeRes.ok) {
          throw new Error('Failed to generate link code')
        }
        
        const { linkCode } = await codeRes.json()
        
        if (!linkCode) {
          throw new Error('No link code received')
        }
        
        // Use link-proxy with the linkCode to establish browser session
        const linkUrl = `${serverUrl}/api/auth/link-proxy?provider=${provider}&linkCode=${linkCode}&callbackURL=${encodeURIComponent(serverUrl + '/api/auth/native-redirect')}`
        await openUrl(linkUrl)
        
        // Show a toast explaining the flow
        toast.info('Continue in Browser', { 
          description: 'Complete the linking process in your browser. The app will update automatically.',
          duration: 5000
        })
        
        setLinkingProvider(null)
      } else {
        // Web: use authClient.linkSocial directly
        await authClient.linkSocial({
          provider: provider as any,
          callbackURL: getClientUrl() + '/settings'
        })
      }
    } catch (e: any) {
      toast.error('Link Failed', { description: e.message || 'Failed to link account' })
      setLinkingProvider(null)
    }
  }

  // Handler for unlinking SSO providers
  const handleUnlinkProvider = async (provider: string) => {
    // Show confirmation
    const providerName = getProviderDisplayName(provider)
    if (!confirm(`Are you sure you want to unlink ${providerName}? You won't be able to sign in with this account anymore.`)) {
      return
    }
    
    setUnlinkingProvider(provider)
    try {
      const res = await apiFetch(`/api/user/accounts/${provider}`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        }
      })
      
      if (res.ok) {
        toast.success('Account Unlinked', { description: `${providerName} has been unlinked from your account.` })
        loadProfile() // Refresh linked accounts
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error('Unlink Failed', { description: data.message || 'Failed to unlink account' })
      }
    } catch (e: any) {
      toast.error('Unlink Failed', { description: e.message || 'Failed to unlink account' })
    } finally {
      setUnlinkingProvider(null)
    }
  }

  // Get provider display name
  const getProviderDisplayName = (providerId: string): string => {
    if (providerId === 'oidc') {
      return typeof availableProviders.oidcName === 'string' ? availableProviders.oidcName : 'OpenID'
    }
    const names: Record<string, string> = {
      'credential': 'Email & Password',
      'google': 'Google',
      'github': 'GitHub',
      'discord': 'Discord'
    }
    return names[providerId] || providerId
  }

  return (
    <div className={styles.tabContent}>
        {/* Update / Version Info at the top */}
        <div className="mb-8">
            <UpdateSettings />
        </div>

        <div className={styles.settingsCard}>
            <h2 className={styles.sectionTitle}>Account</h2>
            
            {/* Auth-only sections - hidden in guest mode */}
            {!isGuestMode ? (
            <>
            <div className="flex flex-col md:flex-row md:items-center justify-between py-6 gap-4 border-b border-white/5 last:border-0">
            <div className="flex-1 pr-4">
                <h3 className="text-lg font-medium text-white mb-1">Username</h3>
                <p className="text-sm text-zinc-400">Change your account username</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
                <span className="text-zinc-300 font-medium">{profile?.username || 'Loading...'}</span>
                <Button variant="secondary" onClick={() => setShowUsernameModal(true)}>
                Change
                </Button>
            </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between py-6 gap-4 border-b border-white/5 last:border-0">
            <div className="flex-1 pr-4">
                <h3 className="text-lg font-medium text-white mb-1">Email Address</h3>
                <p className="text-sm text-zinc-400">Change your account email address</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
                <span className="text-zinc-300 font-medium">{profile?.email || 'Loading...'}</span>
                <Button variant="secondary" onClick={() => setShowEmailModal(true)}>
                Change
                </Button>
            </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between py-6 gap-4 border-b border-white/5 last:border-0">
            <div className="flex-1 pr-4">
                <h3 className="text-lg font-medium text-white mb-1">
                {hasPassword ? 'Password' : 'Set Password'}
                </h3>
                <p className="text-sm text-zinc-400">
                {hasPassword 
                    ? 'Update your account password' 
                    : 'Add a password to sign in with email'}
                </p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
                <Button variant="secondary" onClick={() => setShowPasswordModal(true)}>
                {hasPassword ? 'Change Password' : 'Set Password'}
                </Button>
            </div>
            </div>


            {/* Linked Accounts */}
            <LinkedAccountsSettings
            linkedAccounts={linkedAccounts}
            availableProviders={availableProviders}
            hasPassword={hasPassword}
            linkingProvider={linkingProvider}
            unlinkingProvider={unlinkingProvider}
            onLink={handleLinkProvider}
            onUnlink={handleUnlinkProvider}
            />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between py-6 gap-4 border-b border-white/5 last:border-0">
            <div className="flex-1 pr-4">
                <h3 className="text-lg font-medium text-white mb-1">Two-Factor Authentication</h3>
                <p className="text-sm text-zinc-400">
                {hasPassword 
                    ? 'Add an extra layer of security to your account' 
                    : 'Set a password first to enable two-factor authentication'}
                </p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
                {profile?.twoFactorEnabled && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                    <Check className="w-3 h-3" />
                    Enabled
                </span>
                )}
                <Button 
                variant="secondary" 
                onClick={() => setShowTwoFactorSetupModal(true)}
                disabled={!hasPassword}
                >
                {hasPassword ? (profile?.twoFactorEnabled ? 'Configure' : 'Enable') : 'Requires Password'}
                </Button>
            </div>
            </div>
            </>
            ) : null}

            {/* Login Behavior Setting - visible in both modes */}
            <LoginBehaviorSettings />

            {/* TMDB API Key - visible in both modes */}
            <TmdbSettings
            apiKey={tmdbApiKey}
            isConfigured={tmdbKeyConfigured}
            onUpdate={handleUpdateTmdbApiKey}
            />

            {/* Server Connection - only shown in Tauri/mobile apps */}
            <ServerConnectionIndicator variant="card" />
        </div>

        {/* Modals */}
        <UsernameModal 
            isOpen={showUsernameModal} 
            onClose={() => setShowUsernameModal(false)} 
            onSuccess={loadProfile} 
        />

        <EmailModal 
            isOpen={showEmailModal} 
            onClose={() => setShowEmailModal(false)} 
            onSuccess={() => {
                // Email change initiated - verification link sent
            }} 
        />

        <PasswordModal 
            isOpen={showPasswordModal} 
            onClose={() => setShowPasswordModal(false)} 
            hasPassword={hasPassword ?? false}
            onSuccess={() => {
                if (!hasPassword) setHasPassword(true)
            }}
        />

        {showTwoFactorSetupModal && (
            <TwoFactorSetupModal 
                onClose={() => setShowTwoFactorSetupModal(false)}
                onSuccess={() => {
                    setShowTwoFactorSetupModal(false);
                    loadProfile();
                    toast.success('Success', { description: 'Two-Factor Authentication Enabled!' });
                }}
                hasPassword={hasPassword ?? true}
            />
        )}
    </div>
  )
}
