import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Download, Palette, Play, Puzzle, Settings as SettingsIcon, type LucideIcon } from 'lucide-react'
import { appMode } from '../lib/app-mode'

export type SettingsTabKey = 'general' | 'appearance' | 'addons' | 'streaming' | 'downloads' | 'danger'

export interface SettingsTabItem {
  key: SettingsTabKey
  label: string
  icon: LucideIcon
}

export interface SettingsScreenModel {
  activeTab: SettingsTabKey
  effectiveTab: SettingsTabKey
  currentProfileId: string
  isGuestMode: boolean
  tabItems: SettingsTabItem[]
  mobileTabsRef: React.RefObject<HTMLDivElement | null>
  canScrollMobileLeft: boolean
  canScrollMobileRight: boolean
  navigation: {
    goBack: () => void
  }
  actions: {
    setActiveTab: (tab: SettingsTabKey) => void
    handleProfileChange: (id: string) => void
    handleProfilesLoaded: (profiles: Array<{ id: string | number }>) => void
    updateMobileTabsOverflow: () => void
  }
}

export function useSettingsScreenModel(): SettingsScreenModel {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('general')
  const mobileTabsRef = useRef<HTMLDivElement>(null)
  const [canScrollMobileLeft, setCanScrollMobileLeft] = useState(false)
  const [canScrollMobileRight, setCanScrollMobileRight] = useState(false)
  const [currentProfileId, setCurrentProfileId] = useState('')

  const isGuestMode = appMode.isGuest()
  const effectiveTab = isGuestMode && activeTab === 'danger' ? 'general' : activeTab

  const tabItems: SettingsTabItem[] = [
    { key: 'general', label: 'General', icon: SettingsIcon },
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'addons', label: 'Addons', icon: Puzzle },
    { key: 'streaming', label: 'Streaming', icon: Play },
    { key: 'downloads', label: 'Downloads', icon: Download },
    ...(!isGuestMode ? [{ key: 'danger' as const, label: 'Danger Zone', icon: AlertTriangle }] : []),
  ]

  const updateMobileTabsOverflow = () => {
    const element = mobileTabsRef.current
    if (!element) return

    const hasOverflow = element.scrollWidth > element.clientWidth + 1
    setCanScrollMobileLeft(hasOverflow && element.scrollLeft > 4)
    setCanScrollMobileRight(hasOverflow && element.scrollLeft < element.scrollWidth - element.clientWidth - 4)
  }

  useEffect(() => {
    const frame = requestAnimationFrame(updateMobileTabsOverflow)
    window.addEventListener('resize', updateMobileTabsOverflow)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', updateMobileTabsOverflow)
    }
  }, [effectiveTab, tabItems.length])

  const handleProfilesLoaded = (profiles: Array<{ id: string | number }>) => {
    if (currentProfileId) return
    const lastSelected = localStorage.getItem('lastSelectedSettingsProfile')
    if (lastSelected && profiles.some((profile) => String(profile.id) === lastSelected)) {
      setCurrentProfileId(lastSelected)
      return
    }

    if (profiles.length > 0) {
      setCurrentProfileId(String(profiles[0].id))
    }
  }

  const handleProfileChange = (id: string) => {
    setCurrentProfileId(id)
    localStorage.setItem('lastSelectedSettingsProfile', id)
  }

  return {
    activeTab,
    effectiveTab,
    currentProfileId,
    isGuestMode,
    tabItems,
    mobileTabsRef,
    canScrollMobileLeft,
    canScrollMobileRight,
    navigation: {
      goBack: () => navigate('/profiles'),
    },
    actions: {
      setActiveTab,
      handleProfileChange,
      handleProfilesLoaded,
      updateMobileTabsOverflow,
    },
  }
}
