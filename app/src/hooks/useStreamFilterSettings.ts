import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '../lib/apiFetch'
import { clearResolutionCache } from '../lib/stream-resolver'
import { createLogger } from '../utils/client-logger'
import type { StreamConfig } from '../services/addons/stream-processor'

const log = createLogger('useStreamFilterSettings')

const DEFAULT_CONFIG: StreamConfig = {
  filters: {
    cache: { cached: true, uncached: true, applyMode: 'OR' },
    resolution: { preferred: ['4k', '1080p', '720p', '480p'] },
    encode: {},
    sourceType: {},
    streamType: {},
    visualTag: {},
    audioTag: {},
    audioChannel: {},
    language: {},
    seeders: {},
    matching: { title: { enabled: false, mode: 'Partial' }, seasonEpisode: { enabled: true } },
    keyword: {},
    regex: {},
    size: {},
  },
  limits: { maxResults: 0, perService: 0, perAddon: 0, perResolution: 0 },
  deduplication: {
    mode: 'Per Service',
    detection: { filename: true, infoHash: true, smartDetect: true },
  },
  sorting: {},
  sortingConfig: {
    items: [
      { id: 'cached', enabled: true, direction: 'desc' },
      { id: 'resolution', enabled: true, direction: 'desc' },
      { id: 'sourceType', enabled: true, direction: 'desc' },
      { id: 'encode', enabled: true, direction: 'desc' },
      { id: 'visualTag', enabled: false, direction: 'desc' },
      { id: 'audioTag', enabled: false, direction: 'desc' },
      { id: 'audioChannels', enabled: false, direction: 'desc' },
      { id: 'seeders', enabled: false, direction: 'desc' },
      { id: 'size', enabled: false, direction: 'desc' },
      { id: 'language', enabled: false, direction: 'desc' },
    ],
  },
  playback: { autoPlayMaxWaitMs: 10000, addonRequestTimeoutMs: 15000 },
  introdb: { apiKey: '' },
  streamDisplay: {
    showAddonName: true,
    showDescription: true,
    streamDisplayMode: 'compact-simple',
  },
  parental: { enabled: false, ratingLimit: 'R' },
}

function deepMergeDefaults(
  base: Record<string, unknown>,
  loaded: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...base }
  for (const key of Object.keys(base)) {
    if (key in loaded) {
      const loadedVal = loaded[key]
      const baseVal = base[key]
      if (
        loadedVal &&
        typeof loadedVal === 'object' &&
        !Array.isArray(loadedVal) &&
        baseVal &&
        typeof baseVal === 'object' &&
        !Array.isArray(baseVal)
      ) {
        const loadedObj = loadedVal as Record<string, unknown>
        if (Object.keys(loadedObj).length > 0) {
          result[key] = deepMergeDefaults(baseVal as Record<string, unknown>, loadedObj)
        }
      } else if (loadedVal !== undefined) {
        result[key] = loadedVal
      }
    }
  }
  return result
}

function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...base }
  for (const key of Object.keys(patch)) {
    const patchVal = patch[key]
    const baseVal = base[key]
    if (
      patchVal &&
      typeof patchVal === 'object' &&
      !Array.isArray(patchVal) &&
      baseVal &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        patchVal as Record<string, unknown>
      )
    } else {
      result[key] = patchVal
    }
  }
  return result
}

export interface UseStreamFilterSettingsResult {
  config: StreamConfig
  loading: boolean
  save: (patch: Partial<StreamConfig>) => Promise<void>
  reset: () => Promise<void>
}

export function useStreamFilterSettings(
  profileId: string | undefined
): UseStreamFilterSettingsResult {
  const [config, setConfig] = useState<StreamConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(false)
  const rawRef = useRef<Record<string, unknown>>({})

  const fetchConfig = useCallback(async () => {
    if (!profileId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch(`/api/streaming/settings?profileId=${profileId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.data && Object.keys(data.data).length > 0) {
          const merged = deepMergeDefaults(
            DEFAULT_CONFIG as unknown as Record<string, unknown>,
            data.data
          )
          rawRef.current = merged
          setConfig(merged as unknown as StreamConfig)
        } else {
          rawRef.current = {}
          setConfig(DEFAULT_CONFIG)
        }
      }
    } catch (e) {
      log.error('Failed to load stream filter settings', e)
    } finally {
      setLoading(false)
    }
  }, [profileId])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const save = useCallback(
    async (patch: Partial<StreamConfig>) => {
      if (!profileId) return
      setConfig((prev) => ({ ...prev, ...patch }) as StreamConfig)
      const merged = deepMerge(rawRef.current, patch as Record<string, unknown>)
      rawRef.current = merged
      const mergedWithDefaults = deepMergeDefaults(
        DEFAULT_CONFIG as unknown as Record<string, unknown>,
        merged
      )
      rawRef.current = mergedWithDefaults
      try {
        await apiFetch(`/api/streaming/settings?profileId=${profileId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mergedWithDefaults),
        })
        clearResolutionCache(profileId)
      } catch (e) {
        log.error('Failed to save stream filter settings', e)
        fetchConfig()
      }
    },
    [profileId, fetchConfig]
  )

  const reset = useCallback(async () => {
    if (!profileId) return
    setConfig(DEFAULT_CONFIG)
    rawRef.current = {}
    try {
      await apiFetch(`/api/streaming/settings?profileId=${profileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      clearResolutionCache(profileId)
    } catch (e) {
      log.error('Failed to reset stream filter settings', e)
    }
  }, [profileId])

  return { config, loading, save, reset }
}
