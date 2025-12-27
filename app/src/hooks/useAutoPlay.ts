/**
 * useAutoPlay Hook - Unified auto-play functionality for streaming
 * 
 * Handles:
 * 1. Instant resume with lastStream (same episode)
 * 2. Pack matching for series (prefer streams from same torrent pack)
 * 3. Background stream fetching via SSE
 * 4. Automatic navigation to player
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Stream } from '../services/addons/types'
import { 
  selectBestStreamWithPackPriority, 
  getPackId,
  DEFAULT_AUTO_PLAY_CONFIG,
  AutoPlayConfig 
} from '../services/addons/stream-service'
import { FlatStream } from './useStreamLoader'

export interface AutoPlayMeta {
  id: string
  type: string
  name: string
  poster?: string
}

export interface AutoPlayParams {
  profileId: string
  meta: AutoPlayMeta
  season?: number
  episode?: number
  /** If resuming the same episode, use this stream directly */
  lastStream?: Stream
  /** infoHash or bingeGroup from last-watched episode for pack matching */
  preferredPackId?: string | null
}

export interface UseAutoPlayResult {
  /** Start auto-play process */
  startAutoPlay: (params: AutoPlayParams) => void
  /** Whether currently loading streams */
  isLoading: boolean
  /** Cancel ongoing auto-play */
  cancel: () => void
}

/**
 * Hook for unified auto-play functionality
 * 
 * Usage:
 * ```tsx
 * const { startAutoPlay, isLoading } = useAutoPlay()
 * 
 * // For continue watching with lastStream:
 * startAutoPlay({ 
 *   profileId, 
 *   meta: { id, type, name, poster },
 *   season: 1, 
 *   episode: 5,
 *   lastStream: item.lastStream,
 *   preferredPackId: getPackId(item.lastStream)
 * })
 * 
 * // For new play (will fetch streams):
 * startAutoPlay({ profileId, meta, season, episode })
 * ```
 */
export function useAutoPlay(): UseAutoPlayResult {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const toastIdRef = useRef<string | number | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current)
      }
    }
  }, [])

  const cancel = useCallback(() => {
    eventSourceRef.current?.close()
    eventSourceRef.current = null
    setIsLoading(false)
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current)
      toastIdRef.current = null
    }
  }, [])

  const navigateToPlayer = useCallback((
    profileId: string,
    stream: Stream,
    meta: AutoPlayMeta,
    season?: number,
    episode?: number
  ) => {
    // Dismiss loading toast
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current)
      toastIdRef.current = null
    }

    const playerMeta = {
      id: meta.id,
      type: meta.type,
      name: meta.name,
      poster: meta.poster,
      season,
      episode
    }

    // Navigate to player with stream in state (avoids URL encoding issues)
    // Use replace: true so back button goes to previous page, not details
    navigate(`/streaming/${profileId}/player`, {
      replace: true,
      state: {
        stream,
        meta: playerMeta
      }
    })
  }, [navigate])

  const startAutoPlay = useCallback((params: AutoPlayParams) => {
    const { profileId, meta, season, episode, lastStream, preferredPackId } = params

    // Case 1: We have a lastStream - use it directly
    if (lastStream) {
      navigateToPlayer(profileId, lastStream, meta, season, episode)
      return
    }

    // Case 2: Need to fetch streams
    setIsLoading(true)
    
    // Show loading toast
    const loadingMessage = meta.type === 'series' && season && episode
      ? `Finding best stream for S${season}:E${episode}...`
      : `Finding best stream for ${meta.name}...`
    
    toastIdRef.current = toast.loading(loadingMessage, { id: 'autoplay-loading' })

    // Close any existing connection
    eventSourceRef.current?.close()

    // Build SSE URL
    let url = `/api/streaming/streams-live/${meta.type}/${meta.id}?profileId=${profileId}`
    if (season !== undefined && episode !== undefined) {
      url += `&season=${season}&episode=${episode}`
    }

    // Create EventSource for progressive stream loading
    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    let allStreams: FlatStream[] = []
    let hasNavigated = false

    // Listen for addon results
    eventSource.addEventListener('addon-result', (e) => {
      const data = JSON.parse(e.data)
      
      // Use the globally sorted allStreams from the server
      if (data.allStreams) {
        allStreams = data.allStreams
      }
      
      // Try to auto-play as soon as we have good streams
      if (!hasNavigated && allStreams.length > 0) {
        const config: AutoPlayConfig = { ...DEFAULT_AUTO_PLAY_CONFIG }
        const selected = selectBestStreamWithPackPriority(
          allStreams.map(s => ({ stream: s.stream, addon: s.addon })),
          config,
          preferredPackId
        )
        
        if (selected) {
          // Check if this is a cached stream (good enough for early play)
          const isCached = selected.stream.name?.includes('⚡') || 
                          selected.stream.title?.includes('⚡') ||
                          selected.stream.name?.toLowerCase().includes('cached')
          
          if (isCached) {
            hasNavigated = true
            eventSource.close()
            setIsLoading(false)
            navigateToPlayer(profileId, selected.stream, meta, season, episode)
          }
        }
      }
    })

    // Listen for completion
    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data)
      if (data.allStreams) {
        allStreams = data.allStreams
      }

      eventSource.close()
      setIsLoading(false)

      if (hasNavigated) return

      if (allStreams.length === 0) {
        if (toastIdRef.current) {
          toast.dismiss(toastIdRef.current)
          toastIdRef.current = null
        }
        toast.error('No streams found. Please try manually.')
        return
      }

      // Select best stream with pack priority
      const config: AutoPlayConfig = { ...DEFAULT_AUTO_PLAY_CONFIG }
      const selected = selectBestStreamWithPackPriority(
        allStreams.map(s => ({ stream: s.stream, addon: s.addon })),
        config,
        preferredPackId
      )

      if (selected) {
        navigateToPlayer(profileId, selected.stream, meta, season, episode)
      } else {
        if (toastIdRef.current) {
          toast.dismiss(toastIdRef.current)
          toastIdRef.current = null
        }
        toast.error('Could not select a stream. Please try manually.')
      }
    })

    // Handle SSE errors
    eventSource.addEventListener('error', () => {
      eventSource.close()
      setIsLoading(false)
      if (!hasNavigated) {
        if (toastIdRef.current) {
          toast.dismiss(toastIdRef.current)
          toastIdRef.current = null
        }
        toast.error('Failed to load streams. Please try again.')
      }
    })

  }, [navigateToPlayer])

  return {
    startAutoPlay,
    isLoading,
    cancel
  }
}
