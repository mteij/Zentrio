import { useState, useEffect } from 'react'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button, ModalWithFooter, Toggle, SettingsProfileSelector } from '../index'
import styles from '../../styles/Settings.module.css'

interface Theme {
  id: string
  name: string
  accent: string
  btnPrimary?: string
  btnPrimaryHover?: string
  text?: string
  muted?: string
  background?: {
    primary: string
    secondary: string
    tertiary: string
  }
  animationSpeed?: number
}

interface AppearanceSettingsData {
  theme_id: string
  show_imdb_ratings: boolean
  show_age_ratings: boolean
  custom_theme_config?: string
}

export function AppearanceSettings() {
  const [loading, setLoading] = useState(false)
  const [themes, setThemes] = useState<Theme[]>([])
  const [currentProfileId, setCurrentProfileId] = useState<string>('')
  const [settings, setSettings] = useState<AppearanceSettingsData>({
    theme_id: 'zentrio',
    show_imdb_ratings: true,
    show_age_ratings: true
  })
  
  // Custom Theme Modal
  const [showCustomThemeModal, setShowCustomThemeModal] = useState(false)
  const [customTheme, setCustomTheme] = useState<Theme>({
    id: 'custom',
    name: 'Custom',
    accent: '#e50914',
    btnPrimary: '#e50914',
    text: '#ffffff',
    muted: '#b3b3b3',
    background: {
      primary: '#141414',
      secondary: '#1e1e1e',
      tertiary: 'rgba(20, 20, 20, 0.6)'
    },
    animationSpeed: 60
  })

  useEffect(() => {
    loadThemes()
  }, [])

  const loadThemes = async () => {
    try {
      const res = await fetch('/api/themes')
      if (res.ok) {
        const data = await res.json()
        setThemes(data)
      }
    } catch (e) {
      console.error('Failed to load themes', e)
    }
  }

  const loadSettings = async (profileId: string) => {
    if (!profileId) return
    try {
      setLoading(true)
      const res = await fetch(`/api/appearance/settings?settingsProfileId=${profileId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.data) {
          setSettings(data.data)
          
          // If custom theme is selected, parse it
          if (data.data.theme_id === 'custom' && data.data.custom_theme_config) {
            try {
              const parsed = JSON.parse(data.data.custom_theme_config)
              setCustomTheme(parsed)
            } catch (e) {
              console.error('Failed to parse custom theme config', e)
            }
          }
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
      const res = await fetch(`/api/appearance/settings?settingsProfileId=${currentProfileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      })
      
      if (res.ok) {
        setSettings(newSettings)
        applyTheme(newSettings)
        toast.success('Settings Saved', { description: 'Appearance settings updated' })
      } else {
        toast.error('Save Failed', { description: 'Failed to save settings' })
      }
    } catch (e) {
      console.error('Failed to save settings', e)
    }
  }

  const applyTheme = (currentSettings: AppearanceSettingsData) => {
    let themeToApply: Theme | undefined

    if (currentSettings.theme_id === 'custom' && currentSettings.custom_theme_config) {
      try {
        themeToApply = JSON.parse(currentSettings.custom_theme_config)
      } catch (e) {}
    } else {
      themeToApply = themes.find(t => t.id === currentSettings.theme_id)
    }

    if (themeToApply) {
      applyThemeObject(themeToApply)
      
      // Update local storage for persistence across reloads
      localStorage.setItem('zentrioTheme', currentSettings.theme_id)
      localStorage.setItem('zentrioHideImdbRatings', (!currentSettings.show_imdb_ratings).toString())
      localStorage.setItem('zentrioHideAgeRatings', (!currentSettings.show_age_ratings).toString())
      
      if (currentSettings.theme_id === 'custom' && currentSettings.custom_theme_config) {
        localStorage.setItem('zentrioCustomTheme', currentSettings.custom_theme_config)
      }
      
      // Save full config for other pages to use synchronously
      localStorage.setItem('zentrioActiveThemeConfig', JSON.stringify(themeToApply))
      
      // Dispatch event for other components (like AnimatedBackground) to update immediately
      window.dispatchEvent(new CustomEvent('zentrio-theme-update', { detail: themeToApply }))
      window.dispatchEvent(new CustomEvent('zentrio-settings-update'))
    }
  }

  const applyThemeObject = (theme: Theme) => {
    const root = document.documentElement
    root.style.setProperty('--accent', theme.accent)
    root.style.setProperty('--btn-primary-bg', theme.btnPrimary || theme.accent)
    root.style.setProperty('--btn-primary-bg-hover', theme.btnPrimaryHover || theme.btnPrimary || theme.accent)
    root.style.setProperty('--text', theme.text || '#ffffff')
    root.style.setProperty('--muted', theme.muted || '#b3b3b3')
    
    if (theme.background) {
      root.style.setProperty('--bg', theme.background.primary)
      root.style.setProperty('--bg-elevated', theme.background.secondary)
      root.style.setProperty('--bg-card', theme.background.tertiary)
    }
  }

  const handleProfileChange = (newProfileId: string) => {
    if (!newProfileId) return
    setCurrentProfileId(newProfileId)
    localStorage.setItem('lastSelectedAppearanceProfile', newProfileId)
    loadSettings(newProfileId)
  }

  const handleProfilesLoaded = (profilesList: any[]) => {
      const lastSelected = localStorage.getItem('lastSelectedAppearanceProfile')
      if (lastSelected && profilesList.some(p => String(p.id) === lastSelected)) {
          handleProfileChange(lastSelected)
      } else if (profilesList.length > 0) {
          handleProfileChange(String(profilesList[0].id))
      }
  }

  const handleThemeSelect = (themeId: string) => {
    if (themeId === 'custom') {
      setShowCustomThemeModal(true)
      // Don't save yet, wait for modal save
    } else {
      const newSettings = { ...settings, theme_id: themeId }
      saveSettings(newSettings)
    }
  }

  const handleSaveCustomTheme = () => {
    const customThemeConfig = JSON.stringify(customTheme)
    const newSettings = { 
      ...settings, 
      theme_id: 'custom',
      custom_theme_config: customThemeConfig
    }
    saveSettings(newSettings)
    setShowCustomThemeModal(false)
  }

  if (loading && !settings) return <div className={styles.settingsCard}>Loading appearance settings...</div>

  return (
    <div className={styles.tabContent}>
      <div className={styles.settingsCard}>
        <h2 className={styles.sectionTitle}>Appearance</h2>

        {/* Profile Selector */}
        <div className="flex flex-col py-5 border-b border-white/5 last:border-0">
            <SettingsProfileSelector
                currentProfileId={currentProfileId}
                onProfileChange={handleProfileChange}
                onProfilesLoaded={handleProfilesLoaded}
                label="Profile"
            />
        </div>

        {/* Theme Gallery */}
        <div className="flex flex-col py-6 border-b border-white/5 last:border-0">
            <div className="mb-4">
                <h3 className="text-lg font-medium text-white mb-1">Theme</h3>
                <p className="text-sm text-zinc-400">Select your preferred visual theme.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 w-full">
                {themes.map(theme => (
                    <div key={theme.id} className="theme-tile-wrapper relative group">
                        <button 
                            className="theme-tile w-full text-left transition-all hover:-translate-y-1 hover:shadow-lg"
                            onClick={() => handleThemeSelect(theme.id)}
                            style={{
                                cursor: 'pointer',
                                border: settings.theme_id === theme.id ? `2px solid ${theme.accent}` : '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '12px',
                                padding: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                background: 'linear-gradient(180deg, rgba(30,30,30,0.4), rgba(30,30,30,0.2))',
                                color: 'var(--text, #fff)'
                            }}
                        >
                            <div style={{
                                height: '48px',
                                borderRadius: '8px',
                                background: `linear-gradient(90deg, ${theme.accent}22 0%, ${theme.accent}44 50%, ${theme.accent}22 100%)`,
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                                width: '100%'
                            }}></div>
                            <div className="flex justify-between items-center w-full">
                                <div className="text-sm font-medium text-zinc-300">{theme.name}</div>
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    background: theme.accent,
                                    border: '2px solid rgba(255,255,255,0.1)'
                                }}></div>
                            </div>
                        </button>
                    </div>
                ))}
                
                {/* Custom Theme Option */}
                <div className="theme-tile-wrapper relative group">
                    <button 
                        className="theme-tile w-full text-left transition-all hover:-translate-y-1 hover:shadow-lg"
                        onClick={() => handleThemeSelect('custom')}
                        style={{
                            cursor: 'pointer',
                            border: settings.theme_id === 'custom' ? `2px solid ${customTheme.accent}` : '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '12px',
                            padding: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            background: 'linear-gradient(180deg, rgba(30,30,30,0.4), rgba(30,30,30,0.2))',
                            color: 'var(--text, #fff)'
                        }}
                    >
                        <div style={{
                            height: '48px',
                            borderRadius: '8px',
                            background: `linear-gradient(90deg, ${customTheme.accent}22 0%, ${customTheme.accent}44 50%, ${customTheme.accent}22 100%)`,
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                            width: '100%'
                        }}></div>
                        <div className="flex justify-between items-center w-full">
                            <div className="text-sm font-medium text-zinc-300">Custom</div>
                            <div style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                background: customTheme.accent,
                                border: '2px solid rgba(255,255,255,0.1)'
                            }}></div>
                        </div>
                    </button>
                    {settings.theme_id === 'custom' && (
                        <div className="absolute -top-2 -right-2 hidden group-hover:block">
                             <button 
                                className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center hover:bg-zinc-700 hover:border-zinc-500 transition-colors shadow-lg text-white" 
                                title="Edit Custom Theme"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setShowCustomThemeModal(true)
                                }}
                             >
                                 <Pencil size={14} />
                             </button>
                        </div>
                    )}
                </div>
            </div>
        </div>

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
                <p className="text-sm text-zinc-400">Display age ratings (e.g., PG-13, R) on media cards.</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
                <Toggle
                    checked={settings.show_age_ratings}
                    onChange={(checked) => saveSettings({ ...settings, show_age_ratings: checked })}
                />
            </div>
        </div>

      </div>

      {/* Custom Theme Modal */}
      {showCustomThemeModal && (
        <ModalWithFooter
            id="customThemeModal"
            title="Customize Theme"
            isOpen={showCustomThemeModal}
            onClose={() => setShowCustomThemeModal(false)}
            footer={
                <>
                    <Button variant="secondary" onClick={() => setShowCustomThemeModal(false)}>Cancel</Button>
                    <Button variant="primary" onClick={handleSaveCustomTheme}>Save Theme</Button>
                </>
            }
        >
            <div className={styles.customThemeEditor}>
                <div className={styles.colorPickerRow}>
                    <label>Accent Color</label>
                    <div className={styles.colorInputWrapper}>
                        <input 
                            type="color" 
                            value={customTheme.accent} 
                            onChange={(e) => setCustomTheme({ ...customTheme, accent: e.target.value, btnPrimary: e.target.value })} 
                        />
                        <span className={styles.colorValue}>{customTheme.accent}</span>
                    </div>
                </div>

                <div className={styles.colorPickerRow}>
                    <label>Text Color</label>
                    <div className={styles.colorInputWrapper}>
                        <input 
                            type="color" 
                            value={customTheme.text || '#ffffff'} 
                            onChange={(e) => setCustomTheme({ ...customTheme, text: e.target.value })} 
                        />
                        <span className={styles.colorValue}>{customTheme.text || '#ffffff'}</span>
                    </div>
                </div>

                <div className={styles.colorPickerRow}>
                    <label>Muted Text Color</label>
                    <div className={styles.colorInputWrapper}>
                        <input 
                            type="color" 
                            value={customTheme.muted || '#b3b3b3'} 
                            onChange={(e) => setCustomTheme({ ...customTheme, muted: e.target.value })} 
                        />
                        <span className={styles.colorValue}>{customTheme.muted || '#b3b3b3'}</span>
                    </div>
                </div>

                <div className={styles.colorPickerRow}>
                    <label>Background Primary</label>
                    <div className={styles.colorInputWrapper}>
                        <input 
                            type="color" 
                            value={customTheme.background?.primary || '#141414'} 
                            onChange={(e) => setCustomTheme({ 
                                ...customTheme, 
                                background: { 
                                    secondary: customTheme.background?.secondary || '#1e1e1e',
                                    tertiary: customTheme.background?.tertiary || 'rgba(20, 20, 20, 0.6)',
                                    ...customTheme.background,
                                    primary: e.target.value 
                                } 
                            })} 
                        />
                        <span className={styles.colorValue}>{customTheme.background?.primary || '#141414'}</span>
                    </div>
                </div>

                <div className={styles.colorPickerRow}>
                    <label>Background Secondary</label>
                    <div className={styles.colorInputWrapper}>
                        <input 
                            type="color" 
                            value={customTheme.background?.secondary || '#1e1e1e'} 
                            onChange={(e) => setCustomTheme({ 
                                ...customTheme, 
                                background: { 
                                    primary: customTheme.background?.primary || '#141414',
                                    tertiary: customTheme.background?.tertiary || 'rgba(20, 20, 20, 0.6)',
                                    ...customTheme.background,
                                    secondary: e.target.value 
                                } 
                            })} 
                        />
                        <span className={styles.colorValue}>{customTheme.background?.secondary || '#1e1e1e'}</span>
                    </div>
                </div>

                <div className={styles.colorPickerRow}>
                    <label>Background Tertiary</label>
                    <div className={styles.colorInputWrapper}>
                        <input 
                            type="color" 
                            value={customTheme.background?.tertiary || 'rgba(20, 20, 20, 0.6)'} 
                            onChange={(e) => setCustomTheme({ 
                                ...customTheme, 
                                background: { 
                                    primary: customTheme.background?.primary || '#141414',
                                    secondary: customTheme.background?.secondary || '#1e1e1e',
                                    ...customTheme.background,
                                    tertiary: e.target.value 
                                } 
                            })} 
                        />
                        <span className={styles.colorValue}>{customTheme.background?.tertiary || 'rgba(20, 20, 20, 0.6)'}</span>
                    </div>
                </div>

                <div className={styles.rangeSliderContainer}>
                    <div className={styles.rangeSliderHeader}>
                        <span className={styles.rangeSliderLabel}>Animation Speed</span>
                        <span className={styles.rangeSliderValue}>{customTheme.animationSpeed || 45}s</span>
                    </div>
                    <input 
                        type="range" 
                        min="10" 
                        max="120" 
                        step="5"
                        value={customTheme.animationSpeed || 45} 
                        onChange={(e) => setCustomTheme({ ...customTheme, animationSpeed: parseInt(e.target.value) })}
                        className="w-full accent-red-600 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
            </div>
        </ModalWithFooter>
      )}
    </div>
  )
}