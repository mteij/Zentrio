import { ChevronDown, ChevronUp, MoreHorizontal, Puzzle, Settings, Share2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { apiFetch } from '../../lib/apiFetch'
import { isTauri } from '../../lib/auth-client'
import { ZENTRIO_LOGO_192_URL } from '../../lib/brand-assets'
import { createLogger } from '../../utils/client-logger'
import { Button, Input, Toggle } from '../index'
import tvStyles from './TvAddonManager.module.css'

const log = createLogger('TvAddonManagerUI')

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

const AddonConfigModal = ({
    isOpen,
    onClose,
    profileId,
    replaceAddonId,
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
            log.error(e)
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

interface TvAddonManagerProps {
  currentProfileId: string
  onProfileChange: (id: string) => void
}

export function TvAddonManager({ currentProfileId }: TvAddonManagerProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [addons, setAddons] = useState<Addon[]>([])
  const [configAddon, setConfigAddon] = useState<Addon | null>(null)
  const [configAddonPosition, setConfigAddonPosition] = useState<number>(-1)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [manifestUrl, setManifestUrl] = useState('')
  const [installing, setInstalling] = useState(false)
  const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false)
  const [pendingManifestUrl, setPendingManifestUrl] = useState('')
  const [expandedAddonId, setExpandedAddonId] = useState<string | null>(null)
  const [draggedAddonId, setDraggedAddonId] = useState<string | null>(null)
  const [dragOverAddonId, setDragOverAddonId] = useState<string | null>(null)

  const loadAddons = async (profileId: string) => {
    try {
      setLoading(true)
      const res = await apiFetch(`/api/addons/settings-profile/${profileId}/manage`)
      if (res.ok) {
        const data = await res.json()
        setAddons(data)
      }
    } catch (e) {
      log.error('Failed to load addons', e)
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
      log.error('Failed to install addon', e)
      toast.error('Network Error', { description: 'Network error' })
    } finally {
      setInstalling(false)
    }
  }

  const handleToggleAddon = async (addonId: string, enabled: boolean) => {
    setAddons(addons.map(a => a.id === addonId ? { ...a, enabled } : a))

    try {
      await apiFetch(`/api/addons/settings-profile/${currentProfileId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addonId, enabled })
      })
    } catch (e) {
      log.error('Failed to toggle addon', e)
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
      log.error('Failed to remove addon', e)
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
        log.error('Failed to open URL via Tauri opener', e)
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
      log.error('Failed to copy to clipboard', e)
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
      log.error('Failed to reorder addons', e)
      toast.error('Reorder Failed', { description: 'Failed to save addon order' })
      loadAddons(currentProfileId)
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

  return (
    <div className={tvStyles.tvAddonSection}>
      <div className={tvStyles.tvAddonSectionTitle}>Addons</div>

      <div className={tvStyles.tvAddonInstallRow}>
        <div className={tvStyles.tvAddonInstallInfo}>
          <div className={tvStyles.tvAddonInstallLabel}>Install Addon</div>
          <div className={tvStyles.tvAddonInstallDesc}>Enter the manifest URL of a Stremio-compatible addon.</div>
        </div>
        <div className={tvStyles.tvAddonInstallControl}>
          <div className={tvStyles.tvAddonInstallActions}>
            <Button variant="primary" onClick={() => { setPendingManifestUrl(''); setIsInstallDialogOpen(true) }}>
              Install
            </Button>
            <Button variant="secondary" onClick={() => navigate('/settings/explore-addons', { state: { from: '/settings?tab=addons', fromLabel: 'Back to Settings' } })}>
              Explore
            </Button>
          </div>
        </div>
      </div>

      {isInstallDialogOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white">Install Addon</h3>
              <button onClick={() => setIsInstallDialogOpen(false)} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1 uppercase">Manifest URL</label>
                <Input
                  value={pendingManifestUrl}
                  onChange={(e) => setPendingManifestUrl(e.target.value)}
                  placeholder="https://example.com/manifest.json"
                  className="w-full"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setIsInstallDialogOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => { setManifestUrl(pendingManifestUrl); setIsInstallDialogOpen(false); handleInstallAddon() }} disabled={!pendingManifestUrl}>
                Install
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={tvStyles.tvAddonSectionTitle}>Installed Addons</div>

      {loading ? (
        <div className={tvStyles.tvAddonEmpty}>Loading addons...</div>
      ) : addons.length === 0 ? (
        <div className={tvStyles.tvAddonEmpty}>No addons installed.</div>
      ) : (
        addons.map(addon => {
          const isZentrio = addon.manifest_url === 'zentrio://tmdb-addon' || addon.id === 'org.zentrio.tmdb'
          const isExpanded = expandedAddonId === addon.id
          const hasConfig = isZentrio || addon.behavior_hints?.configurable || addon.behavior_hints?.configurationRequired
          const canShare = !addon.manifest_url.startsWith('zentrio://')
          const canDelete = addon.manifest_url !== 'zentrio://tmdb-addon'

          return (
            <div 
              key={addon.id} 
              className={`${tvStyles.tvAddonRow} ${isZentrio ? tvStyles.tvAddonRowZentrio : ''} ${isExpanded ? tvStyles.tvAddonRowExpanded : ''} ${dragOverAddonId === addon.id ? tvStyles.tvAddonRowDragOver : ''} ${draggedAddonId === addon.id ? tvStyles.tvAddonRowDragging : ''}`}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, addon.id)}
              onDragOver={(e) => handleDragOver(e, addon.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, addon.id)}
              onDragEnd={handleDragEnd}
            >
              <div className={tvStyles.tvAddonRowLeading}>
                <div className={tvStyles.tvAddonReorderControls}>
                  <button onClick={(e) => { e.stopPropagation(); handleMoveAddon(addon.id, 'up') }} disabled={addons.indexOf(addon) === 0} title="Move up">
                    <ChevronUp size={16} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleMoveAddon(addon.id, 'down') }} disabled={addons.indexOf(addon) === addons.length - 1} title="Move down">
                    <ChevronDown size={16} />
                  </button>
                </div>
                {isZentrio ? (
                  <img className={tvStyles.tvAddonLogo} src={ZENTRIO_LOGO_192_URL} alt="Zentrio" />
                ) : addon.logo ? (
                  <img className={tvStyles.tvAddonLogo} src={addon.logo} alt={addon.name} />
                ) : (
                  <div className={tvStyles.tvAddonLogoPlaceholder}>
                    <Puzzle size={20} color="#555" />
                  </div>
                )}
                <div className={tvStyles.tvAddonDetails}>
                  <div className={tvStyles.tvAddonName}>
                    {addon.name}
                    <span className={tvStyles.tvAddonVersion}>v{addon.version}</span>
                    {isZentrio && <span className={tvStyles.tvAddonNativeBadge}>Native</span>}
                  </div>
                  <div className={tvStyles.tvAddonDescription}>{addon.description}</div>
                </div>
              </div>
              <div className={tvStyles.tvAddonRowControl}>
                <div className={tvStyles.tvAddonActions}>
                  <Toggle checked={addon.enabled} onChange={(checked) => handleToggleAddon(addon.id, checked)} />
                  <button
                    type="button"
                    className={tvStyles.tvAddonExpandBtn}
                    onClick={() => setExpandedAddonId(isExpanded ? null : addon.id)}
                    title={isExpanded ? 'Collapse' : 'Edit'}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </div>
                {isExpanded && (
                  <div className={tvStyles.tvAddonExpandedActions}>
                    {hasConfig && (
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => {
                          if (isZentrio) {
                            navigate(`/settings/addons/tmdb-config?profileId=${currentProfileId}`)
                          } else {
                            handleConfigureAddon(addon)
                          }
                        }}
                      >
                        <Settings size={16} />
                        <span>{isZentrio ? 'Configure' : 'Configure'}</span>
                      </Button>
                    )}
                    {canShare && (
                      <Button variant="secondary" size="small" onClick={() => handleShareAddon(addon)}>
                        <Share2 size={16} />
                        <span>Copy link</span>
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="danger" size="small" onClick={() => handleDeleteAddon(addon.id)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
                        </svg>
                        <span>Uninstall</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })
      )}

      <AddonConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => { setIsConfigModalOpen(false); setConfigAddon(null); setConfigAddonPosition(-1) }}
        profileId={currentProfileId}
        replaceAddonId={configAddon?.id ?? null}
        replacePosition={configAddonPosition}
        onSuccess={async (newAddonId) => {
          const res = await apiFetch(`/api/addons/settings-profile/${currentProfileId}/manage`)
          if (!res.ok) { loadAddons(currentProfileId); return }
          const freshAddons: Addon[] = await res.json()
          setAddons(freshAddons)

          if (newAddonId && configAddonPosition >= 0 && freshAddons.length > 1) {
            const newIdx = freshAddons.findIndex(a => String(a.id) === String(newAddonId))
            if (newIdx >= 0 && newIdx !== configAddonPosition) {
              const reordered = [...freshAddons]
              const [moved] = reordered.splice(newIdx, 1)
              const targetPos = Math.min(configAddonPosition, reordered.length)
              reordered.splice(targetPos, 0, moved)
              setAddons(reordered)
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
