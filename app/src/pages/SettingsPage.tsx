import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { User, Palette, Puzzle, Play, AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Settings as SettingsIcon } from 'lucide-react'
import { toast } from 'sonner'
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
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState('general')
  
  // Check if in guest mode
  const isGuestMode = appMode.isGuest()
  
  // Scroll indicators state
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)

  const checkScroll = () => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
    }
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [])

  useEffect(() => {
    // In guest mode, default to appearance tab? Or still General?
    // General has updates/system info which is useful in guest mode too.
    if (!['general', 'appearance', 'addons', 'streaming', 'danger'].includes(activeTab)) {
        setActiveTab('general');
    }
   }, [isGuestMode, activeTab])

  const tabItems = [
    { key: 'general', label: 'General', icon: SettingsIcon },
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'addons', label: 'Addons', icon: Puzzle },
    { key: 'streaming', label: 'Streaming', icon: Play },
    ...(!isGuestMode ? [{ key: 'danger', label: 'Danger Zone', icon: AlertTriangle }] : [])
  ]

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
          <button
            className={styles.mobileBackBtn}
            onClick={() => navigate('/profiles')}
            aria-label="Back to Profiles"
          >
            <ArrowLeft size={16} />
          </button>
          <select
            className={styles.mobileHeaderSelect}
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            aria-label="Select settings section"
          >
            {tabItems.map((tab) => (
              <option key={tab.key} value={tab.key}>{tab.label}</option>
            ))}
          </select>
        </div>

        {/* Tabs Navigation */}
        <div className={styles.settingsTabsWrapper}>
           {canScrollLeft && (
             <div className={`${styles.scrollIndicator} ${styles.scrollIndicatorLeft}`}>
               <ChevronLeft size={16} className={styles.indicatorIcon} />
             </div>
           )}
           <div 
             className={styles.settingsTabs} 
             ref={tabsRef}
             onScroll={checkScroll}
           >
              {tabItems.map((tab) => {
                const TabIcon = tab.icon
                return (
                  <button
                    key={tab.key}
                    className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <TabIcon size={16} />
                    {tab.label}
                  </button>
                )
              })}
           </div>
           {canScrollRight && (
             <div className={`${styles.scrollIndicator} ${styles.scrollIndicatorRight}`}>
               <ChevronRight size={16} className={styles.indicatorIcon} />
             </div>
           )}
        </div>

        {/* General Tab */}
        {activeTab === 'general' && <GeneralSettings />}

        {/* Addons Tab */}
        {activeTab === 'addons' && <AddonManager />}

        {/* Other tabs placeholders */}
        {activeTab === 'appearance' && <AppearanceSettings />}
        {activeTab === 'streaming' && <StreamingSettings />}
        {activeTab === 'danger' && <DangerZoneSettings />}

      </div>
    </SimpleLayout>
  )
}