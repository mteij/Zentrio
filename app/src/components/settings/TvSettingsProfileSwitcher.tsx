import { Check, ChevronRight, Pencil, Plus, Settings2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { apiFetch } from '../../lib/apiFetch'
import { createLogger } from '../../utils/client-logger'
import { InputDialog, ConfirmDialog } from '../index'
import { TvFocusItem, TvFocusScope, TvFocusZone, useTvFocus } from '../tv'
import styles from './TvSettingsProfileSwitcher.module.css'

const log = createLogger('TvSettingsProfileSwitcher')

interface SettingsProfile {
  id: string
  name: string
  is_default?: boolean
}

interface TvSettingsProfileSwitcherProps {
  zoneId: string
  currentProfileId: string
  currentProfileName: string
  onProfileChange: (id: string) => void
  onProfilesLoaded?: (profiles: SettingsProfile[]) => void
  onMenuOpenChange?: (open: boolean) => void
  requestCloseSignal?: number
  nextDown?: string
  nextRight?: string
}

export function TvSettingsProfileSwitcher({
  zoneId,
  currentProfileId,
  currentProfileName,
  onProfileChange,
  onProfilesLoaded,
  onMenuOpenChange,
  requestCloseSignal,
  nextDown,
  nextRight,
}: TvSettingsProfileSwitcherProps) {
  const { focusItem } = useTvFocus()
  const [profiles, setProfiles] = useState<SettingsProfile[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState(currentProfileId)
  const [isCreateFocused, setIsCreateFocused] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const loadProfiles = useCallback(async () => {
    try {
      const res = await apiFetch('/api/user/settings-profiles')
      if (!res.ok) return []

      const data = await res.json()
      const profilesList: SettingsProfile[] = data.data || data || []
      setProfiles(profilesList)
      onProfilesLoadedRef.current?.(profilesList)
      return profilesList
    } catch (error) {
      log.error('Failed to load settings profiles', error)
      return []
    }
  }, []) // using ref for onProfilesLoaded to avoid infinite loop

  const onProfilesLoadedRef = useRef(onProfilesLoaded)
  useEffect(() => {
    onProfilesLoadedRef.current = onProfilesLoaded
  }, [onProfilesLoaded])

  useEffect(() => {
    void loadProfiles()
  }, [loadProfiles])

  useEffect(() => {
    if (!isOpen) {
      setSelectedProfileId(currentProfileId)
    }
  }, [currentProfileId, isOpen])

  useEffect(() => {
    onMenuOpenChange?.(isOpen)
  }, [isOpen, onMenuOpenChange])

  useEffect(() => {
    if (!isOpen) return
    closeDialog()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestCloseSignal])

  const selectedProfile = profiles.find((profile) => String(profile.id) === String(selectedProfileId)) || null
  const isDefaultProfile = selectedProfile?.name === 'Default' || selectedProfile?.is_default
  const canRenameOrDelete = !!selectedProfile && !isDefaultProfile

  const closeDialog = () => {
    setIsOpen(false)
    setSelectedProfileId(currentProfileId)
    setIsCreateFocused(false)
  }

  const handleUseSelected = () => {
    if (!selectedProfileId) return
    onProfileChange(String(selectedProfileId))
    setIsOpen(false)
  }

  const handleProfileActivate = (profileId: string) => {
    setSelectedProfileId(profileId)
    window.requestAnimationFrame(() => {
      focusItem('tv-settings-profiles-use')
    })
  }

  const handleCreateProfile = async (name: string) => {
    try {
      const res = await apiFetch('/api/user/settings-profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ name }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      const newId = String(data?.data?.id || '')
      await loadProfiles()
      if (newId) {
        onProfileChange(newId)
      }
      setIsCreateFocused(false)
      setIsOpen(false)
    } catch (error) {
      log.error('Failed to create settings profile', error)
    }
  }

  const handleRenameProfile = async (name: string) => {
    if (!selectedProfileId) return

    try {
      const res = await apiFetch(`/api/user/settings-profiles/${selectedProfileId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ name }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      await loadProfiles()
      setIsCreateFocused(false)
    } catch (error) {
      log.error('Failed to rename settings profile', error)
    }
  }

  const handleDeleteProfile = async () => {
    if (!selectedProfileId) return

    try {
      const res = await apiFetch(`/api/user/settings-profiles/${selectedProfileId}`, {
        method: 'DELETE',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const deletedId = selectedProfileId
      const nextProfiles = await loadProfiles()

      const fallback = nextProfiles.find((profile) => String(profile.id) !== String(deletedId))
      if (String(currentProfileId) === String(deletedId)) {
        onProfileChange(fallback ? String(fallback.id) : '')
      }

      setSelectedProfileId(fallback ? String(fallback.id) : '')
      setIsCreateFocused(false)
    } catch (error) {
      log.error('Failed to delete settings profile', error)
    }
  }

  return (
    <>
      <TvFocusZone id={zoneId} orientation="vertical" nextDown={nextDown} nextRight={nextRight} className={styles.triggerZone}>
        <TvFocusItem
          id={`${zoneId}-trigger`}
          className={styles.triggerButton}
          onActivate={() => setIsOpen(true)}
          aria-label={`Settings profile, ${currentProfileName}`}
        >
          <span className={styles.triggerIcon} aria-hidden="true">
            <Settings2 size={20} />
          </span>
          <span className={styles.triggerValue}>{currentProfileName}</span>
          <span className={styles.triggerHint} aria-hidden="true">
            <ChevronRight size={18} />
          </span>
        </TvFocusItem>
      </TvFocusZone>

      {isOpen && typeof document !== 'undefined' ? createPortal(
        <div className={styles.fullscreenBackdrop}>
          <TvFocusScope initialZoneId="tv-settings-profiles-list" onBack={closeDialog}>
            <div className={styles.fullscreenSurface} role="dialog" aria-modal="true" aria-label="Settings Profiles">
              <div className={styles.fullscreenHeader}>
                <div className={styles.dialogHeader}>
                  <h2 className={styles.dialogTitle}>Settings Profiles</h2>
                </div>
              </div>

              <div className={styles.fullscreenBody}>
                <TvFocusZone
                  id="tv-settings-profiles-list"
                  orientation="vertical"
                  nextRight="tv-settings-profiles-actions"
                >
                  <div className={styles.profilePanel}>
                    <div className={styles.profileList}>
                      {profiles.length === 0 ? (
                        <p className={styles.emptyState}>No settings profiles available yet.</p>
                      ) : (
                        profiles.map((profile, index) => {
                          const isSelected = String(profile.id) === String(selectedProfileId)
                          const isCurrent = String(profile.id) === String(currentProfileId)

                          return (
                            <TvFocusItem
                              key={profile.id}
                              id={`tv-settings-profile-${profile.id}`}
                              index={index}
                              className={`${styles.profileCard} ${isSelected ? styles.profileCardSelected : ''}`}
                              onFocus={() => {
                                setSelectedProfileId(String(profile.id))
                                setIsCreateFocused(false)
                              }}
                              onActivate={() => handleProfileActivate(String(profile.id))}
                              aria-label={`${profile.name}${isCurrent ? ', current profile' : ''}`}
                            >
                              <span className={styles.profileName}>{profile.name}</span>
                              {isCurrent ? (
                                <span className={`${styles.profileMeta} ${styles.profileMetaCurrent}`}>
                                  Current
                                </span>
                              ) : null}
                            </TvFocusItem>
                          )
                        })
                      )}
                    </div>

                    <TvFocusItem
                      id="tv-settings-profiles-create"
                      index={profiles.length}
                      className={styles.createButton}
                      onFocus={() => setIsCreateFocused(true)}
                      onActivate={() => setShowCreateDialog(true)}
                    >
                      <Plus size={16} />
                      <span>Create Profile</span>
                    </TvFocusItem>
                  </div>
                </TvFocusZone>

                <TvFocusZone
                  id="tv-settings-profiles-actions"
                  orientation="vertical"
                  nextLeft="tv-settings-profiles-list"
                >
                  <div className={`${styles.actionsColumn} ${isCreateFocused ? styles.actionsColumnCollapsed : ''}`}>
                    <TvFocusItem
                      id="tv-settings-profiles-use"
                      className={`${styles.actionButton} ${styles.actionPrimary}`}
                      onFocus={() => setIsCreateFocused(false)}
                      onActivate={handleUseSelected}
                      disabled={!selectedProfileId}
                    >
                      <Check size={16} />
                      <span>Use Profile</span>
                    </TvFocusItem>
                    <TvFocusItem
                      id="tv-settings-profiles-rename"
                      className={styles.actionButton}
                      onFocus={() => setIsCreateFocused(false)}
                      onActivate={() => setShowRenameDialog(true)}
                      disabled={!canRenameOrDelete}
                    >
                      <Pencil size={16} />
                      <span>Rename</span>
                    </TvFocusItem>
                    <TvFocusItem
                      id="tv-settings-profiles-delete"
                      className={`${styles.actionButton} ${styles.actionDanger}`}
                      onFocus={() => setIsCreateFocused(false)}
                      onActivate={() => setShowDeleteDialog(true)}
                      disabled={!canRenameOrDelete}
                    >
                      <Trash2 size={16} />
                      <span>Delete</span>
                    </TvFocusItem>
                  </div>
                </TvFocusZone>
              </div>
            </div>
          </TvFocusScope>
        </div>,
        document.body,
      ) : null}

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
        message="Enter a new name for this settings profile:"
        placeholder="New name"
        defaultValue={selectedProfile?.name || ''}
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
    </>
  )
}

export default TvSettingsProfileSwitcher
