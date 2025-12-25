import { useState, useEffect } from 'react'

interface AppearanceSettings {
  showImdbRatings: boolean
  showAgeRatings: boolean
}

export function useAppearanceSettings() {
  const [settings, setSettings] = useState<AppearanceSettings>({
    showImdbRatings: true,
    showAgeRatings: true
  })

  useEffect(() => {
    // Initial load
    loadSettings()

    // Listen for updates
    const handleUpdate = () => {
      loadSettings()
    }

    window.addEventListener('zentrio-settings-update', handleUpdate)
    
    // Also listen for storage events (cross-tab sync)
    window.addEventListener('storage', handleUpdate)

    return () => {
      window.removeEventListener('zentrio-settings-update', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  const loadSettings = () => {
    const hideImdb = localStorage.getItem('zentrioHideImdbRatings') === 'true'
    const hideAge = localStorage.getItem('zentrioHideAgeRatings') === 'true'
    
    setSettings({
      showImdbRatings: !hideImdb,
      showAgeRatings: !hideAge
    })
  }

  return settings
}
