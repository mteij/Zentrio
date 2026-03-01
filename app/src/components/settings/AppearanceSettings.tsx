import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Toggle } from '../index'
import styles from '../../styles/Settings.module.css'
import { apiFetch } from '../../lib/apiFetch'

interface AppearanceSettingsData {
  show_imdb_ratings: boolean
  show_age_ratings: boolean
}

interface AppearanceSettingsProps {
  currentProfileId: string
  onProfileChange: (id: string) => void
}

export function AppearanceSettings({ currentProfileId }: AppearanceSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<AppearanceSettingsData>({
    show_imdb_ratings: true,
    show_age_ratings: true
  })
  
  useEffect(() => {
    if (currentProfileId) {
      loadSettings(currentProfileId)
    }
  }, [currentProfileId])

  const loadSettings = async (profileId: string) => {
    if (!profileId) return
    try {
      setLoading(true)
      const res = await apiFetch(`/api/appearance/settings?settingsProfileId=${profileId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.data) {
          const { show_imdb_ratings, show_age_ratings } = data.data
          setSettings({
            show_imdb_ratings: show_imdb_ratings ?? true,
            show_age_ratings: show_age_ratings ?? true
          })
        }
      }
    } catch (e) {
      console.error('Failed to load settings', e)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async (newSettings: AppearanceSettingsData) => {
    if (!currentProfileId) return

    try {
      const res = await apiFetch(`/api/appearance/settings?settingsProfileId=${currentProfileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      })
      
      if (res.ok) {
        setSettings(newSettings)
        
        // Update local storage for persistence across reloads/other components
        localStorage.setItem('zentrioHideImdbRatings', (!newSettings.show_imdb_ratings).toString())
        localStorage.setItem('zentrioHideAgeRatings', (!newSettings.show_age_ratings).toString())
        
        window.dispatchEvent(new CustomEvent('zentrio-settings-update'))
        toast.success('Settings Saved', { description: 'Appearance settings updated' })
      } else {
        toast.error('Save Failed', { description: 'Failed to save settings' })
      }
    } catch (e) {
      console.error('Failed to save settings', e)
    }
  }

  if (loading && !settings) return <div className={styles.settingsCard}>Loading appearance settings...</div>

  return (
    <div className={styles.tabContent}>
      <div className={styles.settingsCard}>
        <h2 className={styles.sectionTitle}>Appearance</h2>

        {/* IMDb Ratings */}
        <div className="flex flex-col md:flex-row md:items-center justify-between py-6 gap-4 border-b border-white/5 last:border-0">
            <div className="flex-1 pr-4">
                <h3 className="text-lg font-medium text-white mb-1">Show IMDb Ratings</h3>
                <p className="text-sm text-zinc-400">Display IMDb ratings on media cards.</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
                <Toggle
                    checked={settings.show_imdb_ratings}
                    onChange={(checked) => saveSettings({ ...settings, show_imdb_ratings: checked })}
                />
            </div>
        </div>

        {/* Age Ratings */}
        <div className="flex flex-col md:flex-row md:items-center justify-between py-6 gap-4 border-b border-white/5 last:border-0">
            <div className="flex-1 pr-4">
                <h3 className="text-lg font-medium text-white mb-1">Show Age Ratings</h3>
                <p className="text-sm text-zinc-400">Display age ratings (e.g., AL, 12 years, 16 years) on media cards.</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
                <Toggle
                    checked={settings.show_age_ratings}
                    onChange={(checked) => saveSettings({ ...settings, show_age_ratings: checked })}
                />
            </div>
        </div>

      </div>
    </div>
  )
}
