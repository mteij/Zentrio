
import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2 } from 'lucide-react'
import { Button, InputDialog, ConfirmDialog } from '../index'
import { apiFetch } from '../../lib/apiFetch'

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
  label?: string
  layout?: 'row' | 'column'
}

export function SettingsProfileSelector({ 
    currentProfileId, 
    onProfileChange, 
    onProfilesLoaded, 
    disabled = false,
    label = "Profile",
    layout = 'row'
}: SettingsProfileSelectorProps) {
  const [profiles, setProfiles] = useState<SettingsProfile[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProfiles()
  }, [])

  const loadProfiles = async () => {
    try {
      const res = await apiFetch('/api/user/settings-profiles')
      if (res.ok) {
        const data = await res.json()
        const profilesList = data.data || data || []
        setProfiles(profilesList)
        onProfilesLoaded?.(profilesList)
      }
    } catch (e) {
      console.error('Failed to load profiles', e)
    }
  }

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
      console.error(e)
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
      console.error(e)
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
      console.error(e)
      setError("Network error")
    }
  }

  // Find current profile to check if default
  const currentProfile = profiles.find(p => String(p.id) === String(currentProfileId))
  const isDefaultProfile = currentProfile?.name === 'Default' || currentProfile?.is_default

  return (
    <div className={`flex ${layout === 'column' ? 'flex-col items-start gap-2' : 'items-center gap-4'} w-full`}>
       {label && (
         <div className="flex flex-col">
            <h3 className="text-lg font-medium text-white mb-1">{label}</h3>
            <p className="text-sm text-zinc-400">Select profile to configure.</p>
         </div>
       )}
       
       <div className="flex items-center gap-2 ml-auto">
            {error && <div className="text-red-400 text-sm mr-2">{error}</div>}
            
            <select 
                value={currentProfileId} 
                onChange={(e) => onProfileChange(e.target.value)}
                disabled={disabled}
                className="bg-zinc-800 text-white border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500 transition-colors min-w-[150px]"
            >
                {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                ))}
            </select>
            
            <Button 
                variant="secondary" 
                onClick={() => setShowCreateDialog(true)} 
                title="Create new profile"
                disabled={disabled}
            >
                <Plus size={16} />
            </Button>
            
            {!isDefaultProfile && currentProfileId && (
                <>
                <Button 
                    variant="secondary" 
                    onClick={() => setShowRenameDialog(true)} 
                    title="Rename profile"
                    disabled={disabled}
                >
                    <Edit2 size={16} />
                </Button>
                <Button 
                    variant="danger" 
                    onClick={() => setShowDeleteDialog(true)} 
                    title="Delete profile"
                    disabled={disabled}
                >
                    <Trash2 size={16} />
                </Button>
                </>
            )}
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
