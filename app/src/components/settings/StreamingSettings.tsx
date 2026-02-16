import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { ChevronDown, Monitor, Disc } from 'lucide-react'
import { Button, Toggle, SettingsProfileSelector } from '../index'
import styles from '../../styles/Settings.module.css'
import { apiFetch } from '../../lib/apiFetch'


interface StreamingSettingsData {
  resolutions: { id: string; enabled: boolean }[]
  qualities: string[]
  maxFileSize: number
  sorting: {
    id: string
    name: string
    desc: string
    enabled: boolean
    direction: 'asc' | 'desc'
    directionLabels?: { asc: string; desc: string }
  }[]
  selectedLanguages: string[]
  parental: {
    enabled: boolean
    ratingLimit: string
  }
  sortingEnabled: boolean
  // Playback settings
  autoPlayWaitSeconds: number  // 5-30, default 10
  // Stream display settings
  showAddonName: boolean
  showDescription: boolean
  streamDisplayMode: 'compact-simple' | 'compact-advanced' | 'classic'
}

const DEFAULT_SETTINGS: StreamingSettingsData = {
  resolutions: ['4k', '2160p', '1440p', '1080p', '720p', '576p', '480p', '360p', '240p', 'Unknown'].map(r => ({ id: r, enabled: true })),
  qualities: ['BluRay/UHD', 'WEB/HD', 'DVD/TV/SAT', 'CAM/Screener', 'Unknown'],
  maxFileSize: 0,
  sorting: [
    { id: 'language', name: 'Language', desc: 'Sort by preferred languages first', enabled: true, direction: 'desc', directionLabels: { desc: 'Preferred First', asc: 'Preferred Last' } },
    { id: 'cached', name: 'Cached', desc: 'Show cached results first', enabled: true, direction: 'desc', directionLabels: { desc: 'Cached First', asc: 'Uncached First' } },
    { id: 'resolution', name: 'Resolution', desc: 'Highest resolution first', enabled: true, direction: 'desc', directionLabels: { desc: 'Highest First', asc: 'Lowest First' } },
    { id: 'quality', name: 'Quality', desc: 'Best quality first', enabled: true, direction: 'desc', directionLabels: { desc: 'Best First', asc: 'Worst First' } },
    { id: 'size', name: 'Size', desc: 'Largest size first', enabled: true, direction: 'desc', directionLabels: { desc: 'Largest First', asc: 'Smallest First' } },
    { id: 'seeders', name: 'Seeders', desc: 'Most seeders first', enabled: true, direction: 'desc', directionLabels: { desc: 'Most First', asc: 'Least First' } },
    { id: 'created', name: 'Created At', desc: 'Newest first', enabled: true, direction: 'desc', directionLabels: { desc: 'Newest First', asc: 'Oldest First' } }
  ],
  selectedLanguages: [],
  parental: {
    enabled: false,
    ratingLimit: 'R'
  },
  sortingEnabled: true,
  autoPlayWaitSeconds: 10,
  showAddonName: true,
  showDescription: true,
  streamDisplayMode: 'compact-simple'
}

const AVAILABLE_LANGUAGES = [
    'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian', 'Japanese', 'Korean', 'Chinese',
    'Hindi', 'Arabic', 'Turkish', 'Dutch', 'Polish', 'Swedish', 'Indonesian', 'Thai', 'Vietnamese',
    'Greek', 'Czech', 'Finnish', 'Hungarian', 'Romanian', 'Danish', 'Norwegian', 'Hebrew', 'Ukrainian', 'Malay',
    'Filipino', 'Bengali', 'Punjabi', 'Tamil', 'Telugu', 'Marathi', 'Urdu', 'Persian', 'Swahili', 'Bulgarian',
    'Croatian', 'Serbian', 'Slovak', 'Lithuanian', 'Latvian', 'Estonian', 'Slovenian', 'Icelandic', 'Albanian'
].sort()

export function StreamingSettings() {
  const [loading, setLoading] = useState(false)
  const [currentProfileId, setCurrentProfileId] = useState<string>('')
  const [settings, setSettings] = useState<StreamingSettingsData>(DEFAULT_SETTINGS)
  const [showSortingContent, setShowSortingContent] = useState(false)
  const [languageToAdd, setLanguageToAdd] = useState('')
  const [draggedItem, setDraggedItem] = useState<{ type: string, index: number } | null>(null)
  
  // Local state for slider to prevent API spam/lag
  const [localAutoPlayWait, setLocalAutoPlayWait] = useState<number>(10)

  // Sync local slider state when settings load
  useEffect(() => {
    setLocalAutoPlayWait(settings.autoPlayWaitSeconds)
  }, [settings.autoPlayWaitSeconds])
  




  const handleDragStart = (e: React.DragEvent, type: string, index: number) => {
    setDraggedItem({ type, index })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (!draggedItem) return
  }

  const handleDrop = (e: React.DragEvent, type: string, index: number) => {
    e.preventDefault()
    if (!draggedItem || draggedItem.type !== type || draggedItem.index === index) return

    if (type === 'sorting') {
        const newSorting = [...settings.sorting]
        const [moved] = newSorting.splice(draggedItem.index, 1)
        newSorting.splice(index, 0, moved)
        updateSetting('sorting', newSorting)
    } else if (type === 'language') {
        const newLangs = [...settings.selectedLanguages]
        const [moved] = newLangs.splice(draggedItem.index, 1)
        newLangs.splice(index, 0, moved)
        updateSetting('selectedLanguages', newLangs)
    } else if (type === 'resolution') {
        const newResolutions = [...settings.resolutions]
        const [moved] = newResolutions.splice(draggedItem.index, 1)
        newResolutions.splice(index, 0, moved)
        updateSetting('resolutions', newResolutions)
    }
    setDraggedItem(null)
  }

  const loadSettings = async (profileId: string) => {
    if (!profileId) return
    try {
      setLoading(true)
      const res = await apiFetch(`/api/streaming/settings?settingsProfileId=${profileId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.data) {
          const loaded = data.data
          const merged: StreamingSettingsData = { ...DEFAULT_SETTINGS }

          // Handle StreamConfig structure (backend format)
          if (loaded.filters) {
              // Resolutions
              if (loaded.filters.resolution?.preferred) {
                  const enabledSet = new Set(loaded.filters.resolution.preferred)
                  merged.resolutions = DEFAULT_SETTINGS.resolutions.map(r => ({
                      ...r,
                      enabled: enabledSet.has(r.id)
                  }))
              }

              // Languages
              if (loaded.filters.language?.preferred) {
                  merged.selectedLanguages = loaded.filters.language.preferred
              }

              // Max File Size (convert bytes to GB)
              if (loaded.filters.size?.movies?.max) {
                  merged.maxFileSize = Math.round(loaded.filters.size.movies.max / (1024 * 1024 * 1024))
              }
          }

          // Sorting - prefer sortingConfig if available (has direction info)
          if (loaded.sortingConfig?.items) {
              const newSorting: any[] = []
              loaded.sortingConfig.items.forEach((item: any) => {
                  const def = DEFAULT_SETTINGS.sorting.find(s => s.id === item.id)
                  if (def) newSorting.push({ 
                      ...def, 
                      enabled: item.enabled, 
                      direction: item.direction || def.direction 
                  })
              })
              // Add any missing items from defaults
              DEFAULT_SETTINGS.sorting.forEach(def => {
                  if (!newSorting.find(s => s.id === def.id)) {
                      newSorting.push({ ...def, enabled: false })
                  }
              })
              merged.sorting = newSorting
          } else if (loaded.sorting?.global) {
              // Legacy format fallback
              const newSorting: any[] = []
              loaded.sorting.global.forEach((id: string) => {
                  const def = DEFAULT_SETTINGS.sorting.find(s => s.id === id)
                  if (def) newSorting.push({ ...def, enabled: true })
              })
              // Add disabled items
              DEFAULT_SETTINGS.sorting.forEach(def => {
                  if (!newSorting.find(s => s.id === def.id)) {
                      newSorting.push({ ...def, enabled: false })
                  }
              })
              merged.sorting = newSorting
          }


          // Legacy/Direct properties (fallback or custom fields)
          if (loaded.parental) merged.parental = loaded.parental
          if (loaded.sortingEnabled !== undefined) merged.sortingEnabled = loaded.sortingEnabled
          if (loaded.qualities) merged.qualities = loaded.qualities // Keep qualities as is for now
          
          // Load playback settings
          if (loaded.playback?.autoPlayMaxWaitMs) {
            merged.autoPlayWaitSeconds = Math.round(loaded.playback.autoPlayMaxWaitMs / 1000)
          }
          
          // Load stream display settings
          if (loaded.streamDisplay) {
            if (loaded.streamDisplay.showAddonName !== undefined) merged.showAddonName = loaded.streamDisplay.showAddonName
            if (loaded.streamDisplay.showDescription !== undefined) merged.showDescription = loaded.streamDisplay.showDescription
            if (loaded.streamDisplay.streamDisplayMode) merged.streamDisplayMode = loaded.streamDisplay.streamDisplayMode
          }

          setSettings(merged)
        }
      }
    } catch (e) {
      console.error('Failed to load settings', e)
    } finally {
        setLoading(false)
    }
  }

  const saveSettings = async (newSettings: StreamingSettingsData) => {
    if (!currentProfileId) return

    // Map to StreamConfig structure
    const streamConfig = {
        filters: {
            resolution: {
                preferred: newSettings.resolutions.filter(r => r.enabled).map(r => r.id)
            },
            language: {
                preferred: newSettings.selectedLanguages
            },
            size: newSettings.maxFileSize > 0 ? {
                movies: { max: newSettings.maxFileSize * 1024 * 1024 * 1024, min: 0 },
                series: { max: newSettings.maxFileSize * 1024 * 1024 * 1024, min: 0 }
            } : undefined,
            // Preserve other filters if needed, or default
            cache: { cached: true, uncached: true, applyMode: 'OR' }
        },
        sorting: {
            global: newSettings.sorting.filter(s => s.enabled).map(s => s.id)
        },
        // Extended sorting config with direction support
        sortingConfig: {
            items: newSettings.sorting.map(s => ({
                id: s.id,
                enabled: s.enabled,
                direction: s.direction
            }))
        },
        // Custom fields
        parental: newSettings.parental,
        sortingEnabled: newSettings.sortingEnabled,
        qualities: newSettings.qualities,
        // Playback and display settings
        playback: {
          autoPlayMaxWaitMs: newSettings.autoPlayWaitSeconds * 1000
        },
        streamDisplay: {
          showAddonName: newSettings.showAddonName,
          showDescription: newSettings.showDescription,
          streamDisplayMode: newSettings.streamDisplayMode
        }
    }


    try {
      const res = await apiFetch(`/api/streaming/settings?settingsProfileId=${currentProfileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(streamConfig)
      })
      
      if (res.ok) {
        setSettings(newSettings)
        toast.success('Settings Saved', { description: 'Streaming settings updated' })
      } else {
        toast.error('Save Failed', { description: 'Failed to save settings' })
      }
    } catch (e) {
      console.error('Failed to save settings', e)
    }
  }

  const handleProfileChange = (newProfileId: string) => {
    if (!newProfileId) return
    setCurrentProfileId(newProfileId)
    localStorage.setItem('lastSelectedStreamingProfile', newProfileId)
    loadSettings(newProfileId)
  }

  const handleProfilesLoaded = (profilesList: any[]) => {
      // Logic to auto-select profile if not selected
      const lastSelected = localStorage.getItem('lastSelectedStreamingProfile')
      if (lastSelected && profilesList.some(p => String(p.id) === lastSelected)) {
          handleProfileChange(lastSelected)
      } else if (profilesList.length > 0) {
          handleProfileChange(String(profilesList[0].id))
      }
  }

  const updateSetting = (key: keyof StreamingSettingsData, value: any) => {
      const newSettings = { ...settings, [key]: value }
      saveSettings(newSettings)
  }

  const toggleResolution = (id: string) => {
      const newResolutions = settings.resolutions.map(r => 
          r.id === id ? { ...r, enabled: !r.enabled } : r
      )
      updateSetting('resolutions', newResolutions)
  }

  const toggleQuality = (quality: string) => {
      const newQualities = settings.qualities.includes(quality)
          ? settings.qualities.filter(q => q !== quality)
          : [...settings.qualities, quality]
      updateSetting('qualities', newQualities)
  }

  const toggleSortItem = (id: string) => {
      const newSorting = settings.sorting.map(s => 
          s.id === id ? { ...s, enabled: !s.enabled } : s
      )
      updateSetting('sorting', newSorting)
  }

  const toggleSortDirection = (id: string) => {
      const newSorting = settings.sorting.map(s => 
          s.id === id ? { ...s, direction: s.direction === 'asc' ? 'desc' : 'asc' } : s
      )
      // @ts-expect-error
      updateSetting('sorting', newSorting)
  }

  const addLanguage = () => {
      if (languageToAdd && !settings.selectedLanguages.includes(languageToAdd)) {
          updateSetting('selectedLanguages', [...settings.selectedLanguages, languageToAdd])
          setLanguageToAdd('')
      }
  }

  const removeLanguage = (lang: string) => {
      updateSetting('selectedLanguages', settings.selectedLanguages.filter(l => l !== lang))
  }

  if (loading && !settings) return <div className={styles.settingsCard}>Loading streaming settings...</div>

  return (
    <div className={styles.tabContent}>
      <div className={styles.settingsCard}>
        <h2 className={styles.sectionTitle}>Streaming Preferences <span className={styles.infoIcon} title="Configure your streaming preferences">?</span></h2>

        {/* Profile Selector */}
        <div className={styles.settingItem} style={{ alignItems: 'flex-start' }}>
            <div className="w-full">
                 <SettingsProfileSelector
                    currentProfileId={currentProfileId}
                    onProfileChange={handleProfileChange}
                    onProfilesLoaded={handleProfilesLoaded}
                />
            </div>
        </div>



        {/* Sorting & Filtering */}
        <div className={`${styles.settingItem} !flex-col !items-start`}>
            <div className="w-full flex justify-between items-center bg-transparent">
                <div>
                    <h3>Sorting & Filtering</h3>
                    <p>Configure advanced sorting and filtering options.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <Toggle 
                        checked={settings.sortingEnabled} 
                        onChange={(checked) => updateSetting('sortingEnabled', checked)} 
                        title="Enable/Disable Sorting & Filtering"
                    />
                    <button 
                        className={`${styles.dropdownToggle} ${showSortingContent ? styles.dropdownToggleOpen : ''}`}
                        onClick={() => setShowSortingContent(!showSortingContent)}
                        aria-label="Toggle sorting options"
                    >
                        <ChevronDown size={18} />
                    </button>
                </div>
            </div>
            
            {showSortingContent && (
                <div style={{ marginTop: '20px', width: '100%', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px', opacity: settings.sortingEnabled ? 1 : 0.5, pointerEvents: settings.sortingEnabled ? 'auto' : 'none' }}>
                    
                    {/* Resolutions */}
                    <div className={styles.settingSection}>
                        <div className={styles.sectionHeader}>
                            <h3>Select Streaming Resolutions:</h3>
                            <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '5px' }}>Drag to reorder priority</p>
                        </div>
                        <div className={styles.gridOptions}>
                            {settings.resolutions.map((res, index) => (
                                <div
                                    key={res.id}
                                    className={`${styles.optionCard} ${styles.resolutionCard} ${res.enabled ? styles.selected : ''}`}
                                    onClick={() => toggleResolution(res.id)}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, 'resolution', index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={(e) => handleDrop(e, 'resolution', index)}
                                    style={{ cursor: 'grab' }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Monitor size={16} className={styles.optionIcon} />
                                        <span className={styles.optionLabel} style={{ flex: 1 }}>{res.id}</span>
                                    </div>
                                    <span className={styles.optionCheck}>✓</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Qualities */}
                    <div className={styles.settingSection}>
                        <div className={styles.sectionHeader}>
                            <h3>Select Quality Filter:</h3>
                        </div>
                        <div className={styles.gridOptions}>
                            {DEFAULT_SETTINGS.qualities.map(qual => (
                                <div 
                                    key={qual} 
                                    className={`${styles.optionCard} ${styles.qualityCard} ${settings.qualities.includes(qual) ? styles.selected : ''}`}
                                    onClick={() => toggleQuality(qual)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Disc size={16} className={styles.optionIcon} />
                                        <span className={styles.optionLabel}>{qual}</span>
                                    </div>
                                    <span className={styles.optionCheck}>✓</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* File Size */}
                    <div className={styles.settingSection}>
                        <div className={styles.sectionHeader}>
                            <h3>Set File Size Filter:</h3>
                        </div>
                        <div className={styles.sliderContainer}>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                className={styles.slider}
                                value={settings.maxFileSize}
                                onChange={(e) => updateSetting('maxFileSize', parseInt(e.target.value))}
                                style={{
                                    background: `linear-gradient(90deg, var(--accent, #e50914) ${settings.maxFileSize}%, rgba(255,255,255,0.06) ${settings.maxFileSize}%)`
                                }}
                            />
                            <div className={styles.sliderValue}>Max File Size: <span>{settings.maxFileSize === 0 ? 'Unlimited' : `${settings.maxFileSize} GB`}</span></div>
                        </div>
                    </div>

                    {/* Sorting Priority */}
                    <div className={styles.settingSection}>
                        <div className={styles.sectionHeader}>
                            <h3>Select & Arrange Sorting Priority:</h3>
                            <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '5px' }}>Drag to reorder priority</p>
                        </div>
                        <div className={styles.sortableGrid}>
                            {settings.sorting.map((item, index) => (
                                <div
                                    key={item.id}
                                    className={`${styles.sortableItem} ${item.id === 'resolution' ? styles.resolutionItem : ''} ${item.id === 'quality' ? styles.qualityItem : ''}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, 'sorting', index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={(e) => handleDrop(e, 'sorting', index)}
                                >
                                    <div className={styles.sortHandle}>
                                        ☰
                                    </div>
                                    <div className={styles.sortContent}>
                                        <div className={styles.sortLeft}>
                                            <label className={styles.sortLabel}>
                                                <input
                                                    type="checkbox"
                                                    checked={item.enabled}
                                                    onChange={() => toggleSortItem(item.id)}
                                                />
                                                {item.id === 'resolution' && <Monitor size={16} className="mr-2" style={{marginRight: '6px'}} />}
                                                {item.id === 'quality' && <Disc size={16} className="mr-2" style={{marginRight: '6px'}} />}
                                                {item.name}
                                            </label>
                                        </div>
                                        <div className={styles.sortRight}>
                                            <button className={styles.sortDirectionBtn} onClick={() => toggleSortDirection(item.id)}>
                                                <i>{item.direction === 'asc' ? '↑' : '↓'}</i>
                                                <span>
                                                    {item.directionLabels ? 
                                                        (item.direction === 'asc' ? item.directionLabels.asc : item.directionLabels.desc) : 
                                                        (item.direction === 'asc' ? 'Asc' : 'Desc')
                                                    }
                                                </span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Languages */}
                    <div className={styles.settingSection}>
                        <div className={styles.sectionHeader}>
                            <h3>Language Preferences:</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <select 
                                    value={languageToAdd}
                                    onChange={(e) => setLanguageToAdd(e.target.value)}
                                    style={{ flex: 1, padding: '10px', borderRadius: '6px', background: '#333', color: 'white', border: '1px solid #555' }}
                                >
                                    <option value="">Select a language to add...</option>
                                    {AVAILABLE_LANGUAGES.filter(l => !settings.selectedLanguages.includes(l)).map(l => (
                                        <option key={l} value={l}>{l}</option>
                                    ))}
                                </select>
                                <Button variant="primary" onClick={addLanguage} style={{ padding: '0 20px' }}>Add</Button>
                            </div>
                            
                            <div className={styles.sortableList}>
                                {settings.selectedLanguages.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>No languages selected.</div>}
                                {settings.selectedLanguages.map((lang, index) => (
                                    <div
                                        key={lang}
                                        className={styles.languageItem}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, 'language', index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDrop={(e) => handleDrop(e, 'language', index)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div className={styles.sortHandle} style={{ cursor: 'grab', padding: '5px' }}>
                                                ☰
                                            </div>
                                            <span>{lang}</span>
                                        </div>
                                        <button onClick={() => removeLanguage(lang)} style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', padding: '5px' }}>✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            )}
        </div>

        {/* Playback & Display Settings */}
        <div className={`${styles.settingItem} !flex-col !items-start`} style={{ marginTop: '20px' }}>
            <div className="w-full">
                <h3 style={{ marginBottom: '16px' }}>Playback & Display</h3>
                
                {/* Auto-Play Wait Time */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>
                        Auto-Play Wait Time: <strong>{localAutoPlayWait} seconds</strong>
                    </label>
                    <input
                        type="range"
                        min="5"
                        max="30"
                        step="1"
                        value={localAutoPlayWait}
                        onChange={(e) => setLocalAutoPlayWait(parseInt(e.target.value))}
                        onMouseUp={() => updateSetting('autoPlayWaitSeconds', localAutoPlayWait)}
                        onTouchEnd={() => updateSetting('autoPlayWaitSeconds', localAutoPlayWait)}
                        style={{
                            width: '100%',
                            accentColor: 'var(--accent, #e50914)'
                        }}
                    />
                    <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                        How long to wait for streams before auto-selecting the best one
                    </p>
                </div>

                {/* Stream Display Mode */}
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#ccc' }}>
                        Stream Display Mode
                    </label>
                    <select
                        value={settings.streamDisplayMode}
                        onChange={(e) => updateSetting('streamDisplayMode', e.target.value as 'compact' | 'classic')}
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#fff',
                            fontSize: '0.9rem',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="compact-simple" style={{ background: '#1f2937' }}>Compact (Simple)</option>
                        <option value="compact-advanced" style={{ background: '#1f2937' }}>Compact (Advanced)</option>
                        <option value="classic" style={{ background: '#1f2937' }}>Classic</option>
                    </select>
                    <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                        Simple: Essential tags only • Advanced: All parsed tags • Classic: Addon title + description
                    </p>
                </div>


            </div>
        </div>

      </div>
    </div>
  )
}