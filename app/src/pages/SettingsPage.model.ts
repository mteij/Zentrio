import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, Download, Palette, Play, Puzzle, Settings as SettingsIcon, type LucideIcon } from 'lucide-react'
import { appMode } from '../lib/app-mode'
import { apiFetch } from '../lib/apiFetch'

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
  currentProfileName: string
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
    handleProfilesLoaded: (profiles: Array<{ id: string | number; name?: string }>) => void
    updateMobileTabsOverflow: () => void
  }
}

export function useSettingsScreenModel(): SettingsScreenModel {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as SettingsTabKey | null) ?? 'general'
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(initialTab)
  const mobileTabsRef = useRef<HTMLDivElement>(null)
  const [canScrollMobileLeft, setCanScrollMobileLeft] = useState(false)
  const [canScrollMobileRight, setCanScrollMobileRight] = useState(false)
  const [currentProfileId, setCurrentProfileId] = useState('')
  const [profiles, setProfiles] = useState<Array<{ id: string | number; name?: string }>>([])

  const isGuestMode = appMode.isGuest()
  const effectiveTab = isGuestMode && activeTab === 'danger' ? 'general' : activeTab

  // Load profiles on mount so currentProfileId is initialized without a header-level selector
  useEffect(() => {
    apiFetch('/api/user/settings-profiles')
      .then(r => r.json())
      .then(data => {
        const list: Array<{ id: string | number; name?: string }> = data.data || data || []
        setProfiles(list)
        const lastSelected = localStorage.getItem('lastSelectedSettingsProfile')
        if (lastSelected && list.some(p => String(p.id) === lastSelected)) {
          setCurrentProfileId(lastSelected)
          return
        }
        if (list.length > 0) setCurrentProfileId(String(list[0].id))
      })
      .catch(() => {})
  }, [])

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

  const handleProfilesLoaded = (loadedProfiles: Array<{ id: string | number; name?: string }>) => {
    setProfiles(loadedProfiles)
    if (currentProfileId) return
    const lastSelected = localStorage.getItem('lastSelectedSettingsProfile')
    if (lastSelected && loadedProfiles.some((profile) => String(profile.id) === lastSelected)) {
      setCurrentProfileId(lastSelected)
      return
    }

    if (loadedProfiles.length > 0) {
      setCurrentProfileId(String(loadedProfiles[0].id))
    }
  }

  const handleProfileChange = (id: string) => {
    setCurrentProfileId(id)
    localStorage.setItem('lastSelectedSettingsProfile', id)
  }

  const currentProfileName = profiles.find((profile) => String(profile.id) === currentProfileId)?.name || 'Default'

  return {
    activeTab,
    effectiveTab,
    currentProfileId,
    currentProfileName,
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
