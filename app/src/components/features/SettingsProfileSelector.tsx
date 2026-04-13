
import { useCallback, useEffect, useState, useRef } from 'react'
import { Plus, Edit2, MoreHorizontal, Trash2 } from 'lucide-react'
import { Button, InputDialog, ConfirmDialog } from '../index'
import { apiFetch } from '../../lib/apiFetch'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('ProfileSelector')

interface SettingsProfile {
  id: string
  name: string
  is_default?: boolean
}

interface SettingsProfileSelectorProps {
  currentProfileId: string
  onProfileChange: (id: string) => void
  onProfilesLoaded?: (profiles: SettingsProfile[]) => void
  disabled?: boolean
  label?: string | null
  layout?: 'row' | 'column'
  /** Compact mode: hides label text, smaller controls */
  compact?: boolean
  mode?: 'full' | 'switcher'
  theme?: 'default' | 'tv-rail' | 'mobile-header'
  manageLabel?: string
}

export function SettingsProfileSelector({
  currentProfileId,
  onProfileChange,
  onProfilesLoaded,
  disabled = false,
  label = 'Profile',
  layout = 'row',
  compact = false,
  mode = 'full',
  theme = 'default',
  manageLabel = 'Manage',
}: SettingsProfileSelectorProps) {
  const [profiles, setProfiles] = useState<SettingsProfile[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showManageMenu, setShowManageMenu] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const manageMenuRef = useRef<HTMLDivElement | null>(null)

  const loadProfiles = useCallback(async () => {
    try {
      const res = await apiFetch('/api/user/settings-profiles')
      if (res.ok) {
        const data = await res.json()
        const profilesList = data.data || data || []
        setProfiles(profilesList)
        onProfilesLoadedRef.current?.(profilesList)
      }
    } catch (e) {
      log.error('Failed to load profiles', e)
    }
  }, []) // using ref for onProfilesLoaded to avoid infinite loop

  const onProfilesLoadedRef = useRef(onProfilesLoaded)
  useEffect(() => {
    onProfilesLoadedRef.current = onProfilesLoaded
  }, [onProfilesLoaded])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  useEffect(() => {
    if (!showManageMenu) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!manageMenuRef.current?.contains(event.target as Node)) {
        setShowManageMenu(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [showManageMenu])

  const handleCreateProfile = async (name: string) => {
    try {
      setError(null)
      const res = await apiFetch('/api/user/settings-profiles', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ name })
      })
      
      if (res.ok) {
        const data = await res.json()
        await loadProfiles()
        onProfileChange(String(data.data.id))
      } else {
        const err = await res.json()
        setError(err.error?.message || "Failed to create profile")
      }
    } catch (e) {
      log.error(e)
      setError("Network error")
    }
  }

  const handleDeleteProfile = async () => {
    if (!currentProfileId) return

    try {
      setError(null)
      const res = await apiFetch(`/api/user/settings-profiles/${currentProfileId}`, {
        method: 'DELETE',
        headers: {
            'X-Requested-With': 'XMLHttpRequest' 
        }
      })
      
      if (res.ok) {
        await loadProfiles()
        // Parent should handle profile switch if current is deleted, or we can pick default here
        // But parent usually re-selects based on available profiles or defaults
        // Re-loading profiles will trigger parent effect if they are listening to onProfilesLoaded or we might need to select a safe default here
        // Let's select the first available profile if the current one is gone
        // But we need the updated list first.
        // Actually loadProfiles updates state async.
        // Let's manually fetch here to decide what to select
        const listRes = await apiFetch('/api/user/settings-profiles').then(r => r.json()).catch(() => [])
        const newList = listRes.data || listRes || []
        if (newList.length > 0) {
            onProfileChange(String(newList[0].id))
        } else {
            onProfileChange('')
        }
      } else {
        const err = await res.json()
        setError(err.error?.message || "Failed to delete profile")
      }
    } catch (e) {
      log.error(e)
      setError("Network error")
    }
  }

  const handleRenameProfile = async (name: string) => {
    if (!currentProfileId) return

    try {
      setError(null)
      const res = await apiFetch(`/api/user/settings-profiles/${currentProfileId}`, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ name })
      })
      
      if (res.ok) {
        await loadProfiles()
      } else {
        const err = await res.json()
        setError(err.error?.message || "Failed to rename profile")
      }
    } catch (e) {
      log.error(e)
      setError("Network error")
    }
  }

  // Find current profile to check if default
  const currentProfile = profiles.find(p => String(p.id) === String(currentProfileId))
  const isDefaultProfile = currentProfile?.name === 'Default' || currentProfile?.is_default
  const showActions = mode === 'full'
  const showManageButton = mode === 'switcher'
  const wrapperClassName = theme === 'tv-rail'
    ? `flex ${layout === 'column' ? 'flex-col gap-2' : 'items-center gap-4'} w-full`
    : theme === 'mobile-header'
      ? `flex items-center w-full min-w-0`
    : `flex ${layout === 'column' ? 'flex-col items-start gap-2' : 'items-center gap-4'} w-full`
  const fieldRowClassName = theme === 'tv-rail'
    ? `flex items-center ${label != null ? 'ml-auto' : 'w-full'} min-w-0`
    : theme === 'mobile-header'
      ? `flex items-center gap-1.5 w-full min-w-0 flex-nowrap`
    : `flex items-center gap-2 ${label != null ? 'ml-auto' : 'w-full'} flex-wrap`
  const selectClassName = theme === 'tv-rail'
    ? `w-full min-w-0 appearance-none rounded-[18px] border border-white/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 py-3 text-sm font-semibold text-white outline-none transition-colors focus:border-white/20 focus:bg-[linear-gradient(180deg,rgba(229,9,20,0.18),rgba(255,255,255,0.06))] ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`
    : theme === 'mobile-header'
      ? `flex-1 min-w-0 max-w-[12rem] appearance-none rounded-xl border border-white/20 bg-zinc-950/85 px-3 py-2 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(0,0,0,0.35)] outline-none transition-colors focus:border-white/35 focus:bg-zinc-900 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`
    : `bg-zinc-800 text-white border border-zinc-700 rounded-lg focus:outline-none focus:border-red-500 transition-colors ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm min-w-[150px]'} flex-1 min-w-0`
  const actionButtonClassName = theme === 'mobile-header'
    ? '!h-9 !w-9 !px-0 !min-w-0 !rounded-xl'
    : '!px-2'
  const manageMenuClassName = theme === 'mobile-header'
    ? 'absolute right-0 top-full z-50 mt-2 min-w-[180px] rounded-2xl border border-white/10 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur'
    : 'absolute right-0 top-full z-50 mt-2 min-w-[180px] rounded-xl border border-white/10 bg-zinc-900/95 p-2 shadow-2xl backdrop-blur'
  const manageMenuItemClassName = 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45'

  return (
    <div className={wrapperClassName}>
       {label != null && (
         <div className="flex flex-col">
            <h3 className="text-lg font-medium text-white mb-1">{label}</h3>
            <p className="text-sm text-zinc-400">Select profile to configure.</p>
         </div>
       )}
       
       <div className={fieldRowClassName}>
            {error && <div className="text-red-400 text-sm w-full">{error}</div>}

            <select
                value={currentProfileId}
                onChange={(e) => onProfileChange(e.target.value)}
                disabled={disabled}
                className={selectClassName}
                style={theme === 'mobile-header' ? { colorScheme: 'dark' } : undefined}
                aria-label="Settings profile"
            >
                {profiles.map(p => (
                    <option
                      key={p.id}
                      value={p.id}
                      className={theme === 'mobile-header' ? 'bg-zinc-900 text-white' : undefined}
                    >
                      {p.name}
                    </option>
                ))}
            </select>

             {showActions ? (
               <div className="flex items-center gap-1 flex-shrink-0">
                 <Button
                    variant="secondary"
                    size="small"
                    onClick={() => setShowCreateDialog(true)}
                    title="Create new profile"
                    disabled={disabled}
                    className={actionButtonClassName}
                 >
                    <Plus size={13} />
                 </Button>

                {theme !== 'mobile-header' && !isDefaultProfile && currentProfileId && (
                    <>
                    <Button
                        variant="secondary"
                        size="small"
                        onClick={() => setShowRenameDialog(true)}
                        title="Rename profile"
                        disabled={disabled}
                        className={actionButtonClassName}
                    >
                        <Edit2 size={13} />
                    </Button>
                    <Button
                        variant="danger"
                        size="small"
                        onClick={() => setShowDeleteDialog(true)}
                        title="Delete profile"
                        disabled={disabled}
                        className={actionButtonClassName}
                    >
                        <Trash2 size={13} />
                    </Button>
                    </>
                 )}
               </div>
             ) : null}

             {showManageButton ? (
               <div className="relative flex-shrink-0" ref={manageMenuRef}>
                 <Button
                   variant="secondary"
                   size="small"
                   onClick={() => setShowManageMenu((open) => !open)}
                   title="Manage settings profiles"
                   disabled={disabled}
                   className={actionButtonClassName}
                 >
                   {theme === 'mobile-header' ? <MoreHorizontal size={16} /> : manageLabel}
                 </Button>

                 {showManageMenu ? (
                   <div className={manageMenuClassName} role="menu" aria-label="Manage settings profiles">
                     <button
                       type="button"
                       className={manageMenuItemClassName}
                       onClick={() => {
                         setShowManageMenu(false)
                         setShowCreateDialog(true)
                       }}
                     >
                       <Plus size={14} />
                       Create profile
                     </button>
                     <button
                       type="button"
                       className={manageMenuItemClassName}
                       disabled={!currentProfileId || isDefaultProfile}
                       onClick={() => {
                         setShowManageMenu(false)
                         setShowRenameDialog(true)
                       }}
                     >
                       <Edit2 size={14} />
                       Rename current
                     </button>
                     <button
                       type="button"
                       className={`${manageMenuItemClassName} text-red-300 hover:bg-red-500/10`}
                       disabled={!currentProfileId || isDefaultProfile}
                       onClick={() => {
                         setShowManageMenu(false)
                         setShowDeleteDialog(true)
                       }}
                     >
                       <Trash2 size={14} />
                       Delete current
                     </button>
                   </div>
                 ) : null}
               </div>
             ) : null}
        </div>

      <InputDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateProfile}
        title="Create Profile"
        message="Enter a name for the new settings profile:"
        placeholder="Profile name"
        confirmText="Create"
        cancelText="Cancel"
      />

      <InputDialog
        isOpen={showRenameDialog}
        onClose={() => setShowRenameDialog(false)}
        onSubmit={handleRenameProfile}
        title="Rename Profile"
        message="Enter a new name for this profile:"
        placeholder="New name"
        confirmText="Rename"
        cancelText="Cancel"
      />

      <ConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDeleteProfile}
        title="Delete Profile"
        message="Are you sure you want to delete this settings profile? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}
