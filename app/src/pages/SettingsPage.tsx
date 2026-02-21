import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Palette, Puzzle, Play, AlertTriangle, ArrowLeft, Settings as SettingsIcon } from 'lucide-react'
import { SimpleLayout, AnimatedBackground } from '../components/index'
import { appMode } from '../lib/app-mode'

import { AppearanceSettings } from '../components/settings/AppearanceSettings'
import { StreamingSettings } from '../components/settings/StreamingSettings'
import { DangerZoneSettings } from '../components/settings/DangerZoneSettings'
import { AddonManager } from '../components/settings/AddonManager'
import { GeneralSettings } from '../components/settings/GeneralSettings'
import styles from '../styles/Settings.module.css'

export function SettingsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('general')
  const mobileTabsRef = useRef<HTMLDivElement>(null)
  const [canScrollMobileLeft, setCanScrollMobileLeft] = useState(false)
  const [canScrollMobileRight, setCanScrollMobileRight] = useState(false)

  // Check if in guest mode
  const isGuestMode = appMode.isGuest()

  const effectiveTab = isGuestMode && activeTab === 'danger' ? 'general' : activeTab

  const tabItems = [
    { key: 'general', label: 'General', icon: SettingsIcon },
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'addons', label: 'Addons', icon: Puzzle },
    { key: 'streaming', label: 'Streaming', icon: Play },
    ...(!isGuestMode ? [{ key: 'danger', label: 'Danger Zone', icon: AlertTriangle }] : [])
  ]

  const updateMobileTabsOverflow = () => {
    const el = mobileTabsRef.current
    if (!el) return

    const hasOverflow = el.scrollWidth > el.clientWidth + 1
    setCanScrollMobileLeft(hasOverflow && el.scrollLeft > 4)
    setCanScrollMobileRight(hasOverflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }

  useEffect(() => {
    const frame = requestAnimationFrame(updateMobileTabsOverflow)
    window.addEventListener('resize', updateMobileTabsOverflow)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateMobileTabsOverflow)
    }
  }, [effectiveTab, tabItems.length])

  const renderActiveSection = () => {
    if (effectiveTab === 'general') return <GeneralSettings />
    if (effectiveTab === 'addons') return <AddonManager />
    if (effectiveTab === 'appearance') return <AppearanceSettings />
    if (effectiveTab === 'streaming') return <StreamingSettings />
    if (effectiveTab === 'danger') return <DangerZoneSettings />
    return <GeneralSettings />
  }

  return (
    <SimpleLayout title="Settings">
      <AnimatedBackground />
      <div className={`${styles.container} ${styles.settingsPageContent}`}>
        <button
          className={styles.backBtn}
          onClick={() => navigate('/profiles')}
        >
          <ArrowLeft size={18} />
          Back to Profiles
        </button>

        <div className={styles.mobileHeader}>
          <div className={styles.mobileHeaderTop}>
            <button
              className={styles.mobileBackBtn}
              onClick={() => navigate('/profiles')}
              aria-label="Back to Profiles"
            >
              <ArrowLeft size={16} />
            </button>
            <h1 className={styles.mobileHeaderTitle}>Settings</h1>
          </div>

          <div className={styles.mobileSectionTabsWrap}>
            {canScrollMobileLeft && <div className={`${styles.mobileTabsFade} ${styles.mobileTabsFadeLeft}`} aria-hidden="true" />}
            <div
              className={styles.mobileSectionTabs}
              role="tablist"
              aria-label="Settings sections"
              ref={mobileTabsRef}
              onScroll={updateMobileTabsOverflow}
            >
              {tabItems.map((tab) => {
                const TabIcon = tab.icon
                const isActive = effectiveTab === tab.key

                return (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={isActive}
                    className={`${styles.mobileSectionTab} ${isActive ? styles.mobileSectionTabActive : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <TabIcon size={14} />
                    {tab.label}
                  </button>
                )
              })}
            </div>
            {canScrollMobileRight && (
              <div className={`${styles.mobileTabsFade} ${styles.mobileTabsFadeRight}`} aria-hidden="true">
                <span className={styles.mobileTabsCue}>›</span>
              </div>
            )}
          </div>

        </div>

        <div className={styles.settingsShell}>
          <aside className={styles.settingsSidebar} aria-label="Settings sections">
            <div className={styles.settingsSidebarTitle}>Settings</div>
            <div className={styles.settingsSidebarNav}>
              {tabItems.map((tab) => {
                const TabIcon = tab.icon
                const isActive = effectiveTab === tab.key
                return (
                  <button
                    key={tab.key}
                    className={`${styles.sidebarTabBtn} ${isActive ? styles.sidebarTabBtnActive : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <TabIcon size={16} />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </aside>

          <section className={styles.settingsContent}>
            {renderActiveSection()}
          </section>
        </div>

      </div>
    </SimpleLayout>
  )
}
