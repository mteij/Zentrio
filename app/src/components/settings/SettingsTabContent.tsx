import { type ComponentType, useCallback, useEffect, useMemo, useState } from 'react'
import { getAuthClient, getClientUrl, getServerUrl, resetAuthClient } from '../../lib/auth-client'
import { getAppTarget } from '../../lib/app-target'
import { apiFetch } from '../../lib/apiFetch'
import { useAuthStore } from '../../stores/authStore'
import { type SettingsScreenModel } from '../../pages/SettingsPage.model'
import type { SettingsPlatform, SettingsSectionDefinition, SettingsTabKey } from './settingsSchema'
import { SettingsRenderer, settingsRendererStyles } from './SettingsRenderer'
import { useAppearanceSettings } from '../../hooks/useAppearanceSettings'
import { useStreamDisplaySettings } from '../../hooks/useStreamDisplaySettings'
import { InputDialog } from '../ui/InputDialog'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('SettingsTabContent')

interface SettingsTabContentProps {
  model: SettingsScreenModel
  platform: SettingsPlatform
  activeTab?: SettingsTabKey
  openOverlaySection?: string
  onOpenOverlay?: (sectionId: string) => void
  onCloseOverlay?: () => void
}

// ─── General ────────────────────────────────────────────────────────────────

type GeneralDialog =
  | 'username'
  | 'email'
  | 'password-current'
  | 'password-new'
  | 'server-url'
  | 'client-url'
  | null

function GeneralTabContent({
  model,
  platform,
  openOverlaySection,
  onOpenOverlay,
  onCloseOverlay,
}: SettingsTabContentProps) {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)

  const [openDialog, setOpenDialog] = useState<GeneralDialog>(null)
  const [serverUrl, setServerUrl] = useState(() => getServerUrl())
  const [clientUrl] = useState(() => getClientUrl())
  const [pendingCurrentPassword, setPendingCurrentPassword] = useState('')

  const handleUsernameChange = useCallback(
    async (newUsername: string) => {
      try {
        await getAuthClient().updateUser({ username: newUsername } as Parameters<
          ReturnType<typeof getAuthClient>['updateUser']
        >[0])
        updateUser({ username: newUsername })
      } catch (e) {
        log.error('Failed to update username', e)
      }
    },
    [updateUser]
  )

  const handleEmailChange = useCallback(async (newEmail: string) => {
    try {
      await getAuthClient().changeEmail({ newEmail })
    } catch (e) {
      log.error('Failed to initiate email change', e)
    }
  }, [])

  const handleCurrentPasswordSubmit = useCallback((currentPassword: string) => {
    setPendingCurrentPassword(currentPassword)
    setOpenDialog('password-new')
  }, [])

  const handleNewPasswordSubmit = useCallback(
    async (newPassword: string) => {
      try {
        await getAuthClient().changePassword({
          currentPassword: pendingCurrentPassword,
          newPassword,
          revokeOtherSessions: false,
        } as Parameters<ReturnType<typeof getAuthClient>['changePassword']>[0])
      } catch (e) {
        log.error('Failed to change password', e)
      } finally {
        setPendingCurrentPassword('')
      }
    },
    [pendingCurrentPassword]
  )

  const handleServerUrlChange = useCallback((url: string) => {
    const trimmed = url.trim()
    localStorage.setItem('zentrio_server_url', trimmed)
    resetAuthClient()
    setServerUrl(trimmed)
  }, [])

  const displayName = user?.username || user?.name || '—'
  const displayEmail = user?.email || '—'

  const sections: SettingsSectionDefinition[] = useMemo(
    () => [
      {
        id: 'general-account',
        title: 'Account',
        scope: 'account' as const,
        items: [
          {
            id: 'general-username',
            kind: 'action' as const,
            label: 'Username',
            description: 'Change your account username.',
            summary: displayName,
            actionLabel: 'Change',
            onActivate: () => setOpenDialog('username'),
          },
          {
            id: 'general-email',
            kind: 'action' as const,
            label: 'Email address',
            description: 'A verification link will be sent to the new address.',
            summary: displayEmail,
            actionLabel: 'Change',
            onActivate: () => setOpenDialog('email'),
          },
          {
            id: 'general-password',
            kind: 'action' as const,
            label: 'Password',
            description: 'Update your account password.',
            actionLabel: 'Change',
            onActivate: () => {
              setPendingCurrentPassword('')
              setOpenDialog('password-current')
            },
          },
        ],
      },
      {
        id: 'general-server',
        title: 'Server Connection',
        scope: 'server' as const,
        items: [
          {
            id: 'general-server-url',
            kind: 'action' as const,
            label: 'Server URL',
            description: 'The address of your Zentrio server.',
            summary: serverUrl,
            actionLabel: 'Change',
            onActivate: () => setOpenDialog('server-url'),
          },
          {
            id: 'general-client-url',
            kind: 'action' as const,
            label: 'Client URL',
            description: 'The base URL used for OAuth callbacks.',
            summary: clientUrl,
            actionLabel: 'Info',
            disabled: true,
            onActivate: () => {},
          },
        ],
      },
    ],
    [displayName, displayEmail, serverUrl, clientUrl]
  )

  return (
    <>
      <SettingsRenderer
        platform={platform}
        sections={sections}
        openOverlaySection={openOverlaySection}
        onOpenOverlay={onOpenOverlay}
        onCloseOverlay={onCloseOverlay}
      />

      <InputDialog
        isOpen={openDialog === 'username'}
        onClose={() => setOpenDialog(null)}
        onSubmit={handleUsernameChange}
        title="Change Username"
        placeholder="New username"
        defaultValue={user?.username ?? ''}
        confirmText="Save"
      />

      <InputDialog
        isOpen={openDialog === 'email'}
        onClose={() => setOpenDialog(null)}
        onSubmit={handleEmailChange}
        title="Change Email"
        message="A verification link will be sent to your new address."
        placeholder="New email address"
        confirmText="Send Verification"
      />

      <InputDialog
        isOpen={openDialog === 'password-current'}
        onClose={() => setOpenDialog(null)}
        onSubmit={handleCurrentPasswordSubmit}
        title="Change Password"
        message="Enter your current password."
        placeholder="Current password"
        inputType="password"
        confirmText="Continue"
      />

      <InputDialog
        isOpen={openDialog === 'password-new'}
        onClose={() => {
          setOpenDialog(null)
          setPendingCurrentPassword('')
        }}
        onSubmit={handleNewPasswordSubmit}
        title="Set New Password"
        placeholder="New password"
        inputType="password"
        confirmText="Save"
        validation={(v) => (v.length < 8 ? 'Password must be at least 8 characters.' : null)}
      />

      <InputDialog
        isOpen={openDialog === 'server-url'}
        onClose={() => setOpenDialog(null)}
        onSubmit={handleServerUrlChange}
        title="Change Server URL"
        placeholder="https://your-server.example.com"
        defaultValue={serverUrl}
        confirmText="Save"
      />
    </>
  )
}

// ─── Appearance ─────────────────────────────────────────────────────────────

function AppearanceTabContent({
  model,
  platform,
  openOverlaySection,
  onOpenOverlay,
  onCloseOverlay,
}: SettingsTabContentProps) {
  const { showImdbRatings, showAgeRatings, save } = useAppearanceSettings(
    model.currentProfileId
  )

  const sections: SettingsSectionDefinition[] = useMemo(
    () => [
      {
        id: 'appearance-media',
        title: 'Media Cards',
        scope: 'settings-profile' as const,
        items: [
          {
            id: 'appearance-imdb',
            kind: 'toggle' as const,
            label: 'Show IMDb ratings',
            description: 'Display IMDb scores on posters and detail previews.',
            checked: showImdbRatings,
            onChange: (checked) => save({ showImdbRatings: checked }),
          },
          {
            id: 'appearance-age',
            kind: 'toggle' as const,
            label: 'Show age ratings',
            description: 'Display content age ratings on cards.',
            checked: showAgeRatings,
            onChange: (checked) => save({ showAgeRatings: checked }),
          },
        ],
      },

    ],
    [showImdbRatings, showAgeRatings, save]
  )

  return (
    <SettingsRenderer
      platform={platform}
      sections={sections}
      openOverlaySection={openOverlaySection}
      onOpenOverlay={onOpenOverlay}
      onCloseOverlay={onCloseOverlay}
    />
  )
}

// ─── Addons ──────────────────────────────────────────────────────────────────

interface AddonEntry {
  id: number
  name: string
  version?: string
  description?: string
  logo_url?: string
  enabled: boolean
}

function AddonsTabContent({
  model,
  platform,
  openOverlaySection,
  onOpenOverlay,
  onCloseOverlay,
}: SettingsTabContentProps) {
  const [addons, setAddons] = useState<AddonEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [installOpen, setInstallOpen] = useState(false)
  const settingsProfileId = model.currentProfileId

  const fetchAddons = useCallback(async () => {
    if (!settingsProfileId) return
    setLoading(true)
    try {
      const res = await apiFetch(`/api/addons/settings-profile/${settingsProfileId}/manage`)
      if (res.ok) {
        const data = await res.json()
        setAddons(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      log.error('Failed to fetch addons', e)
    } finally {
      setLoading(false)
    }
  }, [settingsProfileId])

  useEffect(() => {
    fetchAddons()
  }, [fetchAddons])

  const handleToggleAddon = useCallback(
    async (addonId: number, enabled: boolean) => {
      setAddons((prev) => prev.map((a) => (a.id === addonId ? { ...a, enabled } : a)))
      try {
        await apiFetch(`/api/addons/settings-profile/${settingsProfileId}/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addonId, enabled }),
        })
      } catch (e) {
        log.error('Failed to toggle addon', e)
        fetchAddons()
      }
    },
    [settingsProfileId, fetchAddons]
  )

  const handleRemoveAddon = useCallback(
    async (addonId: number) => {
      setAddons((prev) => prev.filter((a) => a.id !== addonId))
      try {
        await apiFetch(`/api/addons/${addonId}`, { method: 'DELETE' })
      } catch (e) {
        log.error('Failed to remove addon', e)
        fetchAddons()
      }
    },
    [fetchAddons]
  )

  const handleInstallAddon = useCallback(
    async (manifestUrl: string) => {
      try {
        await apiFetch('/api/addons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manifestUrl, settingsProfileId }),
        })
        await fetchAddons()
      } catch (e) {
        log.error('Failed to install addon', e)
      }
    },
    [settingsProfileId, fetchAddons]
  )

  const addonItems = addons.map((addon) => ({
    id: `addon-${addon.id}`,
    kind: 'custom' as const,
    render: (_p: SettingsPlatform) => (
      <div className={settingsRendererStyles.addonRow}>
        {addon.logo_url ? (
          <img
            src={addon.logo_url}
            alt=""
            aria-hidden="true"
            className={settingsRendererStyles.addonRowLogo}
          />
        ) : (
          <div className={settingsRendererStyles.addonRowLogoPlaceholder} aria-hidden="true" />
        )}
        <div className={settingsRendererStyles.addonRowInfo}>
          <div className={settingsRendererStyles.addonRowName}>{addon.name}</div>
          {addon.version ? (
            <div className={settingsRendererStyles.addonRowVersion}>v{addon.version}</div>
          ) : null}
        </div>
        <div className={settingsRendererStyles.addonRowActions}>
          <button
            type="button"
            className={settingsRendererStyles.controlButton}
            style={{ minWidth: 70 }}
            onClick={() => handleToggleAddon(addon.id, !addon.enabled)}
            aria-pressed={addon.enabled}
          >
            {addon.enabled ? 'Disable' : 'Enable'}
          </button>
          <button
            type="button"
            className={`${settingsRendererStyles.controlButton} ${settingsRendererStyles.controlButtonDanger}`}
            onClick={() => handleRemoveAddon(addon.id)}
            aria-label={`Remove ${addon.name}`}
          >
            Remove
          </button>
        </div>
      </div>
    ),
  }))

  const sections: SettingsSectionDefinition[] = useMemo(
    () => [
      {
        id: 'addons-toolbar',
        title: 'Addons',
        scope: 'settings-profile' as const,
        items: [
          {
            id: 'addons-actions',
            kind: 'custom' as const,
            render: () => (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={settingsRendererStyles.controlButton}
                  onClick={() => setInstallOpen(true)}
                >
                  Install Addon
                </button>
              </div>
            ),
          },
          ...(loading
            ? [{ id: 'addons-loading', kind: 'notice' as const, content: 'Loading addons…' }]
            : addons.length === 0
              ? [{ id: 'addons-empty', kind: 'notice' as const, content: 'No addons installed.' }]
              : addonItems),
        ],
      },
      // addonItems is derived from addons — include both in deps
      // eslint-disable-next-line react-hooks/exhaustive-deps
    ],
    [loading, addons]
  )

  return (
    <>
      <SettingsRenderer
        platform={platform}
        sections={sections}
        openOverlaySection={openOverlaySection}
        onOpenOverlay={onOpenOverlay}
        onCloseOverlay={onCloseOverlay}
      />
      <InputDialog
        isOpen={installOpen}
        onClose={() => setInstallOpen(false)}
        onSubmit={handleInstallAddon}
        title="Install Addon"
        message="Enter the manifest URL of the addon you want to install."
        placeholder="https://addon.example.com/manifest.json"
        confirmText="Install"
        validation={(v) => {
          try {
            new URL(v)
            return null
          } catch {
            return 'Please enter a valid URL.'
          }
        }}
      />
    </>
  )
}

// ─── Streaming ───────────────────────────────────────────────────────────────

function StreamingTabContent({
  model,
  platform,
  openOverlaySection,
  onOpenOverlay,
  onCloseOverlay,
}: SettingsTabContentProps) {
  const streamSettings = useStreamDisplaySettings(model.currentProfileId)
  const [introbdDialogOpen, setIntrobdDialogOpen] = useState(false)

  const sections = useMemo<SettingsSectionDefinition[]>(
    () => [
      {
        id: 'streaming-playback',
        title: 'Playback',
        scope: 'settings-profile' as const,
        items: [
          {
            id: 'streaming-autoplay-wait',
            kind: 'range' as const,
            label: 'Auto-play wait time',
            description: 'How long to wait for streams before auto-selecting.',
            value: streamSettings.autoPlayWaitSeconds,
            min: 5,
            max: 30,
            step: 1,
            valueLabel: `${streamSettings.autoPlayWaitSeconds}s`,
            onChange: () => {},
            onCommit: (value) => streamSettings.save({ autoPlayWaitSeconds: value }),
          },
          {
            id: 'streaming-introdb-key',
            kind: 'action' as const,
            label: 'IntroDB API key',
            description: 'Required to use intro skip and timestamp submission.',
            summary: streamSettings.introbdApiKey ? 'Configured' : 'Not configured',
            actionLabel: streamSettings.introbdApiKey ? 'Update' : 'Add Key',
            onActivate: () => setIntrobdDialogOpen(true),
          },
        ],
      },
      {
        id: 'streaming-display',
        title: 'Stream Display',
        scope: 'settings-profile' as const,
        items: [
          {
            id: 'streaming-display-mode',
            kind: 'select' as const,
            label: 'Display mode',
            description: 'Simple shows essentials, advanced shows parsed tags.',
            value: streamSettings.streamDisplayMode,
            options: [
              { value: 'compact-simple', label: 'Compact (Simple)' },
              { value: 'compact-advanced', label: 'Compact (Advanced)' },
              { value: 'classic', label: 'Classic' },
            ],
            onChange: (value) =>
              streamSettings.save({
                streamDisplayMode: value as 'compact-simple' | 'compact-advanced' | 'classic',
              }),
          },
          {
            id: 'streaming-show-addon-name',
            kind: 'toggle' as const,
            label: 'Show addon name',
            description: 'Display the addon source in stream rows.',
            checked: streamSettings.showAddonName,
            onChange: (checked) => streamSettings.save({ showAddonName: checked }),
          },
          {
            id: 'streaming-show-description',
            kind: 'toggle' as const,
            label: 'Show descriptions',
            description: 'Display parsed stream descriptions in the picker.',
            checked: streamSettings.showDescription,
            onChange: (checked) => streamSettings.save({ showDescription: checked }),
          },
        ],
      },
      {
        id: 'streaming-filtering',
        title: 'Sorting and Filtering',
        scope: 'settings-profile' as const,
        mobileOverlay: platform === 'standard' && getAppTarget().isMobile,
        items: [
          {
            id: 'streaming-filter-notice',
            kind: 'notice' as const,
            content:
              'Advanced sorting and filtering can be configured from the stream picker during playback.',
          },
        ],
      },
    ],
    [streamSettings, platform]
  )

  return (
    <>
      <SettingsRenderer
        platform={platform}
        sections={sections}
        openOverlaySection={openOverlaySection}
        onOpenOverlay={onOpenOverlay}
        onCloseOverlay={onCloseOverlay}
      />
      <InputDialog
        isOpen={introbdDialogOpen}
        onClose={() => setIntrobdDialogOpen(false)}
        onSubmit={(key) => streamSettings.save({ introbdApiKey: key })}
        title="IntroDB API Key"
        message="Enter your IntroDB API key to enable intro skip and timestamp submission."
        placeholder="Your API key"
        defaultValue={streamSettings.introbdApiKey}
        confirmText="Save"
      />
    </>
  )
}

// ─── Downloads ───────────────────────────────────────────────────────────────

function readBool(key: string, defaultValue: boolean): boolean {
  const stored = localStorage.getItem(key)
  return stored === null ? defaultValue : stored === 'true'
}

function DownloadsTabContent({
  model: _model,
  platform,
  openOverlaySection,
  onOpenOverlay,
  onCloseOverlay,
}: SettingsTabContentProps) {
  const [enabled, setEnabled] = useState(() => readBool('zentrio_downloads_enabled', true))
  const [wifiOnly, setWifiOnly] = useState(() => readBool('zentrio_download_wifi_only', true))
  const [quality, setQuality] = useState(
    () => localStorage.getItem('download_quality_pref') ?? 'auto'
  )

  const handleEnabledChange = (checked: boolean) => {
    localStorage.setItem('zentrio_downloads_enabled', String(checked))
    setEnabled(checked)
  }

  const handleWifiOnlyChange = (checked: boolean) => {
    localStorage.setItem('zentrio_download_wifi_only', String(checked))
    setWifiOnly(checked)
  }

  const handleQualityChange = (value: string) => {
    localStorage.setItem('download_quality_pref', value)
    setQuality(value)
  }

  const sections: SettingsSectionDefinition[] = useMemo(
    () => [
      {
        id: 'downloads-policy',
        title: 'Downloads',
        scope: 'device' as const,
        items: [
          {
            id: 'downloads-enabled',
            kind: 'toggle' as const,
            label: 'Enable downloads',
            description: 'Allow content to be saved for offline viewing.',
            checked: enabled,
            onChange: handleEnabledChange,
          },
          {
            id: 'downloads-quality',
            kind: 'select' as const,
            label: 'Download quality',
            description: 'Default quality level for downloaded content.',
            value: quality,
            options: [
              { value: 'auto', label: 'Auto' },
              { value: 'standard', label: 'Standard' },
              { value: 'hd', label: 'HD' },
            ],
            onChange: handleQualityChange,
            disabled: !enabled,
          },
          {
            id: 'downloads-wifi-only',
            kind: 'toggle' as const,
            label: 'Wi-Fi only',
            description: 'Only download when connected to Wi-Fi.',
            checked: wifiOnly,
            onChange: handleWifiOnlyChange,
            disabled: !enabled,
          },
        ],
      },
    ],
    [enabled, quality, wifiOnly]
  )

  return (
    <SettingsRenderer
      platform={platform}
      sections={sections}
      openOverlaySection={openOverlaySection}
      onOpenOverlay={onOpenOverlay}
      onCloseOverlay={onCloseOverlay}
    />
  )
}

// ─── Danger Zone ─────────────────────────────────────────────────────────────

function DangerTabContent({
  platform,
  openOverlaySection,
  onOpenOverlay,
  onCloseOverlay,
}: SettingsTabContentProps) {
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const displayName = user?.username || user?.name || 'your username'

  const handleDeleteAccount = useCallback(
    async (typed: string) => {
      if (typed.trim() !== (user?.username || user?.name || '').trim()) return
      setDeleting(true)
      try {
        const client = getAuthClient() as any
        if (typeof client.deleteUser === 'function') {
          await client.deleteUser()
        }
        await logout()
      } catch (e) {
        log.error('Failed to delete account', e)
      } finally {
        setDeleting(false)
      }
    },
    [user, logout]
  )

  const sections: SettingsSectionDefinition[] = useMemo(
    () => [
      {
        id: 'danger-account',
        title: 'Account',
        scope: 'account' as const,
        items: [
          {
            id: 'danger-account-warning',
            kind: 'notice' as const,
            tone: 'danger' as const,
            content:
              'Deleting your account permanently removes your profile, settings, and all associated data. This cannot be undone.',
          },
          {
            id: 'danger-account-delete',
            kind: 'action' as const,
            label: 'Delete account',
            description: 'Remove your account and all associated data.',
            actionLabel: 'Delete Account',
            variant: 'danger' as const,
            saving: deleting,
            onActivate: () => setConfirmOpen(true),
          },
        ],
      },
    ],
    [deleting]
  )

  return (
    <>
      <SettingsRenderer
        platform={platform}
        sections={sections}
        openOverlaySection={openOverlaySection}
        onOpenOverlay={onOpenOverlay}
        onCloseOverlay={onCloseOverlay}
      />
      <InputDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onSubmit={handleDeleteAccount}
        title="Delete Account"
        message={`This action is permanent and cannot be undone. Type "${displayName}" to confirm.`}
        placeholder={displayName}
        confirmText="Delete Account"
        validation={(v) =>
          v.trim() !== (user?.username || user?.name || '').trim()
            ? `Type "${displayName}" to confirm.`
            : null
        }
      />
    </>
  )
}

// ─── Router ──────────────────────────────────────────────────────────────────

const SETTINGS_TAB_COMPONENTS: Record<SettingsTabKey, ComponentType<SettingsTabContentProps>> = {
  general: GeneralTabContent,
  appearance: AppearanceTabContent,
  addons: AddonsTabContent,
  streaming: StreamingTabContent,
  downloads: DownloadsTabContent,
  danger: DangerTabContent,
}

export function SettingsTabContent(props: SettingsTabContentProps) {
  const activeTab = props.activeTab ?? props.model.effectiveTab
  const TabComponent = SETTINGS_TAB_COMPONENTS[activeTab]
  return <TabComponent {...props} />
}
