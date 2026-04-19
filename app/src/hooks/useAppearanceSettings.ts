import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/apiFetch'
import { createLogger } from '../utils/client-logger'

const log = createLogger('useAppearance')

export interface AppearanceSettings {
  showImdbRatings: boolean
  showAgeRatings: boolean
}

export interface AppearanceSettingsMutation {
  showImdbRatings?: boolean
  showAgeRatings?: boolean
}

export interface UseAppearanceSettingsResult extends AppearanceSettings {
  save: (updates: AppearanceSettingsMutation) => Promise<void>
}

const DEFAULT_SETTINGS: AppearanceSettings = {
  showImdbRatings: true,
  showAgeRatings: true,
}

export function useAppearanceSettings(profileId: string | undefined): UseAppearanceSettingsResult {
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULT_SETTINGS)

  const fetchSettings = useCallback(async () => {
    if (!profileId) return
    try {
      const res = await apiFetch(`/api/appearance/settings?profileId=${profileId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.data) {
          const loaded = data.data
          setSettings({
            showImdbRatings: loaded.show_imdb_ratings ?? true,
            showAgeRatings: loaded.show_age_ratings ?? true,
          })
        }
      }
    } catch (e) {
      log.error('Failed to load appearance settings', e)
    }
  }, [profileId])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const save = useCallback(
    async (updates: AppearanceSettingsMutation) => {
      if (!profileId) return

      // Optimistic update
      setSettings((prev) => {
        const next = { ...prev }
        if (updates.showImdbRatings !== undefined) next.showImdbRatings = updates.showImdbRatings
        if (updates.showAgeRatings !== undefined) next.showAgeRatings = updates.showAgeRatings
        return next
      })

      const body: Record<string, unknown> = {}
      if (updates.showImdbRatings !== undefined) body.show_imdb_ratings = updates.showImdbRatings
      if (updates.showAgeRatings !== undefined) body.show_age_ratings = updates.showAgeRatings

      try {
        await apiFetch(`/api/appearance/settings?profileId=${profileId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } catch (e) {
        log.error('Failed to save appearance settings', e)
        fetchSettings()
      }
    },
    [profileId, fetchSettings]
  )

  return { ...settings, save }
}
