import { useEffect, useState } from 'react'
import { CheckCircle, FolderOpen, HardDrive, Monitor, RotateCcw, Smartphone, Sparkles, Trash2 } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { toast } from 'sonner'
import { apiFetch } from '../../lib/apiFetch'
import { getAppTarget } from '../../lib/app-target'
import { readOfflineDownloadsSettings, type OfflineDownloadsSettings } from '../../lib/offline-downloads'
import { isTauri } from '../../lib/auth-client'
import { downloadService, DownloadQuality, StorageStats } from '../../services/downloads/download-service'
import styles from '../../styles/Settings.module.css'
import { createLogger } from '../../utils/client-logger'
import { Toggle } from '../ui/Toggle'

const log = createLogger('DownloadSettings')

const GB = 1024 * 1024 * 1024
const MB = 1024 * 1024

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`
  return `${(bytes / GB).toFixed(2)} GB`
}

interface QualityOption {
  value: DownloadQuality
  label: string
  description: string
  Icon: React.FC<{ size?: number }>
}

const QUALITY_OPTIONS: QualityOption[] = [
  { value: 'standard', label: 'Standard', description: '~720p · Smaller files, downloads faster', Icon: Smartphone },
  { value: 'higher', label: 'Higher', description: '~1080p · Best for most screens', Icon: Monitor },
  { value: 'best', label: 'Best Available', description: 'Source quality · Largest file', Icon: Sparkles },
]

interface Profile {
  id: number
  name: string
}

interface ProfileEntry {
  stats: StorageStats
  clearing: boolean
  confirmed: boolean
}

interface DownloadSettingsProps {
  currentProfileId: string
}

export function DownloadSettings({ currentProfileId }: DownloadSettingsProps) {
  const [quality, setQuality] = useState<DownloadQuality>(
    () => (localStorage.getItem('download_quality_pref') || 'standard') as DownloadQuality
  )
  const [qualitySaved, setQualitySaved] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profileStats, setProfileStats] = useState<Record<number, ProfileEntry>>({})
  const [dir, setDir] = useState('')
  const [loadingStats, setLoadingStats] = useState(false)
  const [offlineDownloads, setOfflineDownloads] = useState<OfflineDownloadsSettings>(() => readOfflineDownloadsSettings(undefined))
  const [loadingSharedPolicy, setLoadingSharedPolicy] = useState(false)
  const [savingSharedPolicy, setSavingSharedPolicy] = useState(false)
  const inTauri = isTauri()
  const target = getAppTarget()

  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const res = await apiFetch('/api/profiles')
        if (!res.ok) return
        const data: Profile[] = await res.json()
        setProfiles(data)
        if (inTauri) void loadAllStats(data)
      } catch (e) {
        log.error('load profiles error', e)
      }
    }

    const loadDir = async () => {
      if (!inTauri) return
      try {
        const d = await downloadService.getDirectory()
        setDir(typeof d === 'string' ? d : '')
      } catch (e) {
        log.error('get directory error', e)
      }
    }

    void loadProfiles()
    void loadDir()
  }, [inTauri])

  useEffect(() => {
    if (!currentProfileId) {
      setOfflineDownloads(readOfflineDownloadsSettings(undefined))
      setLoadingSharedPolicy(false)
      return
    }

    let cancelled = false
    setLoadingSharedPolicy(true)

    const loadSharedPolicy = async () => {
      try {
        const res = await apiFetch(`/api/streaming/settings?settingsProfileId=${encodeURIComponent(currentProfileId)}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data = await res.json()
        if (!cancelled) {
          setOfflineDownloads(readOfflineDownloadsSettings(data?.data?.offlineDownloads))
        }
      } catch (e) {
        log.error('load shared download policy error', e)
        if (!cancelled) {
          setOfflineDownloads(readOfflineDownloadsSettings(undefined))
        }
      } finally {
        if (!cancelled) {
          setLoadingSharedPolicy(false)
        }
      }
    }

    void loadSharedPolicy()

    return () => {
      cancelled = true
    }
  }, [currentProfileId])

  const loadAllStats = async (profileList: Profile[]) => {
    setLoadingStats(true)
    const entries: Record<number, ProfileEntry> = {}

    await Promise.all(
      profileList.map(async (p) => {
        try {
          const raw = await downloadService.storageStats(String(p.id))
          entries[p.id] = {
            stats: {
              totalBytes: Number((raw as any)?.totalBytes ?? (raw as any)?.total_bytes ?? 0),
              count: Number((raw as any)?.count ?? 0),
            },
            clearing: false,
            confirmed: false,
          }
        } catch {
          entries[p.id] = { stats: { totalBytes: 0, count: 0 }, clearing: false, confirmed: false }
        }
      })
    )

    setProfileStats(entries)
    setLoadingStats(false)
  }

  const handleQualityChange = (q: DownloadQuality) => {
    setQuality(q)
    localStorage.setItem('download_quality_pref', q)
    setQualitySaved(true)
    setTimeout(() => setQualitySaved(false), 2000)
  }

  const handleChangeDir = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: 'Select Download Folder' })
      if (typeof selected === 'string' && selected) {
        await downloadService.setDirectory(selected)
        setDir(selected)
      }
    } catch (e) {
      log.error('folder picker error', e)
    }
  }

  const handleClearProfile = async (profileId: number) => {
    const entry = profileStats[profileId]
    if (!entry) return

    if (!entry.confirmed) {
      setProfileStats(prev => ({ ...prev, [profileId]: { ...entry, confirmed: true } }))
      return
    }

    setProfileStats(prev => ({ ...prev, [profileId]: { ...entry, clearing: true } }))

    try {
      await downloadService.purgeProfile(String(profileId))
      setProfileStats(prev => ({
        ...prev,
        [profileId]: { stats: { totalBytes: 0, count: 0 }, clearing: false, confirmed: false },
      }))
    } catch (e) {
      log.error('purge error', e)
      setProfileStats(prev => ({ ...prev, [profileId]: { ...entry, clearing: false, confirmed: false } }))
    }
  }

  const saveSharedDownloadPolicy = async (nextPolicy: OfflineDownloadsSettings) => {
    if (!currentProfileId) {
      toast.error('Select a shared settings profile first')
      return
    }

    setSavingSharedPolicy(true)

    try {
      const currentRes = await apiFetch(`/api/streaming/settings?settingsProfileId=${encodeURIComponent(currentProfileId)}`)
      if (!currentRes.ok) throw new Error(`HTTP ${currentRes.status}`)

      const currentData = await currentRes.json()
      const nextConfig = {
        ...(currentData?.data ?? {}),
        offlineDownloads: nextPolicy,
      }

      const saveRes = await apiFetch(`/api/streaming/settings?settingsProfileId=${encodeURIComponent(currentProfileId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextConfig),
      })

      if (!saveRes.ok) {
        throw new Error(`HTTP ${saveRes.status}`)
      }

      setOfflineDownloads(nextPolicy)
      window.dispatchEvent(new CustomEvent('streaming-settings-updated'))
      sessionStorage.setItem('streaming-settings-dirty', '1')
      toast.success('Shared download policy updated')
    } catch (e) {
      log.error('save shared download policy error', e)
      toast.error('Failed to update shared download policy')
    } finally {
      setSavingSharedPolicy(false)
    }
  }

  const totalBytes = Object.values(profileStats).reduce((sum, entry) => sum + entry.stats.totalBytes, 0)
  const totalCount = Object.values(profileStats).reduce((sum, entry) => sum + entry.stats.count, 0)

  return (
    <div className={styles.tabContent}>
      <div className={styles.settingsCard}>
        <h2 className={styles.sectionTitle}>Default Quality</h2>
        <p className={styles.dlSettingDesc}>
          Applied automatically when you tap Download - no prompt on each item.
          {qualitySaved && <span className={styles.dlSavedBadge}> Saved</span>}
        </p>
        <div className={styles.dlQualityList}>
          {QUALITY_OPTIONS.map((opt) => {
            const Icon = opt.Icon
            const active = quality === opt.value

            return (
              <button
                key={opt.value}
                className={`${styles.dlQualityRow} ${active ? styles.dlQualityRowActive : ''}`}
                onClick={() => handleQualityChange(opt.value)}
              >
                <span className={styles.dlQualityIcon}><Icon size={17} /></span>
                <div className={styles.dlQualityText}>
                  <span className={styles.dlQualityLabel}>{opt.label}</span>
                  <span className={styles.dlQualityDesc}>{opt.description}</span>
                </div>
                <div className={`${styles.dlQualityRadio} ${active ? styles.dlQualityRadioActive : ''}`} />
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.settingsCard}>
        <h2 className={styles.sectionTitle}>Android TV Policy</h2>
        <p className={styles.dlSettingDesc}>
          Downloads stay disabled by default on Android TV and Google TV because many devices have very limited internal storage.
          This toggle is shared through the active settings profile, so TV behavior stays consistent across profiles that use it.
        </p>

        <div className={styles.settingItem}>
          <div>
            <h3>Enable downloads on Android TV</h3>
            <p>Show download actions and the Downloads screen on TV devices for this shared settings profile.</p>
          </div>
          <Toggle
            checked={offlineDownloads.allowOnTv}
            onChange={(checked) => {
              void saveSharedDownloadPolicy({ allowOnTv: checked })
            }}
            disabled={!currentProfileId || loadingSharedPolicy || savingSharedPolicy}
            title="Enable downloads on Android TV"
          />
        </div>

        <p className={styles.dlSettingDesc}>
          External USB and adopted storage are not fully integrated yet. The folder picker can work when Android exposes a writable path,
          but a dedicated Android TV external-storage flow still needs native work.
        </p>

        {target.isTv && !offlineDownloads.allowOnTv && (
          <p className={styles.dlSettingDesc}>
            This TV currently follows the safe default: streaming only, no offline downloads.
          </p>
        )}
      </div>

      {inTauri && (
        <>
          <div className={styles.settingsCard}>
            <h2 className={styles.sectionTitle}>Download Folder</h2>
            <p className={styles.dlSettingDesc}>Where downloaded files are stored on this device.</p>
            <div className={styles.dlFolderRow}>
              <span className={styles.dlFolderPath}>{dir || '-'}</span>
              <button className={styles.dlFolderBtn} onClick={handleChangeDir}>
                <FolderOpen size={14} />
                Change
              </button>
            </div>
          </div>

          <div className={styles.settingsCard}>
            <h2 className={styles.sectionTitle}>Storage by Profile</h2>
            {totalCount > 0 && (
              <p className={styles.dlSettingDesc}>
                <HardDrive size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                {formatBytes(totalBytes)} total · {totalCount} download{totalCount !== 1 ? 's' : ''}
              </p>
            )}

            {loadingStats ? (
              <div className={styles.dlStatsLoading}>
                <RotateCcw size={14} className={styles.spin} />
                Loading...
              </div>
            ) : (
              <div className={styles.dlProfileList}>
                {profiles.map((p) => {
                  const entry = profileStats[p.id]
                  const used = entry?.stats.totalBytes ?? 0
                  const count = entry?.stats.count ?? 0

                  return (
                    <div key={p.id} className={styles.dlProfileRow}>
                      <div className={styles.dlProfileInfo}>
                        <span className={styles.dlProfileName}>{p.name}</span>
                        <span className={styles.dlProfileUsage}>
                          {count > 0
                            ? `${formatBytes(used)} · ${count} item${count !== 1 ? 's' : ''}`
                            : 'No downloads'}
                        </span>
                      </div>
                      {count > 0 && (
                        <button
                          className={`${styles.dlClearBtn} ${entry?.confirmed ? styles.dlClearBtnConfirm : ''}`}
                          onClick={() => void handleClearProfile(p.id)}
                          disabled={entry?.clearing}
                        >
                          {entry?.clearing ? (
                            <RotateCcw size={13} className={styles.spin} />
                          ) : entry?.confirmed ? (
                            <><CheckCircle size={13} /> Confirm</>
                          ) : (
                            <><Trash2 size={13} /> Clear</>
                          )}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
