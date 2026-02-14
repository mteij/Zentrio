/**
 * useHybridPlayer - React hook for hybrid media playback
 *
 * Provides a simple interface for using the HybridEngine
 * with automatic cleanup and state management.
 *
 * IMPORTANT: Hybrid playback is NOT supported in Tauri apps.
 * Tauri uses native system decoders which support more codecs than browsers.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { HybridEngine } from '../services/hybrid-media/HybridEngine'
import { TranscoderService } from '../services/hybrid-media/TranscoderService'
import type { StreamInfo, EngineState, HybridEngineConfig, StreamType, CodecInfo, MediaMetadata } from '../services/hybrid-media/types'

/**
 * Check if running in Tauri environment
 * Hybrid playback is disabled in Tauri - uses native playback instead
 */
function isTauri(): boolean {
  return typeof window !== 'undefined' &&
         ((window as any).__TAURI_INTERNALS__ !== undefined || (window as any).__TAURI__ !== undefined)
}

export interface UseHybridPlayerOptions {
  /** Media URL to play */
  url: string
  /** Video element ref */
  videoRef: React.RefObject<HTMLVideoElement>
  /** Engine configuration */
  config?: HybridEngineConfig
  /** Auto-play when ready */
  autoPlay?: boolean
  /** Callback when playback ends */
  onEnded?: () => void
  /** Callback on time update */
  onTimeUpdate?: (currentTime: number, duration: number) => void
  /** Callback on error */
  onError?: (error: Error) => void
  /** Callback on transcoding progress */
  onTranscodingProgress?: (progress: number) => void
}

export interface UseHybridPlayerReturn {
  /** Whether the engine is ready for playback */
  isReady: boolean
  /** Whether playback is active */
  isPlaying: boolean
  /** Whether buffering */
  isBuffering: boolean
  /** Current playback time in seconds */
  currentTime: number
  /** Total duration in seconds */
  duration: number
  /** Detected streams */
  streams: StreamInfo[]
  /** Current engine state */
  state: EngineState
  /** Error if any */
  error: Error | null
  /** Whether hybrid playback is needed (has rare audio codec) */
  needsHybridPlayback: boolean
  /** Transcoding progress (0-100) or null if not transcoding */
  transcodingProgress: number | null
  
  // Actions
  play: () => Promise<void>
  pause: () => Promise<void>
  seek: (time: number) => Promise<void>
  destroy: () => Promise<void>
}

export function useHybridPlayer(options: UseHybridPlayerOptions): UseHybridPlayerReturn {
  const {
    url,
    videoRef,
    config,
    autoPlay = false,
    onEnded,
    onTimeUpdate,
    onError,
    onTranscodingProgress
  } = options

  const engineRef = useRef<HybridEngine | null>(null)
  
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [streams, setStreams] = useState<StreamInfo[]>([])
  const [state, setState] = useState<EngineState>('idle')
  const [error, setError] = useState<Error | null>(null)
  const [needsHybridPlayback, setNeedsHybridPlayback] = useState(false)
  const [transcodingProgress, setTranscodingProgress] = useState<number | null>(null)

  // Initialize engine when URL changes
  useEffect(() => {
    if (!url) return

    let cancelled = false

    const toCodecInfo = (s: { codec_id?: number; codec_name?: string }): CodecInfo => {
      const codecName = (s.codec_name ?? 'unknown').toLowerCase()
      return {
        codecId: s.codec_id ?? 0,
        codecName,
        codecString: codecName
      }
    }

    const buildStreamInfo = (metadata: MediaMetadata): StreamInfo[] => {
      const durationSec = metadata.format?.duration ?? 0
      return (metadata.streams ?? []).flatMap((s) => {
        const type = s.codec_type as StreamType | undefined
        if (!type) return []
        return [{
          index: s.index,
          type,
          codec: toCodecInfo(s),
          duration: durationSec,
          bitrate: s.bit_rate,
          width: s.width,
          height: s.height,
          sampleRate: s.sample_rate,
          channels: s.channels
        }]
      })
    }

    const initEngine = async () => {
      try {
        // Guard: Hybrid playback is not supported in Tauri
        if (isTauri()) {
          const error = new Error('Hybrid playback is not supported in Tauri apps. Use native playback instead.')
          setError(error)
          setState('error')
          onError?.(error)
          return
        }

        setIsReady(false)
        setIsPlaying(false)
        setIsBuffering(false)
        setError(null)
        setState('initializing')
        setTranscodingProgress(null)

        // Cleanup previous engine
        if (engineRef.current) {
          await engineRef.current.destroy()
          engineRef.current = null
        }

        const videoEl = videoRef.current
        if (!videoEl) return

        // Probe metadata (required for current HybridEngine API)
        const metadata = await TranscoderService.probe(url)
        if (!metadata) throw new Error('Failed to probe media metadata')

        const mergedConfig: HybridEngineConfig = {
          ...config,
          onError: (error) => {
            config?.onError?.(error)
            if (cancelled) return
            setError(error)
            setState('error')
            onError?.(error)
          },
          onProgress: (data) => {
            config?.onProgress?.(data)
            // Not transcoding progress; this is network progress.
          }
        }

        // Create new engine (new API)
        const engine = new HybridEngine(url, metadata, mergedConfig)
        engineRef.current = engine

        const durationSec = engine.getDuration()
        setDuration(durationSec)
        setNeedsHybridPlayback(engine.requiresHybridPlayback)
        setStreams(buildStreamInfo(metadata))

        // Listen for FFmpeg progress (0..1), convert to 0..100
        engine.addEventListener('progress', (e: Event) => {
          const detail = (e as CustomEvent<{ progress: number }>).detail
          const pct = typeof detail?.progress === 'number' ? Math.round(detail.progress * 100) : null
          if (cancelled) return
          setTranscodingProgress(pct)
          if (pct !== null) onTranscodingProgress?.(pct)
        })

        engine.addEventListener('timeupdate', (e: Event) => {
          const detail = (e as CustomEvent<{ currentTime: number }>).detail
          if (cancelled) return
          setCurrentTime(detail.currentTime ?? 0)
          onTimeUpdate?.(detail.currentTime ?? 0, engine.getDuration())
        })

        engine.addEventListener('ended', () => {
          if (cancelled) return
          setIsPlaying(false)
          setState('paused')
          onEnded?.()
        })

        // Initialize with video element
        await engine.initialize(videoEl)

        if (cancelled) return
        setIsReady(true)
        setState('ready')

        if (autoPlay) {
          await engine.play()
          if (cancelled) return
          setIsPlaying(true)
          setState('playing')
        }

        console.log('[useHybridPlayer] Engine initialized')
      } catch (err) {
        if (cancelled) return
        console.error('[useHybridPlayer] Initialization error:', err)
        const error = err instanceof Error ? err : new Error(String(err))
        setError(error)
        setState('error')
        onError?.(error)
      }
    }

    initEngine()

    // Cleanup on unmount
    return () => {
      cancelled = true
      if (engineRef.current) {
        engineRef.current.destroy()
        engineRef.current = null
      }
    }
  }, [url]) // Only re-initialize on URL change

  // Play handler
  const play = useCallback(async () => {
    if (!engineRef.current) return
    await engineRef.current.play()
    setIsPlaying(true)
    setState('playing')
  }, [])

  // Pause handler
  const pause = useCallback(async () => {
    if (!engineRef.current) return
    engineRef.current.pause()
    setIsPlaying(false)
    setState('paused')
  }, [])

  // Seek handler
  const seek = useCallback(async (time: number) => {
    if (!engineRef.current) return
    await engineRef.current.seek(time)
    setCurrentTime(time)
  }, [])

  // Destroy handler
  const destroy = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.destroy()
      engineRef.current = null
    }
    setIsReady(false)
    setIsPlaying(false)
    setStreams([])
    setState('destroyed')
  }, [])

  return {
    isReady,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    streams,
    state,
    error,
    needsHybridPlayback,
    transcodingProgress,
    play,
    pause,
    seek,
    destroy
  }
}
