import { useState, useEffect, useCallback } from 'react'
import { Pencil, Tv, ExternalLink, Loader2, Check, Unplug, RefreshCw } from 'lucide-react'
import { Button, FormGroup, Input, Modal, ConfirmDialog } from '../index'
import { apiFetch } from '../../lib/apiFetch'
import { toast } from 'sonner'

// Avatar styles available in DiceBear
const AVATAR_STYLES = [
  { id: 'adventurer-neutral', name: 'Adventurer' },
  { id: 'avataaars-neutral', name: 'Avataaars' },
  { id: 'bottts-neutral', name: 'Bottts' },
  { id: 'glass', name: 'Glass' },
  { id: 'fun-emoji', name: 'Fun Emoji' },
  { id: 'lorelei-neutral', name: 'Lorelei' },
  { id: 'pixel-art-neutral', name: 'Pixel Art' },
  { id: 'thumbs', name: 'Thumbs' },
] as const

const DEFAULT_AVATAR_STYLE = 'bottts-neutral'

interface Profile {
  id: number
  name: string
  avatar: string
  avatar_style?: string
  isDefault?: boolean
  nsfw_filter_enabled?: boolean
  nsfw_age_rating?: number
  settings_profile_id?: number
}

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  profile: Profile | null
  onSave: () => void
}

export function ProfileModal({ isOpen, onClose, profile, onSave }: ProfileModalProps) {
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('')
  const [avatarStyle, setAvatarStyle] = useState<string>(DEFAULT_AVATAR_STYLE)
  const [ageRating, setAgeRating] = useState(18)
  const [settingsProfileId, setSettingsProfileId] = useState<string>('')
  const [settingsProfiles, setSettingsProfiles] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showStylePicker, setShowStylePicker] = useState(false)
  const [activeProfileId, setActiveProfileId] = useState<number | null>(null)

  // Trakt integration state
  const [traktStatus, setTraktStatus] = useState<{
    connected: boolean
    available: boolean
    username?: string
  } | null>(null)
  const [traktLoading, setTraktLoading] = useState(false)
  const [showTraktConnect, setShowTraktConnect] = useState(false)
  const [deviceCode, setDeviceCode] = useState<{
    pollToken: string
    userCode: string
    verificationUrl: string
    expiresIn: number
    interval: number
  } | null>(null)
  const [polling, setPolling] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadSettingsProfiles()
      
      try {
        const stored = localStorage.getItem('selectedProfile')
        if (stored) {
            const p = JSON.parse(stored)
            setActiveProfileId(p.id)
        }
      } catch {}

      if (profile) {
        setName(profile.name)
        setAvatar(profile.avatar)
        setAvatarStyle(profile.avatar_style || DEFAULT_AVATAR_STYLE)
        setAgeRating(profile.nsfw_age_rating || 18)
        setSettingsProfileId(profile.settings_profile_id ? String(profile.settings_profile_id) : '')
      } else {
        resetForm()
        generateNewAvatar(DEFAULT_AVATAR_STYLE)
      }
    }
  }, [isOpen, profile])

  // Fetch Trakt status when profile changes
  const fetchTraktStatus = useCallback(async () => {
    if (!profile?.id) {
      setTraktStatus(null)
      return
    }
    try {
      const res = await apiFetch(`/api/trakt/status?profileId=${profile.id}`)
      const data = await res.json()
      setTraktStatus(data.data)
    } catch (e) {
      console.error('Failed to get Trakt status:', e)
    }
  }, [profile?.id])

  useEffect(() => {
    if (isOpen && profile?.id) {
      fetchTraktStatus()
    }
  }, [isOpen, profile?.id, fetchTraktStatus])

  // Polling for device code authorization
  useEffect(() => {
    if (!polling || !deviceCode) return

    const pollInterval = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/trakt/poll-token?pollToken=${deviceCode.pollToken}`)
        const data = await res.json()
        
        if (data.data?.status === 'authorized') {
          setPolling(false)
          setDeviceCode(null)
          setShowTraktConnect(false)
          toast.success(`Connected to Trakt as ${data.data.username}`)
          fetchTraktStatus()
        } else if (data.data?.status === 'denied' || data.data?.status === 'expired') {
          setPolling(false)
          setDeviceCode(null)
          toast.error(data.data.status === 'denied' ? 'Authorization denied' : 'Code expired')
        }
      } catch (e) {
        console.error('Polling error:', e)
      }
    }, (deviceCode.interval || 5) * 1000)

    return () => clearInterval(pollInterval)
  }, [polling, deviceCode, fetchTraktStatus])

  const loadSettingsProfiles = async () => {
    try {
      const res = await apiFetch('/api/user/settings-profiles')
      if (res.ok) {
        const data = await res.json()
        const profiles = data.data || data || []
        setSettingsProfiles(profiles)
        
        if (!profile && !settingsProfileId && profiles.length > 0) {
            setSettingsProfileId(String(profiles[0].id))
        }
      }
    } catch (e) {
      console.error('Failed to load settings profiles', e)
    }
  }

  const resetForm = () => {
    setName('')
    setAvatar('')
    setAvatarStyle(DEFAULT_AVATAR_STYLE)
    setAgeRating(18)
    setSettingsProfileId('')
    setError('')
  }

  const generateNewAvatar = async (style?: string) => {
    try {
      const styleToUse = style || avatarStyle
      const res = await apiFetch(`/api/avatar/random?style=${encodeURIComponent(styleToUse)}`)
      if (res.ok) {
        const data = await res.json()
        setAvatar(data.seed)
      }
    } catch (e) {
      console.error('Failed to generate avatar', e)
    }
  }

  const handleStyleSelect = (newStyle: string) => {
    setAvatarStyle(newStyle)
    setShowStylePicker(false)
  }

  // Trakt functions
  const startDeviceCode = async () => {
    if (!profile?.id) return
    setTraktLoading(true)
    try {
      const res = await apiFetch('/api/trakt/device-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profile.id })
      })
      const data = await res.json()
      
      if (data.data?.userCode) {
        setDeviceCode(data.data)
        setPolling(true)
      }
    } catch (e) {
      console.error('Device code error:', e)
      toast.error('Failed to get device code')
    } finally {
      setTraktLoading(false)
    }
  }

  const disconnectTrakt = async () => {
    if (!profile?.id) return
    setTraktLoading(true)
    try {
      await apiFetch('/api/trakt/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profile.id })
      })
      toast.success('Disconnected from Trakt')
      fetchTraktStatus()
    } catch (e) {
      console.error('Disconnect error:', e)
      toast.error('Failed to disconnect')
    } finally {
      setTraktLoading(false)
    }
  }

  const syncTrakt = async () => {
    if (!profile?.id) return
    setSyncing(true)
    try {
      const res = await apiFetch('/api/trakt/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profile.id })
      })
      const data = await res.json()
      if (data.data) {
        const pulled = (data.data.pulled?.added || 0) + (data.data.pulled?.updated || 0)
        const pushed = data.data.pushed?.synced || 0
        toast.success(`Synced: ${pulled} pulled, ${pushed} pushed`)
      } else {
        toast.success('Sync completed')
      }
    } catch (e) {
      console.error('Sync error:', e)
      toast.error('Failed to sync')
    } finally {
      setSyncing(false)
    }
  }

  const getAvatarUrl = (seed: string, style: string) => {
    if (seed.startsWith('http') || seed.startsWith('data:')) {
      return seed
    }
    // Fix: Prevent 404 errors by using a default seed if none provided
    const seedToUse = seed || 'preview'
    return `/api/avatar/${encodeURIComponent(seedToUse)}?style=${encodeURIComponent(style)}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const url = profile ? `/api/profiles/${profile.id}` : '/api/profiles'
      const method = profile ? 'PUT' : 'POST'
      
      const body = {
        name,
        avatar,
        avatarStyle,
        nsfwFilterEnabled: ageRating < 18,
        ageRating,
        heroBannerEnabled: true,
        settingsProfileId: settingsProfileId ? parseInt(settingsProfileId) : undefined,
        hideAddonsButton: false
      }

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save profile')
      }

      onSave()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!profile) return
    
    if (profile.isDefault) {
        setError('Cannot delete default profile')
        return
    }

    setLoading(true)
    try {
      const res = await apiFetch(`/api/profiles/${profile.id}`, { method: 'DELETE' })
      if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to delete profile')
      }
      onSave()
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  const isDefault = profile?.isDefault
  const canDelete = !isDefault 
  const deleteDisabledReason = isDefault ? 'Default profile cannot be removed' : undefined
  const currentStyleName = AVATAR_STYLES.find(s => s.id === avatarStyle)?.name || 'Bottts'

  return (
    <>
      <Modal
        id="profileModal"
        isOpen={isOpen}
        onClose={onClose}
        title={profile ? 'Edit Profile' : 'Create New Profile'}
      >
          {error && (
              <div className="bg-red-950/20 border border-red-900/30 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
                  {error}
              </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar Preview with Shuffle & Edit */}
              <div className="flex flex-col items-center gap-3 mb-2">
                  <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-zinc-700 group">
                      <img 
                          src={getAvatarUrl(avatar, avatarStyle)} 
                          alt="Avatar Preview"
                          className="w-full h-full object-cover"
                      />
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                      <Button
                          type="button"
                          variant="secondary"
                          size="small"
                          onClick={() => generateNewAvatar()}
                          className="text-xs"
                      >
                          🎲 Shuffle
                      </Button>
                      <Button
                          type="button"
                          variant="secondary"
                          size="small"
                          onClick={() => setShowStylePicker(true)}
                          className="text-xs flex items-center gap-1"
                      >
                          <Pencil className="w-3 h-3" />
                          {currentStyleName}
                      </Button>
                  </div>
              </div>

              <div className="space-y-4">
                  <FormGroup label="Profile Name" htmlFor="profileName">
                      <Input
                          type="text"
                          id="profileName"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Enter profile name"
                          className="!w-full !bg-zinc-900 !border !border-zinc-700 !rounded-lg !px-3 !py-2 !text-white focus:outline-none focus:border-red-500 transition-colors"
                      />
                  </FormGroup>
                  
                  <FormGroup label="Age Rating" htmlFor="ageRatingInput">
                      <select
                          id="ageRatingInput"
                          value={ageRating}
                          onChange={(e) => setAgeRating(parseInt(e.target.value))}
                          className="!w-full !bg-zinc-900 !border !border-zinc-700 !rounded-lg !px-3 !py-2 !text-white focus:outline-none focus:border-red-500 transition-colors"
                      >
                          <option value="0">All Ages</option>
                          <option value="6">6 years</option>
                          <option value="9">9 years</option>
                          <option value="12">12 years</option>
                          <option value="16">16 years</option>
                          <option value="18">18 years</option>
                      </select>
                  </FormGroup>

                  <FormGroup label="Settings Profile" htmlFor="settingsProfileInput">
                      <select 
                          id="settingsProfileInput" 
                          value={settingsProfileId}
                          onChange={(e) => setSettingsProfileId(e.target.value)}
                          className="!w-full !bg-zinc-900 !border !border-zinc-700 !rounded-lg !px-3 !py-2 !text-white focus:outline-none focus:border-red-500 transition-colors"
                      >
                          {settingsProfiles.map(sp => (
                              <option key={sp.id} value={sp.id}>{sp.name}</option>
                          ))}
                      </select>
                  </FormGroup>

                  {/* Trakt Integration (only show for existing profiles) */}
                  {profile && traktStatus?.available && (
                    <div className="pt-2 border-t border-zinc-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
                            <Tv className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">Trakt.tv</p>
                            {traktStatus.connected ? (
                              <p className="text-xs text-green-400">Connected as @{traktStatus.username}</p>
                            ) : (
                              <p className="text-xs text-white/50">Sync watch history & get recommendations</p>
                            )}
                          </div>
                        </div>
                        {traktStatus.connected ? (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="small"
                              onClick={syncTrakt}
                              disabled={traktLoading || syncing}
                              className="text-xs"
                            >
                              {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                              <span className="ml-1">Sync</span>
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="small"
                              onClick={disconnectTrakt}
                              disabled={traktLoading || syncing}
                              className="text-xs"
                            >
                              {traktLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unplug className="w-3 h-3" />}
                              <span className="ml-1">Disconnect</span>
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            size="small"
                            onClick={() => setShowTraktConnect(true)}
                            disabled={traktLoading}
                            className="text-xs"
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                  {profile && (
                      <div className="relative group/delete flex items-center">
                          <Button
                              type="button"
                              variant="danger"
                              onClick={() => setShowDeleteConfirm(true)}
                              disabled={loading || !canDelete}
                              className={!canDelete ? "opacity-50 cursor-not-allowed" : ""}
                          >
                              Delete
                          </Button>
                          {!canDelete && (
                              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover/delete:opacity-100 transition-opacity pointer-events-none z-50">
                                  {deleteDisabledReason}
                              </span>
                          )}
                      </div>
                  )}
                  <Button
                      type="button"
                      variant="secondary"
                      onClick={onClose}
                      disabled={loading}
                  >
                      Cancel
                  </Button>
                  <Button
                      type="submit"
                      variant="primary"
                      disabled={loading}
                  >
                      {loading ? 'Saving...' : 'Save Profile'}
                  </Button>
              </div>
          </form>

          {/* Delete Confirmation */}
          <ConfirmDialog
            isOpen={showDeleteConfirm}
            onClose={() => setShowDeleteConfirm(false)}
            onConfirm={handleDelete}
            title="Delete Profile"
            message="Are you sure you want to delete this profile? This action cannot be undone."
            confirmText="Delete"
            cancelText="Cancel"
            variant="danger"
          />
      </Modal>

      {/* Avatar Style Picker Modal */}
      <Modal
        id="avatarStylePicker"
        isOpen={showStylePicker}
        onClose={() => setShowStylePicker(false)}
        title="Choose Avatar Style"
      >
          <div className="grid grid-cols-4 gap-3 py-2">
              {AVATAR_STYLES.map(style => (
                  <button
                      key={style.id}
                      type="button"
                      onClick={() => handleStyleSelect(style.id)}
                      className={`
                          flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all
                          ${avatarStyle === style.id 
                              ? 'border-red-500 bg-red-500/10 scale-105' 
                              : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50 hover:scale-102'
                          }
                      `}
                  >
                      <div className="w-14 h-14 rounded-full overflow-hidden bg-zinc-900 shadow-lg">
                          <img 
                              src={getAvatarUrl(avatar || 'preview', style.id)}
                              alt={style.name}
                              className="w-full h-full object-cover"
                          />
                      </div>
                      <span className={`text-xs font-medium truncate w-full text-center ${
                          avatarStyle === style.id ? 'text-red-400' : 'text-zinc-300'
                      }`}>
                          {style.name}
                      </span>
                  </button>
              ))}
          </div>
          <div className="flex justify-end pt-4 border-t border-zinc-800 mt-4">
              <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowStylePicker(false)}
              >
                  Done
              </Button>
          </div>
      </Modal>

      {/* Trakt Connect Modal */}
      <Modal
        id="traktConnectModal"
        isOpen={showTraktConnect}
        onClose={() => {
          setShowTraktConnect(false)
          setDeviceCode(null)
          setPolling(false)
        }}
        title="Connect Trakt.tv"
      >
        {deviceCode ? (
          <div className="text-center space-y-4 py-4">
            <p className="text-white/70 text-sm">
              Enter this code at <span className="text-white font-medium">trakt.tv/activate</span>
            </p>
            
            <div className="py-4 px-6 bg-white/5 rounded-2xl border border-white/10">
              <div className="text-4xl font-mono font-bold text-white tracking-widest">
                {deviceCode.userCode}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-white/50">
              <Loader2 className="w-4 h-4 animate-spin" />
              Waiting for authorization...
            </div>

            <a
              href={deviceCode.verificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
            >
              Open Trakt
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              onClick={() => {
                setDeviceCode(null)
                setPolling(false)
              }}
              className="block w-full text-sm text-white/50 hover:text-white transition-colors mt-2"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-white/70 text-sm">
              Connect your Trakt.tv account to sync watch history and get personalized recommendations for this profile.
            </p>
            
            <Button
              type="button"
              variant="primary"
              onClick={startDeviceCode}
              disabled={traktLoading}
              className="w-full"
            >
              {traktLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Tv className="w-4 h-4 mr-2" />
              )}
              Get Device Code
            </Button>

            <p className="text-xs text-white/30 text-center">
              You'll enter a code at trakt.tv/activate to authorize
            </p>
          </div>
        )}
      </Modal>
    </>
  )
}
