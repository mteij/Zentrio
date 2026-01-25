import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { User, Palette, Puzzle, Play, AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { SimpleLayout, Button, Modal, FormGroup, Input, ModalWithFooter, AnimatedBackground } from '../components/index'
import { authClient, getClientUrl } from '../lib/auth-client'
import { apiFetch } from '../lib/apiFetch'
import { appMode } from '../lib/app-mode'

import { TwoFactorSetupModal } from '../components/auth/TwoFactorSetupModal'
import { ServerConnectionIndicator } from '../components/auth/ServerConnectionIndicator'
import { AppearanceSettings } from '../components/settings/AppearanceSettings'
import { StreamingSettings } from '../components/settings/StreamingSettings'
import { DangerZoneSettings } from '../components/settings/DangerZoneSettings'
import { AddonManager } from '../components/settings/AddonManager'
import { LoginBehaviorSettings } from '../components/settings/LoginBehaviorSettings'
import { TmdbSettings } from '../components/settings/TmdbSettings'
import { LinkedAccountsSettings } from '../components/settings/LinkedAccountsSettings'
import styles from '../styles/Settings.module.css'

// Error message mappings for account linking errors
const LINKING_ERROR_MESSAGES: Record<string, string> = {
  'account_already_linked_to_different_user': 'This account is already linked to a different user.',
  'account_already_linked': 'This account is already linked to your profile.',
  'invalid_state': 'Authentication session expired. Please try again.',
  'access_denied': 'Access was denied. Please try again.',
}



export function SettingsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('account')
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Check if in guest mode
  const isGuestMode = appMode.isGuest()
  
  // Modals state
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showOTPModal, setShowOTPModal] = useState(false)
  const [showTwoFactorSetupModal, setShowTwoFactorSetupModal] = useState(false)
  
  // Form state
  const [newUsername, setNewUsername] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [tmdbApiKey, setTmdbApiKey] = useState('')
  const [tmdbKeyConfigured, setTmdbKeyConfigured] = useState(false)

  
  // Account linking state
  const [hasPassword, setHasPassword] = useState<boolean | null>(null)
  const [linkedAccounts, setLinkedAccounts] = useState<{providerId: string, createdAt?: string}[]>([])
  const [availableProviders, setAvailableProviders] = useState<Record<string, boolean>>({})
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null)
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null)

  // Scroll indicators state
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)

  const checkScroll = () => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
    }
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [])

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
    // In guest mode, skip account-related API calls and default to appearance tab
    if (isGuestMode) {
      setLoading(false)
      setActiveTab('appearance')
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
        navigate('/')
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

  const handleUpdateUsername = async () => {
    try {
        const res = await apiFetch('/api/user/username', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ username: newUsername })
        })
        if (res.ok) {
            loadProfile()
            setShowUsernameModal(false)
        } else {
            toast.error('Update Failed', { description: 'Failed to update username' })
        }
    } catch (e) {
        console.error(e)
    }
  }

  const handleInitiateEmailChange = async () => {
    try {
        const res = await apiFetch('/api/user/email/initiate', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ newEmail })
        })
        if (res.ok) {
            setShowEmailModal(false)
            setShowOTPModal(true)
        } else {
            toast.error('Email Change Failed', { description: 'Failed to initiate email change' })
        }
    } catch (e) {
        console.error(e)
    }
  }

  const handleVerifyEmail = async () => {
    try {
        const res = await apiFetch('/api/user/email/verify', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ newEmail, code: otpCode })
        })
        if (res.ok) {
            loadProfile()
            setShowOTPModal(false)
            toast.success('Success', { description: 'Email updated successfully' })
        } else {
            toast.error('Verification Failed', { description: 'Invalid code' })
        }
    } catch (e) {
        console.error(e)
    }
  }

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
        toast.warning('Validation Error', { description: 'Passwords do not match' })
        return
    }
    try {
        const res = await apiFetch('/api/user/password', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ oldPassword: currentPassword, newPassword })
        })
        if (res.ok) {
            setShowPasswordModal(false)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            toast.success('Success', { description: 'Password updated successfully' })
        } else {
            toast.error('Update Failed', { description: 'Failed to update password' })
        }
    } catch (e) {
        console.error(e)
    }
  }

  // Handler for SSO-only accounts setting their first password
  const handleSetupPassword = async () => {
    if (newPassword !== confirmPassword) {
        toast.warning('Validation Error', { description: 'Passwords do not match' })
        return
    }
    if (newPassword.length < 8) {
        toast.warning('Validation Error', { description: 'Password must be at least 8 characters' })
        return
    }
    try {
        const res = await apiFetch('/api/user/password/setup', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ password: newPassword })
        })
        if (res.ok) {
            setShowPasswordModal(false)
            setNewPassword('')
            setConfirmPassword('')
            setHasPassword(true)
            toast.success('Success', { description: 'Password set successfully' })
        } else {
            const data = await res.json().catch(() => ({}))
            toast.error('Setup Failed', { description: data.message || 'Failed to set password' })
        }
    } catch (e) {
        console.error(e)
        toast.error('Error', { description: 'Failed to set password' })
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
    <SimpleLayout title="Settings">
      <AnimatedBackground />
      <div className={styles.container} style={{ position: 'relative', zIndex: 1, paddingTop: '80px' }}>
        <button
          className={styles.backBtn}
          onClick={() => navigate('/profiles')}
        >
          <ArrowLeft size={18} />
          Back to Profiles
        </button>

        {/* Tabs Navigation */}
        <div className={styles.settingsTabsWrapper}>
           {canScrollLeft && (
             <div className={`${styles.scrollIndicator} ${styles.scrollIndicatorLeft}`}>
               <ChevronLeft size={16} className={styles.indicatorIcon} />
             </div>
           )}
           <div 
             className={styles.settingsTabs} 
             ref={tabsRef}
             onScroll={checkScroll}
           >
              <button className={`${styles.tabBtn} ${activeTab === 'account' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('account')}>
                <User size={16} />
                Account
              </button>
              <button className={`${styles.tabBtn} ${activeTab === 'appearance' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('appearance')}>
                <Palette size={16} />
                Appearance
              </button>
              <button className={`${styles.tabBtn} ${activeTab === 'addons' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('addons')}>
                <Puzzle size={16} />
                Addons
              </button>
              <button className={`${styles.tabBtn} ${activeTab === 'streaming' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('streaming')}>
                <Play size={16} />
                Streaming
              </button>
              {!isGuestMode && (
              <button className={`${styles.tabBtn} ${activeTab === 'danger' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('danger')}>
                <AlertTriangle size={16} />
                Danger Zone
              </button>
              )}
           </div>
           {canScrollRight && (
             <div className={`${styles.scrollIndicator} ${styles.scrollIndicatorRight}`}>
               <ChevronRight size={16} className={styles.indicatorIcon} />
             </div>
           )}
        </div>

        {/* Account Tab */}
        {activeTab === 'account' && (
          <div className={styles.tabContent}>
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
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center border-b border-white/5">
                  <User size={32} className="text-zinc-500 mb-3" />
                  <p className="text-sm text-zinc-400 max-w-md">
                    Account settings (username, email, password, 2FA) require signing in. Other settings are available below.
                  </p>
                </div>
              )}

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
          </div>
        )}

        {/* Addons Tab */}
        {activeTab === 'addons' && <AddonManager />}

        {/* Other tabs placeholders */}
        {activeTab === 'appearance' && <AppearanceSettings />}
        {activeTab === 'streaming' && <StreamingSettings />}
        {activeTab === 'danger' && <DangerZoneSettings />}

      </div>

      {/* Modals */}
      {showUsernameModal && (
        <ModalWithFooter
            id="usernameModal"
            title="Change Username"
            isOpen={showUsernameModal}
            onClose={() => setShowUsernameModal(false)}
            footer={
                <>
                    <Button variant="secondary" onClick={() => setShowUsernameModal(false)}>Cancel</Button>
                    <Button variant="primary" onClick={handleUpdateUsername}>Update</Button>
                </>
            }
        >
            <FormGroup label="New Username">
                <Input 
                    type="text" 
                    value={newUsername} 
                    onChange={(e) => setNewUsername(e.target.value)} 
                    className="!w-full !bg-zinc-900 !border !border-zinc-700 !rounded-lg !px-3 !py-2 !text-white focus:outline-none focus:border-red-500 transition-colors"
                />
            </FormGroup>
        </ModalWithFooter>
      )}

      {showEmailModal && (
        <ModalWithFooter
            id="emailModal"
            title="Change Email"
            isOpen={showEmailModal}
            onClose={() => setShowEmailModal(false)}
            footer={
                <>
                    <Button variant="secondary" onClick={() => setShowEmailModal(false)}>Cancel</Button>
                    <Button variant="primary" onClick={handleInitiateEmailChange}>Continue</Button>
                </>
            }
        >
            <FormGroup label="New Email">
                <Input 
                    type="email" 
                    value={newEmail} 
                    onChange={(e) => setNewEmail(e.target.value)} 
                    className="!w-full !bg-zinc-900 !border !border-zinc-700 !rounded-lg !px-3 !py-2 !text-white focus:outline-none focus:border-red-500 transition-colors"
                />
            </FormGroup>
        </ModalWithFooter>
      )}

      {showOTPModal && (
        <Modal id="otpModal" title="Verify Email" isOpen={showOTPModal} onClose={() => setShowOTPModal(false)}>
            <div className={styles.otpContainer}>
                <p>Enter the code sent to {newEmail}</p>
                <Input 
                    type="text" 
                    value={otpCode} 
                    onChange={(e) => setOtpCode(e.target.value)} 
                    placeholder="Code" 
                    className="!w-full !bg-zinc-900 !border !border-zinc-700 !rounded-lg !px-3 !py-2 !text-white focus:outline-none focus:border-red-500 transition-colors"
                />
                <Button variant="primary" onClick={handleVerifyEmail} style={{ marginTop: '10px' }}>Verify</Button>
            </div>
        </Modal>
      )}

      {showPasswordModal && (
        <ModalWithFooter
            id="passwordModal"
            title={hasPassword ? "Change Password" : "Set Password"}
            isOpen={showPasswordModal}
            onClose={() => { 
              setShowPasswordModal(false)
              setCurrentPassword('')
              setNewPassword('')
              setConfirmPassword('')
            }}
            footer={
                <>
                    <Button variant="secondary" onClick={() => { 
                      setShowPasswordModal(false)
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                    }}>Cancel</Button>
                    <Button variant="primary" onClick={hasPassword ? handleUpdatePassword : handleSetupPassword}>
                      {hasPassword ? 'Update' : 'Set Password'}
                    </Button>
                </>
            }
        >
            {hasPassword && (
              <FormGroup label="Current Password">
                  <Input 
                      type="password" 
                      value={currentPassword} 
                      onChange={(e) => setCurrentPassword(e.target.value)} 
                      className="!w-full !bg-zinc-900 !border !border-zinc-700 !rounded-lg !px-3 !py-2 !text-white focus:outline-none focus:border-red-500 transition-colors"
                  />
              </FormGroup>
            )}
            <FormGroup label="New Password">
                <Input 
                    type="password" 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    placeholder={hasPassword ? undefined : "At least 8 characters"}
                    className="!w-full !bg-zinc-900 !border !border-zinc-700 !rounded-lg !px-3 !py-2 !text-white focus:outline-none focus:border-red-500 transition-colors"
                />
            </FormGroup>
            <FormGroup label="Confirm Password">
                <Input 
                    type="password" 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    className="!w-full !bg-zinc-900 !border !border-zinc-700 !rounded-lg !px-3 !py-2 !text-white focus:outline-none focus:border-red-500 transition-colors"
                />
            </FormGroup>
        </ModalWithFooter>
      )}

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

    </SimpleLayout>
  )
}