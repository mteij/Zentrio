import { useState, useEffect } from 'react'
import { Puzzle, Settings, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Input, Toggle, SettingsProfileSelector } from '../index'
import styles from '../../styles/Settings.module.css'

interface Addon {
  id: string
  name: string
  version: string
  description: string
  logo?: string
  enabled: boolean
  manifest_url: string
  behavior_hints?: {
    configurable?: boolean
    configurationRequired?: boolean
  }
}

export function AddonManager() {
  const [loading, setLoading] = useState(false)
  const [currentProfileId, setCurrentProfileId] = useState<string>('')
  const [addons, setAddons] = useState<Addon[]>([])
  const [selectedAddon, setSelectedAddon] = useState<Addon | null>(null)
  const [showConfigureInput, setShowConfigureInput] = useState(false)
  const [manifestUrl, setManifestUrl] = useState('')
  const [installing, setInstalling] = useState(false)
  const [hasTmdbKey, setHasTmdbKey] = useState(false)

  // Profile dialog state removed - handled by component

  useEffect(() => {
    checkTmdbKey()
  }, [])

  const checkTmdbKey = async () => {
    try {
        const res = await fetch('/api/user/tmdb-api-key')
        if (res.ok) {
            const data = await res.json()
            setHasTmdbKey(!!data.data?.tmdb_api_key)
        }
    } catch (e) {
        console.error('Failed to check TMDB key', e)
    }
  }

  // loadProfiles removed

  const loadAddons = async (profileId: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/addons/settings-profile/${profileId}/manage`)
      if (res.ok) {
        const data = await res.json()
        setAddons(data)
      }
    } catch (e) {
      console.error('Failed to load addons', e)
    } finally {
      setLoading(false)
    }
  }

  const handleProfileChange = (newProfileId: string) => {
    if (!newProfileId) return
    setCurrentProfileId(newProfileId)
    localStorage.setItem('lastSelectedAddonProfile', newProfileId)
    loadAddons(newProfileId)
  }

  const handleProfilesLoaded = (profilesList: any[]) => {
      const lastSelected = localStorage.getItem('lastSelectedAddonProfile')
      if (lastSelected && profilesList.some(p => String(p.id) === lastSelected)) {
          handleProfileChange(lastSelected)
      } else if (profilesList.length > 0) {
          handleProfileChange(String(profilesList[0].id))
      }
  }

  const handleInstallAddon = async () => {
    if (!manifestUrl) return
    setInstalling(true)
    try {
      const res = await fetch('/api/addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifestUrl,
          settingsProfileId: currentProfileId
        })
      })
      
      if (res.ok) {
        setManifestUrl('')
        loadAddons(currentProfileId)
        toast.success('Success', { description: 'Addon installed successfully' })
      } else {
        const err = await res.json()
        toast.error('Installation Failed', { description: err.error || 'Failed to install addon' })
      }
    } catch (e) {
      console.error('Failed to install addon', e)
      toast.error('Network Error', { description: 'Network error' })
    } finally {
      setInstalling(false)
    }
  }

  const handleToggleWrapper = (addon: Addon, enabled: boolean) => {
      if ((addon.manifest_url === 'zentrio://tmdb-addon' || addon.id === 'org.zentrio.tmdb') && enabled && !hasTmdbKey) {
           toast.error('Missing API Key', { description: 'You must configure your TMDB API Key in Account settings before enabling this addon.' })
           return
       }
      handleToggleAddon(addon.id, enabled)
  }

  const handleToggleAddon = async (addonId: string, enabled: boolean) => {
    // Optimistic update
    setAddons(addons.map(a => a.id === addonId ? { ...a, enabled } : a))

    try {
      await fetch(`/api/addons/settings-profile/${currentProfileId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addonId, enabled })
      })
    } catch (e) {
      console.error('Failed to toggle addon', e)
      // Revert on error
      setAddons(addons.map(a => a.id === addonId ? { ...a, enabled: !enabled } : a))
    }
  }

  const handleDeleteAddon = async (addonId: string) => {
    try {
      const res = await fetch(`/api/addons/settings-profile/${currentProfileId}/${addonId}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        loadAddons(currentProfileId)
      } else {
        toast.error('Removal Failed', { description: 'Failed to remove addon' })
      }
    } catch (e) {
      console.error('Failed to remove addon', e)
    }
  }

  const handleConfigureAddon = (addon: Addon) => {
    setSelectedAddon(addon)
    let configUrl = addon.manifest_url.replace('/manifest.json', '')
    if (configUrl.endsWith('/')) configUrl = configUrl.slice(0, -1)
    configUrl += '/configure'
    
    const win = window.open(configUrl, '_blank')
    if (win) {
        setShowConfigureInput(true)
    } else {
        toast.warning('Popup Blocked', { description: 'Please allow popups to configure addons.' })
    }
  }

  // handleCreateProfile, handleDeleteProfile, handleRenameProfile removed

  return (
    <div className={styles.tabContent}>
      <div className={styles.settingsCard}>
        <h2 className={styles.sectionTitle}>Addons</h2>

        {/* Profile Selector */}
        <div className={styles.settingItem} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <SettingsProfileSelector
                currentProfileId={currentProfileId}
                onProfileChange={handleProfileChange}
                onProfilesLoaded={handleProfilesLoaded}
            />
        </div>

        {/* Install Addon */}
        <div className={styles.settingItem} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className={styles.settingInfo}>
                <h3>Install Addon</h3>
                <p>Enter the manifest URL of a Stremio-compatible addon.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '10px' }}>
                <div style={{ flex: 1 }}>
                    <Input
                        type="text"
                        placeholder="https://example.com/manifest.json"
                        value={manifestUrl}
                        onChange={(e) => setManifestUrl(e.target.value)}
                    />
                </div>
                <Button variant="primary" onClick={handleInstallAddon} disabled={installing}>
                    {installing ? 'Installing...' : 'Install'}
                </Button>
            </div>
            <div style={{ marginTop: '10px' }}>
                <Button variant="secondary" onClick={() => window.location.href = '/settings/explore-addons'}>
                    Explore Community Addons
                </Button>
            </div>
        </div>

        {/* Installed Addons List */}
        <div className={styles.settingItem} style={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: 'none' }}>
            <div className={styles.settingInfo}>
                <h3>Installed Addons</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '15px' }}>
                {loading ? (
                    <div style={{ color: '#666' }}>Loading addons...</div>
                ) : addons.length === 0 ? (
                    <div style={{ color: '#666' }}>No addons installed.</div>
                ) : (
                    addons.map(addon => {
                        const isZentrio = addon.manifest_url === 'zentrio://tmdb-addon' || addon.id === 'org.zentrio.tmdb';
                        const isDisabled = isZentrio && !hasTmdbKey;
                        
                        return (
                        <div key={addon.id} className="addon-item" style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '15px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.05)',
                            opacity: isDisabled ? 0.7 : 1
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1, minWidth: 0 }}>
                                {addon.logo ? (
                                    <img src={addon.logo} alt={addon.name} style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Puzzle size={20} color="#555" />
                                    </div>
                                )}
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {addon.name} <span style={{ fontSize: '0.8em', color: '#888' }}>v{addon.version}</span>
                                        {isDisabled && <span style={{ fontSize: '0.7em', color: '#ff6b6b', background: 'rgba(255,107,107,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Requires TMDB Key</span>}
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#aaa', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {addon.description}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                {(addon.manifest_url === 'zentrio://tmdb-addon' || (addon.behavior_hints?.configurable || addon.behavior_hints?.configurationRequired)) && (
                                    <Button 
                                        variant="secondary" 
                                        size="small" 
                                        onClick={() => handleConfigureAddon(addon)}
                                        title="Configure"
                                        disabled={isDisabled}
                                    >
                                        <Settings size={18} />
                                    </Button>
                                )}
                                
                                <Toggle 
                                    checked={addon.enabled} 
                                    onChange={(checked) => handleToggleWrapper(addon, checked)} 
                                />
                                
                                {addon.manifest_url !== 'zentrio://tmdb-addon' && (
                                    <Button 
                                        variant="danger" 
                                        size="small" 
                                        onClick={() => handleDeleteAddon(addon.id)}
                                        title="Uninstall"
                                    >
                                        <Trash2 size={18} />
                                    </Button>
                                )}
                            </div>
                        </div>
                    )})
                )}
            </div>
        </div>

      </div>
    </div>
  )
}