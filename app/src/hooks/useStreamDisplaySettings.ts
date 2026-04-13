import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/apiFetch'
import { createLogger } from '../utils/client-logger'

const log = createLogger('useStreamDisplay')

export interface StreamDisplaySettings {
  showAddonName: boolean
  showDescription: boolean
  autoPlayWaitSeconds: number
  streamDisplayMode: 'compact-simple' | 'compact-advanced' | 'classic'
  introbdApiKey: string
}

const DEFAULT_SETTINGS: StreamDisplaySettings = {
  showAddonName: true,
  showDescription: true,
  autoPlayWaitSeconds: 10,
  streamDisplayMode: 'compact-simple',
  introbdApiKey: '',
}

export interface StreamDisplaySettingsMutation {
  showAddonName?: boolean
  showDescription?: boolean
  autoPlayWaitSeconds?: number
  streamDisplayMode?: 'compact-simple' | 'compact-advanced' | 'classic'
  introbdApiKey?: string
}

export interface UseStreamDisplaySettingsResult extends StreamDisplaySettings {
  save: (updates: StreamDisplaySettingsMutation) => Promise<void>
}

export function useStreamDisplaySettings(
  profileId: string | undefined
): UseStreamDisplaySettingsResult {
  const [settings, setSettings] = useState<StreamDisplaySettings>(DEFAULT_SETTINGS)
  const rawConfigRef = useRef<Record<string, unknown>>({})

  const fetchSettings = useCallback(async () => {
    if (!profileId) return
    try {
      const res = await apiFetch(`/api/streaming/settings?profileId=${profileId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.data) {
          const loaded = data.data
          rawConfigRef.current = loaded
          setSettings({
            showAddonName: loaded.streamDisplay?.showAddonName ?? true,
            showDescription: loaded.streamDisplay?.showDescription ?? true,
            autoPlayWaitSeconds:
              typeof loaded.playback?.autoPlayMaxWaitMs === 'number'
                ? Math.round(loaded.playback.autoPlayMaxWaitMs / 1000)
                : 10,
            streamDisplayMode: loaded.streamDisplay?.streamDisplayMode ?? 'compact-simple',
            introbdApiKey: loaded.introdb?.apiKey ?? '',
          })
        }
      }
    } catch (e) {
      log.error('Failed to load stream display settings', e)
    }
  }, [profileId])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const save = useCallback(
    async (updates: StreamDisplaySettingsMutation) => {
      if (!profileId) return

      // Optimistic update
      setSettings((prev) => {
        const next = { ...prev }
        if (updates.showAddonName !== undefined) next.showAddonName = updates.showAddonName
        if (updates.showDescription !== undefined) next.showDescription = updates.showDescription
        if (updates.autoPlayWaitSeconds !== undefined)
          next.autoPlayWaitSeconds = updates.autoPlayWaitSeconds
        if (updates.streamDisplayMode !== undefined)
          next.streamDisplayMode = updates.streamDisplayMode
        if (updates.introbdApiKey !== undefined) next.introbdApiKey = updates.introbdApiKey
        return next
      })

      const base = rawConfigRef.current
      const patch: Record<string, unknown> = {}

      const hasDisplayUpdates =
        updates.showAddonName !== undefined ||
        updates.showDescription !== undefined ||
        updates.streamDisplayMode !== undefined
      if (hasDisplayUpdates) {
        const existing = (base.streamDisplay as Record<string, unknown> | undefined) ?? {}
        patch.streamDisplay = {
          ...existing,
          ...(updates.showAddonName !== undefined && { showAddonName: updates.showAddonName }),
          ...(updates.showDescription !== undefined && {
            showDescription: updates.showDescription,
          }),
          ...(updates.streamDisplayMode !== undefined && {
            streamDisplayMode: updates.streamDisplayMode,
          }),
        }
      }

      if (updates.autoPlayWaitSeconds !== undefined) {
        const existing = (base.playback as Record<string, unknown> | undefined) ?? {}
        patch.playback = { ...existing, autoPlayMaxWaitMs: updates.autoPlayWaitSeconds * 1000 }
      }

      if (updates.introbdApiKey !== undefined) {
        const existing = (base.introdb as Record<string, unknown> | undefined) ?? {}
        patch.introdb = { ...existing, apiKey: updates.introbdApiKey }
      }

      const merged = { ...base, ...patch }
      rawConfigRef.current = merged

      try {
        await apiFetch(`/api/streaming/settings?profileId=${profileId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(merged),
        })
      } catch (e) {
        log.error('Failed to save stream display settings', e)
        // Re-fetch to restore consistent state after a failed save
        fetchSettings()
      }
    },
    [profileId, fetchSettings]
  )

  return { ...settings, save }
}
