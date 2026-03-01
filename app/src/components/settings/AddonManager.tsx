import { useState, useEffect, useCallback } from 'react'
import { Puzzle, Settings, Trash2, X, Share2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Input, Toggle } from '../index'
import styles from '../../styles/Settings.module.css'
import { apiFetch } from '../../lib/apiFetch'
import { isTauri } from '../../lib/auth-client'

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

// Config/Install Modal Component
const AddonConfigModal = ({
    isOpen,
    onClose,
    profileId,
    replaceAddonId,
    replacePosition,
    onSuccess
}: {
    isOpen: boolean
    onClose: () => void
    profileId: string
    replaceAddonId?: string | null
    replacePosition?: number | null
    onSuccess: (newAddonId?: string) => void
}) => {
    const [url, setUrl] = useState('')
    const [installing, setInstalling] = useState(false)

    if (!isOpen) return null

    const handleInstall = async () => {
        if (!url || !profileId) return
        setInstalling(true)
        try {
            // If updating an existing addon, delete it first so we don't get duplicates
            if (replaceAddonId) {
                await apiFetch(`/api/addons/${replaceAddonId}`, { method: 'DELETE' })
            }

            const res = await apiFetch('/api/addons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    manifestUrl: url,
                    settingsProfileId: profileId
                })
            })
            if (res.ok) {
                const newAddon = await res.json()
                toast.success('Success', { description: replaceAddonId ? 'Addon updated successfully!' : 'Addon installed successfully!' })
                setUrl('')
                onSuccess(newAddon?.id ? String(newAddon.id) : undefined)
                onClose()
            } else {
                const err = await res.json()
                toast.error('Failed', { description: err.error || 'Failed to install addon' })
            }
        } catch (e) {
            console.error(e)
            toast.error('Error', { description: 'Network error installing addon' })
        } finally {
            setInstalling(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 w-full max-w-lg shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Addon Configuration</h3>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>
                
                <p className="text-zinc-400 mb-4 text-sm">
                    If you customized the addon in the new window, paste the installation link here to update or install it.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1 uppercase">Manifest URL</label>
                        <Input 
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://.../manifest.json"
                            className="w-full"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={handleInstall} disabled={installing || !url}>
                        {installing ? 'Installing...' : 'Install / Update'}
                    </Button>
                </div>
            </div>
        </div>
    )
}

interface AddonManagerProps {
  currentProfileId: string
  onProfileChange: (id: string) => void
}

export function AddonManager({ currentProfileId }: AddonManagerProps) {
  const [loading, setLoading] = useState(false)
  const [addons, setAddons] = useState<Addon[]>([])
  const [configAddon, setConfigAddon] = useState<Addon | null>(null)
  const [configAddonPosition, setConfigAddonPosition] = useState<number>(-1)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [manifestUrl, setManifestUrl] = useState('')
  const [installing, setInstalling] = useState(false)
  const [draggedAddonId, setDraggedAddonId] = useState<string | null>(null)
  const [dragOverAddonId, setDragOverAddonId] = useState<string | null>(null)

  // Profile dialog state removed - handled by component

  // loadProfiles removed

  const loadAddons = async (profileId: string) => {
    try {
      setLoading(true)
      const res = await apiFetch(`/api/addons/settings-profile/${profileId}/manage`)
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

  useEffect(() => {
    if (currentProfileId) {
      loadAddons(currentProfileId)
    }
  }, [currentProfileId])

  const handleInstallAddon = async () => {
    if (!manifestUrl) return
    setInstalling(true)
    try {
      const res = await apiFetch('/api/addons', {
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
      handleToggleAddon(addon.id, enabled)
  }

  const handleToggleAddon = async (addonId: string, enabled: boolean) => {
    // Optimistic update
    setAddons(addons.map(a => a.id === addonId ? { ...a, enabled } : a))

    try {
      await apiFetch(`/api/addons/settings-profile/${currentProfileId}/toggle`, {
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
      const res = await apiFetch(`/api/addons/settings-profile/${currentProfileId}/${addonId}`, {
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

  const handleConfigureAddon = useCallback(async (addon: Addon) => {
    setConfigAddon(addon)
    setConfigAddonPosition(addons.findIndex(a => a.id === addon.id))
    let configUrl = addon.manifest_url.replace('/manifest.json', '')
    if (configUrl.endsWith('/')) configUrl = configUrl.slice(0, -1)
    configUrl += '/configure'

    if (isTauri()) {
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener')
        await openUrl(configUrl)
      } catch (e) {
        console.error('Failed to open URL via Tauri opener', e)
        window.open(configUrl, '_blank', 'noopener,noreferrer')
      }
    } else {
      window.open(configUrl, '_blank', 'noopener,noreferrer')
    }

    setIsConfigModalOpen(true)
  }, [addons])

  const handleShareAddon = async (addon: Addon) => {
    try {
      await navigator.clipboard.writeText(addon.manifest_url)
      toast.success('Link Copied', { description: `${addon.name} manifest URL copied to clipboard` })
    } catch (e) {
      console.error('Failed to copy to clipboard', e)
      toast.error('Copy Failed', { description: 'Failed to copy link to clipboard' })
    }
  }

  const handleReorderAddons = async (newAddons: Addon[]) => {
    const addonIds = newAddons.map(a => parseInt(a.id))
    try {
      await apiFetch(`/api/addons/settings-profile/${currentProfileId}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addonIds })
      })
    } catch (e) {
      console.error('Failed to reorder addons', e)
      toast.error('Reorder Failed', { description: 'Failed to save addon order' })
      loadAddons(currentProfileId) // Revert on error
    }
  }

  const handleDragStart = (e: React.DragEvent, addonId: string) => {
    setDraggedAddonId(addonId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, addonId: string) => {
    e.preventDefault()
    if (draggedAddonId !== addonId) {
      setDragOverAddonId(addonId)
    }
  }

  const handleDragLeave = () => {
    setDragOverAddonId(null)
  }

  const handleDrop = (e: React.DragEvent, targetAddonId: string) => {
    e.preventDefault()
    if (!draggedAddonId || draggedAddonId === targetAddonId) {
      setDraggedAddonId(null)
      setDragOverAddonId(null)
      return
    }

    const draggedIndex = addons.findIndex(a => a.id === draggedAddonId)
    const targetIndex = addons.findIndex(a => a.id === targetAddonId)

    if (draggedIndex === -1 || targetIndex === -1) return

    const newAddons = [...addons]
    const [removed] = newAddons.splice(draggedIndex, 1)
    newAddons.splice(targetIndex, 0, removed)

    setAddons(newAddons)
    handleReorderAddons(newAddons)

    setDraggedAddonId(null)
    setDragOverAddonId(null)
  }

  const handleDragEnd = () => {
    setDraggedAddonId(null)
    setDragOverAddonId(null)
  }

  const handleMoveAddon = (addonId: string, direction: 'up' | 'down') => {
    const index = addons.findIndex(a => a.id === addonId)
    if (index === -1) return
    
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= addons.length) return

    const newAddons = [...addons]
    const [removed] = newAddons.splice(index, 1)
    newAddons.splice(newIndex, 0, removed)

    setAddons(newAddons)
    handleReorderAddons(newAddons)
  }

  // handleCreateProfile, handleDeleteProfile, handleRenameProfile removed

  return (
    <div className={styles.tabContent}>
      <div className={styles.settingsCard}>
        <h2 className={styles.sectionTitle}>Addons</h2>

        {/* Install Addon */}
        <div className={styles.settingItem} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className={styles.settingInfo}>
                <h3>Install Addon</h3>
                <p>Enter the manifest URL of a Stremio-compatible addon.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <Input
                        type="text"
                        placeholder="https://example.com/manifest.json"
                        value={manifestUrl}
                        onChange={(e) => setManifestUrl(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Button variant="primary" onClick={handleInstallAddon} disabled={installing}>
                        {installing ? 'Installing...' : 'Install'}
                    </Button>
                    <Button variant="secondary" onClick={() => window.location.href = '/settings/explore-addons'}>
                        Explore
                    </Button>
                </div>
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
                        
                        return (
                        <div 
                            key={addon.id} 
                            className={`${styles.addonItem} addon-item`}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, addon.id)}
                            onDragOver={(e) => handleDragOver(e, addon.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, addon.id)}
                            onDragEnd={handleDragEnd}
                            style={{
                                background: isZentrio ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.1))' : undefined,
                                border: dragOverAddonId === addon.id 
                                    ? '2px solid rgba(139, 92, 246, 0.6)' 
                                    : isZentrio 
                                        ? '1px solid rgba(139, 92, 246, 0.3)' 
                                        : undefined,
                                opacity: draggedAddonId === addon.id ? 0.5 : 1,
                                cursor: 'grab',
                                transform: dragOverAddonId === addon.id ? 'scale(1.01)' : 'scale(1)'
                            }}
                        >
                            {/* Reorder controls - separate from addonInfo for proper vertical centering */}
                            <div className={styles.addonReorderControls}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleMoveAddon(addon.id, 'up'); }}
                                    disabled={addons.indexOf(addon) === 0}
                                    title="Move up"
                                >
                                    <ChevronUp size={16} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleMoveAddon(addon.id, 'down'); }}
                                    disabled={addons.indexOf(addon) === addons.length - 1}
                                    title="Move down"
                                >
                                    <ChevronDown size={16} />
                                </button>
                            </div>
                            <div className={styles.addonInfo}>
                                {isZentrio ? (
                                    <img className={styles.addonLogo} src="/static/logo/icon-192.png" alt="Zentrio" />
                                ) : addon.logo ? (
                                    <img className={styles.addonLogo} src={addon.logo} alt={addon.name} />
                                ) : (
                                    <div className={styles.addonLogoPlaceholder}>
                                        <Puzzle size={20} color="#555" />
                                    </div>
                                )}
                                <div className={styles.addonDetails}>
                                    <div className={styles.addonName}>
                                        {addon.name} <span className={styles.addonVersion}>v{addon.version}</span>
                                        {isZentrio && <span style={{ fontSize: '0.65em', color: '#a78bfa', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2))', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Native</span>}
                                    </div>
                                    <div className={styles.addonDescription}>
                                        {addon.description}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.addonActions}>
                                {(addon.behavior_hints?.configurable || addon.behavior_hints?.configurationRequired) && (
                                    <Button 
                                        variant="secondary" 
                                        size="small" 
                                        onClick={() => handleConfigureAddon(addon)}
                                        title="Configure"
                                    >
                                        <Settings size={18} />
                                    </Button>
                                )}
                                
                                {!addon.manifest_url.startsWith('zentrio://') && (
                                    <Button 
                                        variant="secondary" 
                                        size="small" 
                                        onClick={() => handleShareAddon(addon)}
                                        title="Copy addon link"
                                    >
                                        <Share2 size={18} />
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
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
                                        </svg>
                                    </Button>
                                )}
                            </div>
                        </div>
                    )})
                )}
            </div>
        </div>

      </div>

      <AddonConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => { setIsConfigModalOpen(false); setConfigAddon(null); setConfigAddonPosition(-1) }}
        profileId={currentProfileId}
        replaceAddonId={configAddon?.id ?? null}
        replacePosition={configAddonPosition}
        onSuccess={async (newAddonId) => {
          // Reload the list first so we have fresh data with the new addon's ID
          const res = await apiFetch(`/api/addons/settings-profile/${currentProfileId}/manage`)
          if (!res.ok) { loadAddons(currentProfileId); return }
          const freshAddons: Addon[] = await res.json()
          setAddons(freshAddons)

          // If we replaced an existing addon, move the new one back to the original position
          if (newAddonId && configAddonPosition >= 0 && freshAddons.length > 1) {
            const newIdx = freshAddons.findIndex(a => String(a.id) === String(newAddonId))
            if (newIdx >= 0 && newIdx !== configAddonPosition) {
              const reordered = [...freshAddons]
              const [moved] = reordered.splice(newIdx, 1)
              // Clamp position to valid range
              const targetPos = Math.min(configAddonPosition, reordered.length)
              reordered.splice(targetPos, 0, moved)
              setAddons(reordered)
              // Persist the new order
              await apiFetch(`/api/addons/settings-profile/${currentProfileId}/reorder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ addonIds: reordered.map(a => parseInt(a.id)) })
              })
            }
          }
        }}
      />
    </div>
  )
}