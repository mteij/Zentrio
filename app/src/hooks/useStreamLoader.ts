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
  loadStreams: (type: string, id: string, profileId: string, season?: number, episode?: number) => void
  reset: () => void
}

/**
 * Hook for progressive stream loading via SSE.
 * Streams addon results as they arrive, updating UI in real-time.
 * Provides globally sorted stream list and optional addon filtering.
 */
export function useStreamLoader(): UseStreamLoaderResult {
  const [streams, setStreams] = useState<FlatStream[]>([])
  const [addonStatuses, setAddonStatuses] = useState<Map<string, AddonLoadingState>>(new Map())
  const [selectedAddon, setSelectedAddon] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  
  const eventSourceRef = useRef<EventSource | null>(null)

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
  }, [])

  const loadStreams = useCallback((
    type: string,
    id: string,
    profileId: string,
    season?: number,
    episode?: number
  ) => {
    // Close any existing connection
    eventSourceRef.current?.close()
    
    // Reset state
    setStreams([])
    setAddonStatuses(new Map())
    setSelectedAddon(null)
    setIsLoading(true)
    setIsComplete(false)
    setTotalCount(0)

    // Build URL
    let url = `/api/streaming/streams-live/${type}/${id}?profileId=${profileId}`
    if (season !== undefined && episode !== undefined) {
      url += `&season=${season}&episode=${episode}`
    }

    // Create EventSource
    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

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

  return {
    streams,
    filteredStreams,
    addonStatuses,
    selectedAddon,
    setSelectedAddon,
    isLoading,
    isComplete,
    totalCount,
    loadStreams,
    reset
  }
}

