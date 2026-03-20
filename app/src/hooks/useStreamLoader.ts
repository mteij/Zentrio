import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { resolveStreamsProgressive, type ResolvedFlatStream, type StreamResolveHandle } from '../lib/stream-resolver'
import { recordPerfEvent } from '../utils/performance'

export type AddonStatus = 'idle' | 'loading' | 'done' | 'error'

export interface AddonLoadingState {
  id: string
  name: string
  logo?: string
  status: AddonStatus
  streamCount?: number
  error?: string
}

export type FlatStream = ResolvedFlatStream

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
 * Hook for progressive stream loading via the client-side stream resolver.
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
  
  const resolverRef = useRef<StreamResolveHandle | null>(null)
  const pendingStreamsRef = useRef<FlatStream[] | null>(null)
  const flushRafRef = useRef<number | null>(null)
  const firstPlayableAppliedRef = useRef(false)
  const loadIdRef = useRef(0)

  // Batched addon status updates — accumulate changes in a ref, flush once per frame
  const addonStatusesRef = useRef<Map<string, AddonLoadingState>>(new Map())
  const statusDirtyRef = useRef(false)
  const statusFlushRafRef = useRef<number | null>(null)
  
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
      resolverRef.current?.cancel()
      if (flushRafRef.current !== null) {
        cancelAnimationFrame(flushRafRef.current)
        flushRafRef.current = null
      }
      if (statusFlushRafRef.current !== null) {
        cancelAnimationFrame(statusFlushRafRef.current)
        statusFlushRafRef.current = null
      }
    }
  }, [])

  const flushPendingStreams = useCallback(() => {
    flushRafRef.current = null
    const pending = pendingStreamsRef.current
    if (!pending) return
    pendingStreamsRef.current = null
    setStreams(pending)
    setTotalCount(pending.length)
  }, [])

  const scheduleStreamsUpdate = useCallback((nextStreams: FlatStream[]) => {
    pendingStreamsRef.current = nextStreams
    if (flushRafRef.current !== null) return
    flushRafRef.current = requestAnimationFrame(flushPendingStreams)
  }, [flushPendingStreams])

  // Flush accumulated addon status changes in one setState call
  const flushPendingStatuses = useCallback(() => {
    statusFlushRafRef.current = null
    if (!statusDirtyRef.current) return
    statusDirtyRef.current = false
    setAddonStatuses(new Map(addonStatusesRef.current))
  }, [])

  const scheduleStatusFlush = useCallback(() => {
    if (statusFlushRafRef.current !== null) return
    statusFlushRafRef.current = requestAnimationFrame(flushPendingStatuses)
  }, [flushPendingStatuses])

  const reset = useCallback(() => {
    resolverRef.current?.cancel()
    if (flushRafRef.current !== null) {
      cancelAnimationFrame(flushRafRef.current)
      flushRafRef.current = null
    }
    if (statusFlushRafRef.current !== null) {
      cancelAnimationFrame(statusFlushRafRef.current)
      statusFlushRafRef.current = null
    }
    pendingStreamsRef.current = null
    addonStatusesRef.current = new Map()
    statusDirtyRef.current = false
    firstPlayableAppliedRef.current = false
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
    loadIdRef.current += 1
    const currentLoadId = loadIdRef.current
    const requestStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()

    // Close any existing resolution
    resolverRef.current?.cancel()
    if (flushRafRef.current !== null) {
      cancelAnimationFrame(flushRafRef.current)
      flushRafRef.current = null
    }
    if (statusFlushRafRef.current !== null) {
      cancelAnimationFrame(statusFlushRafRef.current)
      statusFlushRafRef.current = null
    }
    pendingStreamsRef.current = null
    addonStatusesRef.current = new Map()
    statusDirtyRef.current = false
    firstPlayableAppliedRef.current = false
    
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

    // Guard: ignore events from a stale connection (when loadStreams was called again before this one finished)
    const isStale = () => loadIdRef.current !== currentLoadId

    const resolver = resolveStreamsProgressive({
      type,
      id,
      profileId,
      season,
      episode,
      forceRefresh,
    }, {
      onCacheStatus: (data) => {
        if (isStale()) return
        setCacheStatus({
          fromCache: data.fromCache,
          cacheAgeMs: data.cacheAgeMs || 0
        })
      },
      onAddonStart: ({ addon }) => {
        if (isStale()) return
        addonStatusesRef.current.set(addon.id, {
          id: addon.id,
          name: addon.name,
          logo: addon.logo,
          status: 'loading'
        })
        statusDirtyRef.current = true
        scheduleStatusFlush()
      },
      onAddonResult: (data) => {
        if (isStale()) return
        addonStatusesRef.current.set(data.addon.id, {
          id: data.addon.id,
          name: data.addon.name,
          logo: data.addon.logo,
          status: 'done',
          streamCount: data.count
        })
        statusDirtyRef.current = true
        scheduleStatusFlush()

        if (data.allStreams) {
          firstPlayableAppliedRef.current = true
          scheduleStreamsUpdate(data.allStreams)
        }
      },
      onFirstPlayable: (data) => {
        if (isStale()) return
        if (firstPlayableAppliedRef.current) return
        const first = data?.stream
        if (!first?.stream) return

        firstPlayableAppliedRef.current = true
        setStreams([first])
        setTotalCount(Math.max(1, data?.totalCount || 1))

        recordPerfEvent('streams_first_playable', {
          type,
          id,
          profileId,
          fromCache: cacheStatus?.fromCache ?? null,
          durationMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - requestStartedAt)
        })
      },
      onAddonError: (data) => {
        if (isStale()) return
        const errorMsg = data.error || 'Unknown error'
        const isTimeout = errorMsg.toLowerCase().includes('timeout') || errorMsg.toLowerCase().includes('abort')
        toast.error(`${data.addon.name} failed`, {
          description: isTimeout ? 'Request timed out' : errorMsg
        })

        addonStatusesRef.current.set(data.addon.id, {
          id: data.addon.id,
          name: data.addon.name,
          logo: data.addon.logo,
          status: 'error',
          error: data.error
        })
        statusDirtyRef.current = true
        scheduleStatusFlush()
      },
      onComplete: (data) => {
        if (isStale()) return
        if (data.allStreams) {
          firstPlayableAppliedRef.current = true
          if (flushRafRef.current !== null) {
            cancelAnimationFrame(flushRafRef.current)
            flushRafRef.current = null
          }
          pendingStreamsRef.current = null
          setStreams(data.allStreams)
          setTotalCount(data.totalCount || data.allStreams.length)
        }

        // Flush any pending status updates immediately rather than waiting for next frame
        if (statusFlushRafRef.current !== null) {
          cancelAnimationFrame(statusFlushRafRef.current)
          statusFlushRafRef.current = null
        }
        if (statusDirtyRef.current) {
          statusDirtyRef.current = false
          setAddonStatuses(new Map(addonStatusesRef.current))
        }

        setCacheStatus(prev => prev ? { ...prev, fromCache: data.fromCache } : prev)
        setIsLoading(false)
        setIsComplete(true)
        recordPerfEvent('streams_complete', {
          type,
          id,
          profileId,
          totalCount: data.totalCount || data.allStreams?.length || 0,
          fromCache: data.fromCache,
          durationMs: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - requestStartedAt)
        })
      }
    })

    resolverRef.current = resolver

    void resolver.done.then((data) => {
      if (isStale()) return
      if (data) return
      setIsLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleStreamsUpdate, scheduleStatusFlush])

  // Refresh function - reloads with cache bypass
  const refreshStreams = useCallback(() => {
    const last = lastRequestRef.current
    if (last) {
      loadStreams(last.type, last.id, last.profileId, last.season, last.episode, true)
    }
  }, [loadStreams])

  const loadStreamsPublic = useCallback((
    type: string,
    id: string,
    profileId: string,
    season?: number,
    episode?: number
  ) => {
    loadStreams(type, id, profileId, season, episode, false)
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
    loadStreams: loadStreamsPublic,
    refreshStreams,
    reset
  }
}
