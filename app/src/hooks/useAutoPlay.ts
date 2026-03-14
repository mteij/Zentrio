/**
 * useAutoPlay Hook - Unified auto-play functionality for streaming
 *
 * Handles:
 * 1. Instant resume with lastStream (same episode)
 * 2. Pack matching for series
 * 3. Background stream fetching via the client-side stream resolver
 * 4. Automatic navigation to player
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Stream } from '../services/addons/types'
import {
  selectBestStreamWithPackPriority,
  DEFAULT_AUTO_PLAY_CONFIG,
  AutoPlayConfig,
  isStreamCached
} from '../services/addons/stream-service'
import { FlatStream } from './useStreamLoader'
import { resolveStreamsProgressive, type StreamResolveHandle } from '../lib/stream-resolver'

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
  lastStream?: Stream
  preferredPackId?: string | null
}

export interface UseAutoPlayResult {
  startAutoPlay: (params: AutoPlayParams) => void
  isLoading: boolean
  cancel: () => void
}

export function useAutoPlay(): UseAutoPlayResult {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const resolverRef = useRef<StreamResolveHandle | null>(null)
  const toastIdRef = useRef<string | number | null>(null)

  useEffect(() => {
    return () => {
      resolverRef.current?.cancel()
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current)
      }
    }
  }, [])

  const cancel = useCallback(() => {
    resolverRef.current?.cancel()
    resolverRef.current = null
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
    if (toastIdRef.current) {
      toast.dismiss(toastIdRef.current)
      toastIdRef.current = null
    }

    navigate(`/streaming/${profileId}/player`, {
      replace: false,
      state: {
        stream,
        meta: {
          id: meta.id,
          type: meta.type,
          name: meta.name,
          poster: meta.poster,
          season,
          episode
        }
      }
    })
  }, [navigate])

  const startAutoPlay = useCallback((params: AutoPlayParams) => {
    const { profileId, meta, season, episode, lastStream, preferredPackId } = params

    if (lastStream) {
      navigateToPlayer(profileId, lastStream, meta, season, episode)
      return
    }

    setIsLoading(true)

    const loadingMessage = meta.type === 'series' && season && episode
      ? `Finding best stream for S${season}:E${episode}...`
      : `Finding best stream for ${meta.name}...`

    toastIdRef.current = toast.loading(loadingMessage, { id: 'autoplay-loading' })
    resolverRef.current?.cancel()

    let allStreams: FlatStream[] = []
    let hasNavigated = false

    const maybeNavigateEarly = () => {
      if (hasNavigated || allStreams.length === 0) return

      const config: AutoPlayConfig = { ...DEFAULT_AUTO_PLAY_CONFIG }
      const selected = selectBestStreamWithPackPriority(
        allStreams.map((item) => ({ stream: item.stream, addon: item.addon })),
        config,
        preferredPackId
      )

      if (!selected) return
      if (!isStreamCached(selected.stream)) return

      hasNavigated = true
      resolverRef.current?.cancel()
      setIsLoading(false)
      navigateToPlayer(profileId, selected.stream, meta, season, episode)
    }

    const resolver = resolveStreamsProgressive({
      type: meta.type,
      id: meta.id,
      profileId,
      season,
      episode,
      meta,
    }, {
      onAddonResult: (data) => {
        if (data.allStreams) {
          allStreams = data.allStreams
        }
        maybeNavigateEarly()
      },
      onComplete: (data) => {
        allStreams = data.allStreams || allStreams
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

        const config: AutoPlayConfig = { ...DEFAULT_AUTO_PLAY_CONFIG }
        const selected = selectBestStreamWithPackPriority(
          allStreams.map((item) => ({ stream: item.stream, addon: item.addon })),
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
      }
    })

    resolverRef.current = resolver

    void resolver.done.then((result) => {
      if (result || hasNavigated) return
      setIsLoading(false)
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current)
        toastIdRef.current = null
      }
      toast.error('Failed to load streams. Please try again.')
    })
  }, [navigateToPlayer])

  return {
    startAutoPlay,
    isLoading,
    cancel
  }
}
