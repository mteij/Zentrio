import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, X, Smartphone, Monitor, Sparkles } from 'lucide-react'
import { DownloadQuality } from '../../services/downloads/download-service'
import styles from './Downloads.module.css'

interface QualityOption {
  value: DownloadQuality
  label: string
  description: string
  Icon: React.FC<{ size?: number }>
}

const QUALITY_OPTIONS: QualityOption[] = [
  { value: 'standard', label: 'Standard', description: '~720p · Saves storage space', Icon: Smartphone },
  { value: 'higher', label: 'Higher', description: '~1080p · Best for most screens', Icon: Monitor },
  { value: 'best', label: 'Best Available', description: 'Source quality · Largest file', Icon: Sparkles },
]

interface Props {
  title: string
  onConfirm: (quality: DownloadQuality) => void
  onClose: () => void
}

export function QualityPicker({ title, onConfirm, onClose }: Props) {
  const storedQuality = (localStorage.getItem('download_quality_pref') || 'higher') as DownloadQuality
  const [selected, setSelected] = useState<DownloadQuality>(storedQuality)

  const handleConfirm = () => {
    localStorage.setItem('download_quality_pref', selected)
    onConfirm(selected)
  }

  return createPortal(
    <div className={styles.pickerOverlay} onClick={onClose}>
      <div className={styles.pickerSheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.pickerHeader}>
          <div className={styles.pickerTitle}>
            <Download size={18} />
            <span>Download Quality</span>
          </div>
          <button className={styles.pickerClose} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p className={styles.pickerMediaTitle}>{title}</p>

        <div className={styles.qualityOptions}>
          {QUALITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.qualityOption} ${selected === opt.value ? styles.qualityOptionActive : ''}`}
              onClick={() => setSelected(opt.value)}
            >
              <span className={styles.qualityIcon}>
                <opt.Icon size={18} />
              </span>
              <div className={styles.qualityText}>
                <span className={styles.qualityLabel}>{opt.label}</span>
                <span className={styles.qualityDesc}>{opt.description}</span>
              </div>
              <div className={`${styles.qualityRadio} ${selected === opt.value ? styles.qualityRadioActive : ''}`} />
            </button>
          ))}
        </div>

        <button className={styles.pickerConfirm} onClick={handleConfirm}>
          <Download size={16} />
          Download
        </button>
      </div>
    </div>,
    document.body
  )
}
