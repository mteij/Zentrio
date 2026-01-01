import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/apiFetch'

export interface StreamDisplaySettings {
  showAddonName: boolean
  showDescription: boolean
  autoPlayWaitSeconds: number
  streamDisplayMode: 'compact-simple' | 'compact-advanced' | 'classic'
}

const DEFAULT_SETTINGS: StreamDisplaySettings = {
  showAddonName: true,
  showDescription: true,
  autoPlayWaitSeconds: 10,
  streamDisplayMode: 'compact-simple'
}

/**
 * Hook to fetch stream display settings for the current profile
 */
export function useStreamDisplaySettings(profileId: string | undefined): StreamDisplaySettings {
  const [settings, setSettings] = useState<StreamDisplaySettings>(DEFAULT_SETTINGS)

  useEffect(() => {
    if (!profileId) return

    const fetchSettings = async () => {
      try {
        const res = await apiFetch(`/api/streaming/settings?profileId=${profileId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.data) {
            const loaded = data.data
            setSettings({
              showAddonName: loaded.streamDisplay?.showAddonName ?? true,
              showDescription: loaded.streamDisplay?.showDescription ?? true,
              autoPlayWaitSeconds: loaded.playback?.autoPlayMaxWaitMs 
                ? Math.round(loaded.playback.autoPlayMaxWaitMs / 1000) 
                : 10,
              streamDisplayMode: loaded.streamDisplay?.streamDisplayMode ?? 'compact'
            })
          }
        }
      } catch (e) {
        console.error('Failed to load stream display settings', e)
      }
    }

    fetchSettings()
  }, [profileId])

  return settings
}
