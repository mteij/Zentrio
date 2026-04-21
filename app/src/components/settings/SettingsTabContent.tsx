import { type ComponentType, useCallback, useEffect, useMemo, useState } from 'react'
import {
  getAuthClient,
  getServerUrl,
  isOfficialZentrioServer,
  resetAuthClient,
} from '../../lib/auth-client'
import { getAppTarget } from '../../lib/app-target'
import { apiFetch } from '../../lib/apiFetch'
import { useAuthStore } from '../../stores/authStore'
import { type SettingsScreenModel } from '../../pages/SettingsPage.model'
import type { SettingsPlatform, SettingsSectionDefinition, SettingsTabKey } from './settingsSchema'
import { SettingsRenderer, settingsRendererStyles } from './SettingsRenderer'
import { useAppearanceSettings } from '../../hooks/useAppearanceSettings'
import { useStreamDisplaySettings } from '../../hooks/useStreamDisplaySettings'
import { useStreamFilterSettings } from '../../hooks/useStreamFilterSettings'
import { InputDialog } from '../ui/InputDialog'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { createLogger } from '../../utils/client-logger'
import { AddonManager } from './AddonManager'
import { TvAddonManager } from './TvAddonManager'
import { Toggle } from '../ui/Toggle'
import type { StreamConfig } from '../../services/addons/stream-processor'
import { isTauriRuntime } from '../../lib/runtime-env'
import { toast } from '../../utils/toast'

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
  | 'server-url-confirm'
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
  const reset = useAuthStore((s) => s.reset)

  const [openDialog, setOpenDialog] = useState<GeneralDialog>(null)
  const [serverUrl, setServerUrl] = useState(() => getServerUrl())
  const [pendingServerUrl, setPendingServerUrl] = useState<string | null>(null)
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

  const handleServerUrlChange = useCallback(
    (url: string) => {
      const trimmed = url.trim()
      if (trimmed === serverUrl) {
        setOpenDialog(null)
        return
      }
      setPendingServerUrl(trimmed)
      setOpenDialog('server-url-confirm')
    },
    [serverUrl]
  )

  const handleServerUrlConfirm = useCallback(() => {
    if (!pendingServerUrl) return
    const wasAuthenticated = !!user
    localStorage.setItem('zentrio_server_url', pendingServerUrl)
    resetAuthClient()
    setServerUrl(pendingServerUrl)
    if (wasAuthenticated) {
      reset()
      localStorage.removeItem('zentrio-auth-storage')
      toast.info('Server changed. Please sign in again.')
      window.location.href = '/'
    }
    setPendingServerUrl(null)
    setOpenDialog(null)
  }, [pendingServerUrl, user, reset])

  const handleServerUrlCancel = useCallback(() => {
    setPendingServerUrl(null)
    setOpenDialog(null)
  }, [])

  const displayName = user?.username || user?.name || '—'
  const displayEmail = user?.email || '—'
  const isTauri = isTauriRuntime()

  const sections: SettingsSectionDefinition[] = useMemo(() => {
    const result: SettingsSectionDefinition[] = [
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
    ]

    if (isTauri) {
      result.push({
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
        ],
      })
    }

    return result
  }, [displayName, displayEmail, serverUrl, isTauri])

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
        confirmText="Continue"
      />

      <ConfirmDialog
        isOpen={openDialog === 'server-url-confirm'}
        onClose={handleServerUrlCancel}
        onConfirm={handleServerUrlConfirm}
        title="Change Server?"
        message={`Changing servers will sign you out. Your progress is saved on the current server and will be available when you switch back. Switch to ${pendingServerUrl || 'the new server'}?`}
        confirmText="Switch Server"
        cancelText="Cancel"
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
  const { showImdbRatings, showAgeRatings, save } = useAppearanceSettings(model.currentProfileId)

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
            onChange: (checked: boolean) => save({ showImdbRatings: checked }),
          },
          {
            id: 'appearance-age',
            kind: 'toggle' as const,
            label: 'Show age ratings',
            description: 'Display content age ratings on cards.',
            checked: showAgeRatings,
            onChange: (checked: boolean) => save({ showAgeRatings: checked }),
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

function AddonsTabContent({ model, platform }: SettingsTabContentProps) {
  const settingsProfileId = model.currentProfileId

  if (!settingsProfileId) {
    return <div style={{ padding: 16, color: '#888' }}>No profile selected.</div>
  }

  if (platform === 'tv') {
    return <TvAddonManager currentProfileId={settingsProfileId} onProfileChange={() => {}} />
  }

  return <AddonManager currentProfileId={settingsProfileId} onProfileChange={() => {}} />
}

// ─── Streaming ───────────────────────────────────────────────────────────────

const RESOLUTIONS = ['4k', '1080p', '720p', '480p']
const ENCODES = ['hevc', 'avc', 'av1']
const VISUAL_TAGS = ['hdr', 'dv', '10bit']
const AUDIO_TAGS = ['atmos', 'dts', 'truehd', 'eac3', 'ac3', 'aac', 'flac']
const SOURCE_TYPES = ['bluray', 'web', 'hdtv', 'unknown', 'telesync', 'cam']
const STREAM_TYPES = ['http', 'p2p', 'debrid']
const SORT_OPTIONS = [
  { id: 'cached', label: 'Cached' },
  { id: 'resolution', label: 'Resolution' },
  { id: 'sourceType', label: 'Source Type' },
  { id: 'encode', label: 'Encode' },
  { id: 'visualTag', label: 'Visual Tags' },
  { id: 'audioTag', label: 'Audio Tags' },
  { id: 'audioChannels', label: 'Audio Channels' },
  { id: 'seeders', label: 'Seeders' },
  { id: 'size', label: 'Size' },
  { id: 'language', label: 'Language' },
]

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = `collapsible-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: open ? 'rgba(255,255,255,0.05)' : 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.75)',
          cursor: 'pointer',
          fontSize: '0.82rem',
          fontWeight: 600,
          textAlign: 'left',
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
        }}
      >
        <span>{title}</span>
        <span aria-hidden="true" style={{
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          color: 'rgba(255,255,255,0.3)',
          fontSize: '0.7rem',
        }}>
          ▶
        </span>
      </button>
      {open && (
        <div
          id={contentId}
          role="region"
          aria-label={title}
          style={{ padding: '10px 14px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '6px 0',
    }}>
      <span style={{
        fontSize: '0.88rem',
        color: 'rgba(255,255,255,0.8)',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
      }}>{label}</span>
      <Toggle checked={checked} onChange={onChange} title={label} />
    </div>
  )
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt])
  }
  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{
        fontSize: '0.68rem',
        fontWeight: 700,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.4)',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        marginBottom: 8,
      }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={selected.includes(opt)}
            onClick={() => toggle(opt)}
            style={{
              padding: '0 12px',
              minHeight: 36,
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: 10,
              border: selected.includes(opt) ? '1px solid rgba(139,92,246,0.6)' : '1px solid rgba(255,255,255,0.1)',
              background: selected.includes(opt) ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
              color: selected.includes(opt) ? '#c4b5fd' : 'rgba(255,255,255,0.55)',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
              textTransform: 'capitalize',
              fontWeight: selected.includes(opt) ? 600 : 400,
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function SortOrderEditor({
  items,
  onChange,
  platform,
}: {
  items: { id: string; enabled: boolean; direction: 'asc' | 'desc' }[]
  onChange: (items: { id: string; enabled: boolean; direction: 'asc' | 'desc' }[]) => void
  platform?: SettingsPlatform
}) {
  const move = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= items.length) return
    const next = [...items]
    const [item] = next.splice(idx, 1)
    next.splice(newIdx, 0, item)
    onChange(next)
  }

  const btnBase: React.CSSProperties = {
    minWidth: 44,
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  }

  return (
    <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, idx) => {
        const meta = SORT_OPTIONS.find((o) => o.id === item.id)
        const label = meta?.label || item.id
        return (
          <div
            key={item.id}
            role="listitem"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') { e.preventDefault(); move(idx, -1) }
              else if (e.key === 'ArrowDown') { e.preventDefault(); move(idx, 1) }
            }}
            aria-label={`${label}, position ${idx + 1} of ${items.length}, ${item.enabled ? 'enabled' : 'disabled'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 4px',
              borderRadius: 10,
              background: item.enabled ? 'rgba(139,92,246,0.08)' : 'transparent',
              opacity: item.enabled ? 1 : 0.45,
              outline: 'none',
              borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}
          >
            <span aria-hidden="true" style={{
              fontSize: '0.7rem',
              color: 'rgba(255,255,255,0.25)',
              width: 18,
              textAlign: 'center',
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
            }}>{idx + 1}</span>
            <span style={{
              flex: 1,
              fontSize: '0.88rem',
              color: 'rgba(255,255,255,0.85)',
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
              fontWeight: 500,
            }}>{label}</span>
            <button
              type="button"
              aria-label={`${item.direction === 'desc' ? 'Descending' : 'Ascending'} – toggle direction for ${label}`}
              aria-pressed={item.direction === 'desc'}
              onClick={() =>
                onChange(
                  items.map((it, i) =>
                    i === idx ? { ...it, direction: it.direction === 'desc' ? 'asc' : 'desc' } : it
                  )
                )
              }
              style={{ ...btnBase, color: 'rgba(255,255,255,0.65)' }}
            >
              {item.direction === 'desc' ? '↓' : '↑'}
            </button>
            <button
              type="button"
              aria-label={`Move ${label} up`}
              onClick={() => move(idx, -1)}
              disabled={idx === 0}
              style={{ ...btnBase, color: idx === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.65)', cursor: idx === 0 ? 'default' : 'pointer' }}
            >
              ▲
            </button>
            <button
              type="button"
              aria-label={`Move ${label} down`}
              onClick={() => move(idx, 1)}
              disabled={idx === items.length - 1}
              style={{ ...btnBase, color: idx === items.length - 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.65)', cursor: idx === items.length - 1 ? 'default' : 'pointer' }}
            >
              ▼
            </button>
            <input
              type="checkbox"
              id={`sort-enable-${item.id}`}
              checked={item.enabled}
              onChange={(e) =>
                onChange(
                  items.map((it, i) => (i === idx ? { ...it, enabled: e.target.checked } : it))
                )
              }
              aria-label={`Enable ${label} sorting`}
              style={{ width: 20, height: 20, cursor: 'pointer' }}
            />
          </div>
        )
      })}
    </div>
  )
}

function StreamingTabContent({
  model,
  platform,
  openOverlaySection,
  onOpenOverlay,
  onCloseOverlay,
}: SettingsTabContentProps) {
  const streamSettings = useStreamDisplaySettings(model.currentProfileId)
  const filterSettings = useStreamFilterSettings(model.currentProfileId)
  const [introbdDialogOpen, setIntrobdDialogOpen] = useState(false)
  const { config, loading, save, reset } = filterSettings

  const updateFilters = useCallback(
    (patch: Partial<StreamConfig['filters']>) => {
      save({ filters: { ...config.filters, ...patch } })
    },
    [config, save]
  )

  const updateLimits = useCallback(
    (patch: Partial<StreamConfig['limits']>) => {
      save({ limits: { ...config.limits, ...patch } })
    },
    [config.limits, save]
  )

  const updateDedup = useCallback(
    (patch: Partial<StreamConfig['deduplication']>) => {
      save({ deduplication: { ...config.deduplication, ...patch } })
    },
    [config.deduplication, save]
  )

  const updateSortingConfig = useCallback(
    (items: { id: string; enabled: boolean; direction: 'asc' | 'desc' }[]) => {
      save({ sortingConfig: { items } })
    },
    [save]
  )

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
            onChange: (value: string) =>
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
            onChange: (checked: boolean) => streamSettings.save({ showAddonName: checked }),
          },
          {
            id: 'streaming-show-description',
            kind: 'toggle' as const,
            label: 'Show descriptions',
            description: 'Display parsed stream descriptions in the picker.',
            checked: streamSettings.showDescription,
            onChange: (checked: boolean) => streamSettings.save({ showDescription: checked }),
          },
        ],
      },
      {
        id: 'streaming-advanced',
        title: 'Advanced Filtering & Sorting',
        scope: 'settings-profile' as const,
        mobileOverlay: platform === 'standard' && getAppTarget().isMobile,
        items: [
          {
            id: 'streaming-advanced-content',
            kind: 'custom' as const,
            render: (platform) => (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CollapsibleSection title="Sort Order">
                  {loading ? (
                    <span style={{ fontSize: 13, color: '#666' }}>Loading…</span>
                  ) : (
                    <SortOrderEditor
                      items={config.sortingConfig?.items || []}
                      onChange={updateSortingConfig}
                      platform={platform}
                    />
                  )}
                </CollapsibleSection>
                <CollapsibleSection title="Resolution">
                  {loading ? (
                    <span style={{ fontSize: 13, color: '#666' }}>Loading…</span>
                  ) : (
                    <MultiSelect
                      label="Preferred (order = priority)"
                      options={RESOLUTIONS}
                      selected={config.filters?.resolution?.preferred || []}
                      onChange={(vals) =>
                        updateFilters({
                          resolution: { ...config.filters?.resolution, preferred: vals },
                        })
                      }
                    />
                  )}
                </CollapsibleSection>
                <CollapsibleSection title="Encode">
                  {loading ? (
                    <span style={{ fontSize: 13, color: '#666' }}>Loading…</span>
                  ) : (
                    <>
                      <MultiSelect
                        label="Required"
                        options={ENCODES}
                        selected={config.filters?.encode?.required || []}
                        onChange={(vals) =>
                          updateFilters({ encode: { ...config.filters?.encode, required: vals } })
                        }
                      />
                      <MultiSelect
                        label="Excluded"
                        options={ENCODES}
                        selected={config.filters?.encode?.excluded || []}
                        onChange={(vals) =>
                          updateFilters({ encode: { ...config.filters?.encode, excluded: vals } })
                        }
                      />
                    </>
                  )}
                </CollapsibleSection>
                <CollapsibleSection title="Visual Tags">
                  {loading ? (
                    <span style={{ fontSize: 13, color: '#666' }}>Loading…</span>
                  ) : (
                    <>
                      <MultiSelect
                        label="Required"
                        options={VISUAL_TAGS}
                        selected={config.filters?.visualTag?.required || []}
                        onChange={(vals) =>
                          updateFilters({
                            visualTag: { ...config.filters?.visualTag, required: vals },
                          })
                        }
                      />
                      <MultiSelect
                        label="Excluded"
                        options={VISUAL_TAGS}
                        selected={config.filters?.visualTag?.excluded || []}
                        onChange={(vals) =>
                          updateFilters({
                            visualTag: { ...config.filters?.visualTag, excluded: vals },
                          })
                        }
                      />
                    </>
                  )}
                </CollapsibleSection>
                <CollapsibleSection title="Audio Tags">
                  {loading ? (
                    <span style={{ fontSize: 13, color: '#666' }}>Loading…</span>
                  ) : (
                    <>
                      <MultiSelect
                        label="Required"
                        options={AUDIO_TAGS}
                        selected={config.filters?.audioTag?.required || []}
                        onChange={(vals) =>
                          updateFilters({
                            audioTag: { ...config.filters?.audioTag, required: vals },
                          })
                        }
                      />
                      <MultiSelect
                        label="Excluded"
                        options={AUDIO_TAGS}
                        selected={config.filters?.audioTag?.excluded || []}
                        onChange={(vals) =>
                          updateFilters({
                            audioTag: { ...config.filters?.audioTag, excluded: vals },
                          })
                        }
                      />
                    </>
                  )}
                </CollapsibleSection>
                <CollapsibleSection title="Cache / Debrid">
                  {loading ? (
                    <span style={{ fontSize: 13, color: '#666' }}>Loading…</span>
                  ) : (
                    (() => {
                      const cache = config.filters?.cache || {
                        cached: true,
                        uncached: true,
                        applyMode: 'OR' as const,
                      }
                      return (
                        <div style={{ display: 'flex', gap: 16 }}>
                          <ToggleRow
                            label="Show cached"
                            checked={cache.cached}
                            onChange={(v) => updateFilters({ cache: { ...cache, cached: v } })}
                          />
                          <ToggleRow
                            label="Show uncached"
                            checked={cache.uncached}
                            onChange={(v) => updateFilters({ cache: { ...cache, uncached: v } })}
                          />
                        </div>
                      )
                    })()
                  )}
                </CollapsibleSection>
                <CollapsibleSection title="Source Type">
                  {loading ? (
                    <span style={{ fontSize: 13, color: '#666' }}>Loading…</span>
                  ) : (
                    <>
                      <MultiSelect
                        label="Required"
                        options={SOURCE_TYPES}
                        selected={config.filters?.sourceType?.required || []}
                        onChange={(vals) =>
                          updateFilters({
                            sourceType: { ...config.filters?.sourceType, required: vals },
                          })
                        }
                      />
                      <MultiSelect
                        label="Excluded (e.g. hide CAM/TS)"
                        options={SOURCE_TYPES}
                        selected={config.filters?.sourceType?.excluded || []}
                        onChange={(vals) =>
                          updateFilters({
                            sourceType: { ...config.filters?.sourceType, excluded: vals },
                          })
                        }
                      />
                    </>
                  )}
                </CollapsibleSection>
                <CollapsibleSection title="Stream Type">
                  {loading ? (
                    <span style={{ fontSize: 13, color: '#666' }}>Loading…</span>
                  ) : (
                    <MultiSelect
                      label="Required"
                      options={STREAM_TYPES}
                      selected={config.filters?.streamType?.required || []}
                      onChange={(vals) =>
                        updateFilters({
                          streamType: { ...config.filters?.streamType, required: vals },
                        })
                      }
                    />
                  )}
                </CollapsibleSection>
                <CollapsibleSection title="Limits">
                  {loading ? (
                    <span style={{ fontSize: 13, color: '#666' }}>Loading…</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <div style={{
                          fontSize: '0.8rem',
                          color: 'rgba(255,255,255,0.55)',
                          marginBottom: 6,
                          fontFamily: "'Inter', 'Segoe UI', sans-serif",
                        }}>
                          Max total results:{' '}
                          <strong style={{ color: '#fff' }}>
                            {(config.limits?.maxResults ?? 0) === 0
                              ? 'Unlimited'
                              : config.limits!.maxResults}
                          </strong>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={200}
                          step={10}
                          value={config.limits?.maxResults ?? 0}
                          onChange={(e) => updateLimits({ maxResults: Number(e.target.value) })}
                          style={{ width: '100%', accentColor: 'var(--accent, #e50914)' }}
                        />
                      </div>
                      <div>
                        <div style={{
                          fontSize: '0.8rem',
                          color: 'rgba(255,255,255,0.55)',
                          marginBottom: 6,
                          fontFamily: "'Inter', 'Segoe UI', sans-serif",
                        }}>
                          Per addon:{' '}
                          <strong style={{ color: '#fff' }}>
                            {(config.limits?.perAddon ?? 0) === 0
                              ? 'Unlimited'
                              : config.limits!.perAddon}
                          </strong>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={50}
                          step={1}
                          value={config.limits?.perAddon ?? 0}
                          onChange={(e) => updateLimits({ perAddon: Number(e.target.value) })}
                          style={{ width: '100%', accentColor: 'var(--accent, #e50914)' }}
                        />
                      </div>
                    </div>
                  )}
                </CollapsibleSection>
                <CollapsibleSection title="Deduplication">
                  {loading ? (
                    <span style={{ fontSize: 13, color: '#666' }}>Loading…</span>
                  ) : (
                    <>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          letterSpacing: '0.07em',
                          textTransform: 'uppercase',
                          color: 'rgba(255,255,255,0.4)',
                          fontFamily: "'Inter', 'Segoe UI', sans-serif",
                          marginBottom: 8,
                        }}>Mode</div>
                        <select
                          value={config.deduplication?.mode || 'Per Service'}
                          onChange={(e) =>
                            updateDedup({
                              mode: e.target.value as 'Single Result' | 'Per Service' | 'Per Addon',
                            })
                          }
                          style={{
                            padding: '8px 12px',
                            borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'rgb(16,16,20)',
                            color: '#fff',
                            fontSize: '0.88rem',
                            fontFamily: "'Inter', 'Segoe UI', sans-serif",
                            width: '100%',
                            colorScheme: 'dark',
                          }}
                        >
                          <option value="Single Result">Single Result</option>
                          <option value="Per Service">Per Service</option>
                          <option value="Per Addon">Per Addon</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {(() => {
                          const det = config.deduplication?.detection || {
                            filename: true,
                            infoHash: true,
                            smartDetect: true,
                          }
                          return (
                            <>
                              <ToggleRow
                                label="Filename matching"
                                checked={det.filename}
                                onChange={(v) =>
                                  updateDedup({ detection: { ...det, filename: v } })
                                }
                              />
                              <ToggleRow
                                label="Info hash matching"
                                checked={det.infoHash}
                                onChange={(v) =>
                                  updateDedup({ detection: { ...det, infoHash: v } })
                                }
                              />
                              <ToggleRow
                                label="Smart detect"
                                checked={det.smartDetect}
                                onChange={(v) =>
                                  updateDedup({ detection: { ...det, smartDetect: v } })
                                }
                              />
                            </>
                          )
                        })()}
                      </div>
                    </>
                  )}
                </CollapsibleSection>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={reset}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.65)',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      fontFamily: "'Inter', 'Segoe UI', sans-serif",
                    }}
                  >
                    Reset to defaults
                  </button>
                </div>
              </div>
            ),
          },
        ],
      },
    ],
    [
      streamSettings,
      platform,
      config,
      loading,
      save,
      reset,
      updateFilters,
      updateLimits,
      updateDedup,
      updateSortingConfig,
    ]
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
  const isMobile = getAppTarget().isMobile
  const [enabled, setEnabled] = useState(() => readBool('zentrio_downloads_enabled', true))
  const [wifiOnly, setWifiOnly] = useState(() => readBool('zentrio_download_wifi_only', false))
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
          ...(isMobile
            ? [
                {
                  id: 'downloads-wifi-only',
                  kind: 'toggle' as const,
                  label: 'Wi-Fi only',
                  description: 'Only download when connected to Wi-Fi.',
                  checked: wifiOnly,
                  onChange: handleWifiOnlyChange,
                  disabled: !enabled,
                },
              ]
            : []),
        ],
      },
    ],
    [enabled, isMobile, quality, wifiOnly]
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
