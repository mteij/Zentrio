import { useState, useCallback, useRef, useEffect } from 'react'
import { Stream, Manifest } from '../services/addons/types'
import { toast } from 'sonner'

export type AddonStatus = 'idle' | 'loading' | 'done' | 'error'

export interface AddonLoadingState {
  id: string
  name: string
  logo?: string
  status: AddonStatus
  streamCount?: number
  error?: string
}

export interface FlatStream {
  stream: Stream
  addon: { id: string, name: string, logo?: string }
  parsed?: {
    resolution?: string
    encode?: string[]
    audioTags?: string[]
    audioChannels?: string[]
    visualTags?: string[]
    sourceType?: string
    seeders?: number
    size?: number  // in bytes
    languages?: string[]
    isCached?: boolean
  }
}

export interface CacheStatus {
  fromCache: boolean
  cacheAgeMs: number
}

interface UseStreamLoaderResult {
  streams: FlatStream[]
  filteredStreams: FlatStream[]
  addonStatuses: Map<string, AddonLoadingState>
  selectedAddon: string | null
  setSelectedAddon: (addonId: string | null) => void
  isLoading: boolean
  isComplete: boolean
  totalCount: number
  cacheStatus: CacheStatus | null
  loadStreams: (type: string, id: string, profileId: string, season?: number, episode?: number) => void
  refreshStreams: () => void  // Force refresh, bypass cache
  reset: () => void
}

/**
 * Hook for progressive stream loading via SSE.
 * Streams addon results as they arrive, updating UI in real-time.
 * Provides globally sorted stream list, cache status, and optional addon filtering.
 */
export function useStreamLoader(): UseStreamLoaderResult {
  const [streams, setStreams] = useState<FlatStream[]>([])
  const [addonStatuses, setAddonStatuses] = useState<Map<string, AddonLoadingState>>(new Map())
  const [selectedAddon, setSelectedAddon] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null)
  
  const eventSourceRef = useRef<EventSource | null>(null)
  
  // Store last request params for refresh
  const lastRequestRef = useRef<{
    type: string
    id: string
    profileId: string
    season?: number
    episode?: number
  } | null>(null)

  // Filter streams by selected addon
  const filteredStreams = selectedAddon
    ? streams.filter(s => s.addon.id === selectedAddon)
    : streams

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  const reset = useCallback(() => {
    eventSourceRef.current?.close()
    setStreams([])
    setAddonStatuses(new Map())
    setSelectedAddon(null)
    setIsLoading(false)
    setIsComplete(false)
    setTotalCount(0)
    setCacheStatus(null)
  }, [])

  const loadStreams = useCallback((
    type: string,
    id: string,
    profileId: string,
    season?: number,
    episode?: number,
    forceRefresh: boolean = false
  ) => {
    // Close any existing connection
    eventSourceRef.current?.close()
    
    // Store request params for potential refresh
    lastRequestRef.current = { type, id, profileId, season, episode }
    
    // Reset state
    setStreams([])
    setAddonStatuses(new Map())
    setSelectedAddon(null)
    setIsLoading(true)
    setIsComplete(false)
    setTotalCount(0)
    setCacheStatus(null)

    // Build URL
    let url = `/api/streaming/streams-live/${type}/${id}?profileId=${profileId}`
    if (season !== undefined && episode !== undefined) {
      url += `&season=${season}&episode=${episode}`
    }
    if (forceRefresh) {
      url += '&refresh=true'
    }

    // Create EventSource
    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    // Listen for cache-status event
    eventSource.addEventListener('cache-status', (e) => {
      const data = JSON.parse(e.data)
      setCacheStatus({
        fromCache: data.fromCache,
        cacheAgeMs: data.cacheAgeMs || 0
      })
    })

    eventSource.addEventListener('addon-start', (e) => {
      const data = JSON.parse(e.data)
      setAddonStatuses(prev => {
        const next = new Map(prev)
        next.set(data.addon.id, {
          id: data.addon.id,
          name: data.addon.name,
          logo: data.addon.logo,
          status: 'loading'
        })
        return next
      })
    })

    eventSource.addEventListener('addon-result', (e) => {
      const data = JSON.parse(e.data)
      
      // Update addon status
      setAddonStatuses(prev => {
        const next = new Map(prev)
        next.set(data.addon.id, {
          id: data.addon.id,
          name: data.addon.name,
          logo: data.addon.logo,
          status: 'done',
          streamCount: data.count
        })
        return next
      })

      // Use the globally sorted allStreams from the server
      if (data.allStreams) {
        setStreams(data.allStreams)
        setTotalCount(data.allStreams.length)
      }
    })

    eventSource.addEventListener('addon-error', (e) => {
      const data = JSON.parse(e.data)

      const errorMsg = data.error || 'Unknown error'
      const isTimeout = errorMsg.toLowerCase().includes('timeout') || errorMsg.toLowerCase().includes('abort')
      toast.error(`${data.addon.name} failed`, {
        description: isTimeout ? 'Request timed out' : errorMsg
      })

      setAddonStatuses(prev => {
        const next = new Map(prev)
        next.set(data.addon.id, {
          id: data.addon.id,
          name: data.addon.name,
          logo: data.addon.logo,
          status: 'error',
          error: data.error
        })
        return next
      })
    })

    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data)
      if (data.allStreams) {
        setStreams(data.allStreams)
        setTotalCount(data.totalCount || data.allStreams.length)
      }
      // Update cache status with fromCache info from complete event
      if (data.fromCache !== undefined) {
        setCacheStatus(prev => prev ? { ...prev, fromCache: data.fromCache } : null)
      }
      setIsLoading(false)
      setIsComplete(true)
      eventSource.close()
    })

    eventSource.addEventListener('error', (e) => {
      console.error('SSE error:', e)
      setIsLoading(false)
      eventSource.close()
    })
  }, [])

  // Refresh function - reloads with cache bypass
  const refreshStreams = useCallback(() => {
    const last = lastRequestRef.current
    if (last) {
      loadStreams(last.type, last.id, last.profileId, last.season, last.episode, true)
    }
  }, [loadStreams])

  return {
    streams,
    filteredStreams,
    addonStatuses,
    selectedAddon,
    setSelectedAddon,
    isLoading,
    isComplete,
    totalCount,
    cacheStatus,
    loadStreams: (type, id, profileId, season?, episode?) => 
      loadStreams(type, id, profileId, season, episode, false),
    refreshStreams,
    reset
  }
}
