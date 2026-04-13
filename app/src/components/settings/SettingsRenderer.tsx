import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, Loader2, X } from 'lucide-react'
import { Toggle } from '../ui/Toggle'
import styles from './SettingsRenderer.module.css'
import type {
  SettingsActionItemDefinition,
  SettingsItemDefinition,
  SettingsPlatform,
  SettingsRangeItemDefinition,
  SettingsScope,
  SettingsSectionDefinition,
  SettingsTextItemDefinition,
} from './settingsSchema'

function isVisibleOnPlatform(platform: SettingsPlatform, platforms?: SettingsPlatform[]) {
  return !platforms || platforms.includes(platform)
}

function joinClasses(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

function getScopeLabel(scope?: SettingsScope) {
  switch (scope) {
    case 'settings-profile': return 'Settings Profile'
    case 'account': return 'Account'
    case 'device': return 'This Device'
    case 'server': return 'Server'
    default: return null
  }
}

function SettingsActionButton({ item, platform }: { item: SettingsActionItemDefinition; platform: SettingsPlatform }) {
  const actionLabel = item.actionLabel ?? item.label ?? 'Open'
  return (
    <button
      type="button"
      className={joinClasses(
        styles.controlButton,
        item.variant === 'danger' && styles.controlButtonDanger,
        platform === 'tv' && styles.controlButtonTv,
      )}
      onClick={item.onActivate}
      disabled={item.disabled || item.saving}
      aria-busy={item.saving}
    >
      {item.saving
        ? <Loader2 size={14} className={styles.savingSpinner} aria-hidden="true" />
        : actionLabel}
    </button>
  )
}

function SettingsRangeControl({ item, labelId }: { item: SettingsRangeItemDefinition; labelId?: string }) {
  const [value, setValue] = useState(item.value)
  useEffect(() => { setValue(item.value) }, [item.value])
  const commitValue = () => { item.onCommit?.(value) }

  return (
    <div className={styles.rangeControl}>
      <input
        type="range" min={item.min} max={item.max} step={item.step ?? 1}
        className={styles.controlRange} value={value} disabled={item.disabled}
        aria-labelledby={labelId}
        aria-valuetext={item.valueLabel ? String(item.valueLabel) : undefined}
        onChange={(e) => { setValue(Number(e.target.value)); item.onChange(Number(e.target.value)) }}
        onMouseUp={commitValue} onTouchEnd={commitValue} onKeyUp={commitValue} onBlur={commitValue}
      />
      {item.valueLabel ? <div className={styles.rangeValue} aria-hidden="true">{item.valueLabel}</div> : null}
    </div>
  )
}

function SettingsTextControl({ item, labelId }: { item: SettingsTextItemDefinition; labelId?: string }) {
  return (
    <input
      type={item.inputType ?? 'text'} value={item.value} placeholder={item.placeholder}
      className={styles.controlTextInput} disabled={item.disabled}
      aria-labelledby={labelId}
      onChange={(e) => item.onChange(e.target.value)}
    />
  )
}

function renderControl(item: SettingsItemDefinition, platform: SettingsPlatform, labelId?: string) {
  switch (item.kind) {
    case 'toggle':
      return <Toggle checked={item.checked} onChange={item.onChange} disabled={item.disabled} title={item.label} />
    case 'action':
      return <SettingsActionButton item={item} platform={platform} />
    case 'select':
      return (
        <select
          className={styles.controlSelect} value={item.value} disabled={item.disabled}
          aria-labelledby={labelId}
          onChange={(e) => item.onChange(e.target.value)}
        >
          {item.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    case 'range':
      return <SettingsRangeControl item={item} labelId={labelId} />
    case 'text':
      return <SettingsTextControl item={item} labelId={labelId} />
    default:
      return null
  }
}

function SettingsItemRow({ item, platform }: { item: SettingsItemDefinition; platform: SettingsPlatform }) {
  if (!isVisibleOnPlatform(platform, item.platforms)) return null

  if (item.kind === 'notice') {
    return (
      <div
        className={joinClasses(styles.notice, item.tone === 'warning' && styles.noticeWarning, item.tone === 'danger' && styles.noticeDanger)}
        role={item.tone === 'danger' || item.tone === 'warning' ? 'alert' : undefined}
      >
        {item.content}
      </div>
    )
  }

  if (item.kind === 'custom') {
    return <div className={styles.customItem}>{item.render(platform)}</div>
  }

  const labelId = item.label ? `${item.id}-label` : undefined

  return (
    <div className={joinClasses(styles.row, platform === 'tv' ? styles.rowTv : styles.rowStandard)}>
      <div className={styles.rowLeading}>
        {item.label ? <div id={labelId} className={styles.rowLabel}>{item.label}</div> : null}
        {item.description ? <div className={styles.rowDescription}>{item.description}</div> : null}
        {item.summary ? (
          <div className={styles.rowSummary} aria-label={`Current value: ${item.summary}`}>{item.summary}</div>
        ) : null}
      </div>
      <div className={styles.rowControl}>{renderControl(item, platform, labelId)}</div>
    </div>
  )
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function MobileOverlay({ section, onClose }: { section: SettingsSectionDefinition; onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement
    const el = overlayRef.current
    if (!el) return
    el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)[0]?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const all = [...el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
      if (all.length === 0) return
      const first = all[0]; const last = all[all.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => { document.removeEventListener('keydown', handleKeyDown); previousFocusRef.current?.focus() }
  }, [onClose])

  return (
    <div ref={overlayRef} className={styles.mobileOverlay} role="dialog" aria-modal="true" aria-label={section.title}>
      <div className={styles.mobileOverlayHeader}>
        <span className={styles.mobileOverlayTitle}>{section.title}</span>
        <button type="button" className={styles.mobileOverlayClose} onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.mobileOverlayContent}>
        <div className={styles.items}>
          {section.items.map((item) => <SettingsItemRow key={item.id} item={item} platform="standard" />)}
        </div>
      </div>
    </div>
  )
}

export interface SettingsRendererProps {
  platform: SettingsPlatform
  sections: SettingsSectionDefinition[]
  className?: string
  openOverlaySection?: string
  onOpenOverlay?: (sectionId: string) => void
  onCloseOverlay?: () => void
}

export function SettingsRenderer({
  platform,
  sections,
  className,
  openOverlaySection,
  onOpenOverlay,
  onCloseOverlay,
}: SettingsRendererProps) {
  const isMobile = platform === 'standard'

  const visibleSections = useMemo(
    () => sections.filter((s) => isVisibleOnPlatform(platform, s.platforms)),
    [platform, sections],
  )

  const overlaySection = openOverlaySection
    ? sections.find((s) => s.id === openOverlaySection)
    : undefined

  return (
    <div className={joinClasses(styles.surface, platform === 'tv' ? styles.surfaceTv : styles.surfaceStandard, className)}>
      {visibleSections.map((section) => {
        const isOverlay = section.mobileOverlay && isMobile
        const scopeLabel = getScopeLabel(section.scope)

        return (
          <div key={section.id} className={styles.sectionBlock}>
            {section.title ? (
              <div className={styles.sectionLabel}>
                <span className={styles.sectionLabelText}>{section.title}</span>
                {platform !== 'tv' && scopeLabel ? (
                  <span className={styles.scopeBadge}>{scopeLabel}</span>
                ) : null}
              </div>
            ) : null}

            <section
              className={joinClasses(
                styles.sectionCard,
                platform === 'tv' ? styles.sectionCardTv : styles.sectionCardStandard,
              )}
            >
              {isOverlay ? (
                <div className={styles.items}>
                  <button
                    type="button"
                    className={styles.mobileOverlayTrigger}
                    aria-haspopup="dialog"
                    aria-expanded={openOverlaySection === section.id}
                    onClick={() => onOpenOverlay?.(section.id)}
                  >
                    <span>Open {section.title}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div className={styles.items}>
                  {section.items.map((item) => (
                    <SettingsItemRow key={item.id} item={item} platform={platform} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )
      })}
      {overlaySection && onCloseOverlay ? (
        <MobileOverlay section={overlaySection} onClose={onCloseOverlay} />
      ) : null}
    </div>
  )
}

export { styles as settingsRendererStyles }
