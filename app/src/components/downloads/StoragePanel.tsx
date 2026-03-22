import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Settings, HardDrive, Trash2, CheckCircle, Zap, RotateCcw } from 'lucide-react'
import { downloadService, StorageStats, SmartDefaults } from '../../services/downloads/download-service'
import styles from './Downloads.module.css'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('StoragePanel')

interface Props {
  profileId: string
  onClose: () => void
  onClear: () => void
}

const GB = 1024 * 1024 * 1024
const MB = 1024 * 1024

function toFiniteNumber(value: unknown, fallback: number = 0): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`
  return `${(bytes / GB).toFixed(2)} GB`
}

const QUOTA_OPTIONS = [
  { label: 'Unlimited', value: 0 },
  { label: '1 GB', value: 1 * GB },
  { label: '2 GB', value: 2 * GB },
  { label: '5 GB', value: 5 * GB },
  { label: '10 GB', value: 10 * GB },
  { label: '20 GB', value: 20 * GB },
  { label: '50 GB', value: 50 * GB },
]

export function StoragePanel({ profileId, onClose, onClear }: Props) {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [quota, setQuota] = useState(0)
  const [smart, setSmart] = useState<SmartDefaults>({ smartDownload: false, autoDelete: false })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [rawStats, rawQuota, rawSmart] = await Promise.all([
          downloadService.storageStats(profileId),
          downloadService.getQuota(profileId),
          downloadService.getSmartDefaults(profileId),
        ])
        if (cancelled) return
        setStats({
          totalBytes: toFiniteNumber((rawStats as any)?.totalBytes ?? (rawStats as any)?.total_bytes),
          count: toFiniteNumber((rawStats as any)?.count),
          freeBytes: toFiniteNumber((rawStats as any)?.freeBytes ?? (rawStats as any)?.free_bytes),
        })
        setQuota(Math.max(0, toFiniteNumber(rawQuota)))
        setSmart({
          smartDownload: Boolean((rawSmart as any)?.smartDownload),
          autoDelete: Boolean((rawSmart as any)?.autoDelete),
        })
      } catch (e) {
        log.error('Error:', e)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [profileId])

  const handleClear = async () => {
    if (!confirmed) { setConfirmed(true); return }
    try {
      await downloadService.purgeProfile(profileId)
      setStats(s => ({ totalBytes: 0, count: 0, freeBytes: s?.freeBytes ?? 0 }))
      onClear()
    } catch (e) {
      log.error('clear error', e)
    } finally { setConfirmed(false) }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      await Promise.all([
        downloadService.setQuota(profileId, quota),
        downloadService.setSmartDefaults(profileId, smart.smartDownload, smart.autoDelete),
      ])
    } catch (e) {
      log.error('save error', e)
    } finally { setSaving(false) }
  }

  const totalDisk = stats ? stats.totalBytes + stats.freeBytes : 0
  const usedDiskPercent = totalDisk > 0 ? Math.min((toFiniteNumber(stats!.totalBytes) / totalDisk) * 100, 100) : 0

  return createPortal(
    <div className={`${styles.pickerOverlay} ${styles.storageOverlay}`} onClick={onClose}>
      <div className={`${styles.pickerSheet} ${styles.storageSheet}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.storageHeader}>
          <div className={styles.pickerTitle}>
            <Settings size={16} />
            <span>Storage &amp; Smart Downloads</span>
          </div>
          <button className={styles.pickerClose} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* ── Storage stats ── */}
        <div className={styles.storageStatRow}>
          <HardDrive size={18} className={styles.storageIcon} />
          <div className={styles.storageStatCols}>
            <div className={styles.storageStatText}>
              <span className={styles.storageStatLabel}>Used</span>
              <span className={styles.storageStatValue}>
                {stats ? `${formatBytes(stats.totalBytes)} · ${stats.count} item${stats.count !== 1 ? 's' : ''}` : '—'}
              </span>
            </div>
            {stats && stats.freeBytes > 0 && (
              <div className={styles.storageStatText}>
                <span className={styles.storageStatLabel}>Available</span>
                <span className={styles.storageStatValue}>{formatBytes(stats.freeBytes)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Disk usage bar (shows used vs total disk space) */}
        {totalDisk > 0 && (
          <div className={styles.quotaBar}>
            <div className={styles.quotaFill} style={{ width: `${usedDiskPercent}%` }} />
          </div>
        )}

        {/* ── Storage quota ── */}
        <div className={styles.smartSection}>
          <span className={styles.smartSectionLabel}>Storage limit</span>
          <div className={styles.quotaOptions}>
            {QUOTA_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`${styles.quotaOption} ${quota === opt.value ? styles.quotaOptionActive : ''}`}
                onClick={() => setQuota(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Smart Downloads ── */}
        <div className={styles.smartSection}>
          <span className={styles.smartSectionLabel}>
            <Zap size={14} />
            Smart Downloads
          </span>

          <div className={styles.smartToggleRow}>
            <div className={styles.smartToggleText}>
              <span>Auto-download next episode</span>
              <span className={styles.smartToggleDesc}>When a series episode finishes, queue the next one</span>
            </div>
            <button
              className={`${styles.toggle} ${smart.smartDownload ? styles.toggleOn : ''}`}
              onClick={() => setSmart(s => ({ ...s, smartDownload: !s.smartDownload }))}
              role="switch"
              aria-checked={smart.smartDownload}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>

          <div className={`${styles.smartToggleRow} ${!smart.smartDownload ? styles.smartToggleDisabled : ''}`}>
            <div className={styles.smartToggleText}>
              <span>Delete after watching</span>
              <span className={styles.smartToggleDesc}>Remove the file after you finish watching it</span>
            </div>
            <button
              className={`${styles.toggle} ${smart.autoDelete && smart.smartDownload ? styles.toggleOn : ''}`}
              onClick={() => smart.smartDownload && setSmart(s => ({ ...s, autoDelete: !s.autoDelete }))}
              disabled={!smart.smartDownload}
              role="switch"
              aria-checked={smart.autoDelete}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>
        </div>

        {/* Save settings */}
        <button className={styles.storageActionBtn} style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} onClick={handleSaveSettings} disabled={saving}>
          {saving ? <RotateCcw size={14} className={styles.spin} /> : <CheckCircle size={14} />}
          Save settings
        </button>

        {/* ── Clear all ── */}
        <button
          className={`${styles.storageClearBtn} ${confirmed ? styles.storageClearBtnConfirm : ''}`}
          onClick={handleClear}
          disabled={!stats || stats.count === 0}
        >
          {confirmed ? (
            <><CheckCircle size={15} />Confirm — delete all {stats?.count} downloads</>
          ) : (
            <><Trash2 size={15} />Clear all downloads</>
          )}
        </button>
      </div>
    </div>,
    document.body,
  )
}
