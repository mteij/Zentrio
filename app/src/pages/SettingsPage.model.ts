import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { appMode } from '../lib/app-mode'
import { apiFetch } from '../lib/apiFetch'
import { getAppTarget } from '../lib/app-target'
import {
  getVisibleSettingsTabs,
  type SettingsTabDefinition,
  type SettingsTabKey,
} from '../components/settings/settingsSchema'

export interface SettingsScreenModel {
  activeTab: SettingsTabKey
  effectiveTab: SettingsTabKey
  currentProfileId: string
  currentProfileName: string
  isGuestMode: boolean
  tabItems: SettingsTabDefinition[]
  navigation: {
    goBack: () => void
  }
  actions: {
    setActiveTab: (tab: SettingsTabKey) => void
    handleProfileChange: (id: string) => void
    handleProfilesLoaded: (profiles: Array<{ id: string | number; name?: string }>) => void
  }
}

export function useSettingsScreenModel(): SettingsScreenModel {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as SettingsTabKey | null) ?? 'general'
  const [activeTab, setActiveTab] = useState<SettingsTabKey>(initialTab)
  const [currentProfileId, setCurrentProfileId] = useState('')
  const [profiles, setProfiles] = useState<Array<{ id: string | number; name?: string }>>([])

  const isGuestMode = appMode.isGuest()
  const tabItems = getVisibleSettingsTabs(isGuestMode, getAppTarget().isTauri)
  const hasActiveTab = tabItems.some((tab) => tab.key === activeTab)
  const effectiveTab = isGuestMode && activeTab === 'danger' ? 'general' : activeTab

  useEffect(() => {
    if (hasActiveTab) return
    setActiveTab('general')
  }, [hasActiveTab])

  useEffect(() => {
    const currentTabParam = searchParams.get('tab')
    if (currentTabParam === activeTab) return

    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', activeTab)
    setSearchParams(nextParams, { replace: true })
  }, [activeTab, searchParams, setSearchParams])

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

  const handleProfilesLoaded = useCallback((loadedProfiles: Array<{ id: string | number; name?: string }>) => {
    setProfiles(loadedProfiles)
    setCurrentProfileId((prevId) => {
      if (prevId) return prevId
      const lastSelected = localStorage.getItem('lastSelectedSettingsProfile')
      if (lastSelected && loadedProfiles.some((profile) => String(profile.id) === lastSelected)) {
        return lastSelected
      }
      if (loadedProfiles.length > 0) {
        return String(loadedProfiles[0].id)
      }
      return prevId
    })
  }, [])

  const handleProfileChange = useCallback((id: string) => {
    setCurrentProfileId(id)
    localStorage.setItem('lastSelectedSettingsProfile', id)
  }, [])

  const currentProfileName = profiles.find((profile) => String(profile.id) === currentProfileId)?.name || 'Default'

  return {
    activeTab,
    effectiveTab,
    currentProfileId,
    currentProfileName,
    isGuestMode,
    tabItems,
    navigation: {
      goBack: () => navigate('/profiles'),
    },
    actions: {
      setActiveTab: (tab) => setActiveTab(tab),
      handleProfileChange,
      handleProfilesLoaded,
    },
  }
}
