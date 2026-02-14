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

  return (
    <SimpleLayout title="Settings">
      <AnimatedBackground />
      <div className={styles.container} style={{ position: 'relative', zIndex: 1, paddingTop: '80px' }}>
        <button
          className={styles.backBtn}
          onClick={() => navigate('/profiles')}
        >
          <ArrowLeft size={18} />
          Back to Profiles
        </button>

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
              <button className={`${styles.tabBtn} ${activeTab === 'general' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('general')}>
                <SettingsIcon size={16} />
                General
              </button>
              <button className={`${styles.tabBtn} ${activeTab === 'appearance' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('appearance')}>
                <Palette size={16} />
                Appearance
              </button>
              <button className={`${styles.tabBtn} ${activeTab === 'addons' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('addons')}>
                <Puzzle size={16} />
                Addons
              </button>
              <button className={`${styles.tabBtn} ${activeTab === 'streaming' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('streaming')}>
                <Play size={16} />
                Streaming
              </button>
              {!isGuestMode && (
              <button className={`${styles.tabBtn} ${activeTab === 'danger' ? styles.tabBtnActive : ''}`} onClick={() => setActiveTab('danger')}>
                <AlertTriangle size={16} />
                Danger Zone
              </button>
              )}
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