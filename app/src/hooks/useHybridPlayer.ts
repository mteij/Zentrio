/**
 * useHybridPlayer - React hook for hybrid media playback
 * 
 * Provides a simple interface for using the HybridEngine
 * with automatic cleanup and state management.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { HybridEngine } from '../services/hybrid-media/HybridEngine'
import type { StreamInfo, EngineState, HybridEngineConfig } from '../services/hybrid-media/types'

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
    if (!url || !videoRef.current) return

    const initEngine = async () => {
      try {
        // Cleanup previous engine
        if (engineRef.current) {
          await engineRef.current.destroy()
        }

        // Create new engine
        const engine = new HybridEngine(config)
        engineRef.current = engine

        // Setup event listeners
        engine.addEventListener('statechange', (e: any) => {
          const newState = e.detail.state as EngineState
          setState(newState)
          setIsPlaying(newState === 'playing')
          setIsBuffering(newState === 'buffering' || newState === 'seeking')
        })

        engine.addEventListener('timeupdate', (e: any) => {
          const { currentTime: ct, duration: dur } = e.detail
          setCurrentTime(ct)
          setDuration(dur)
          onTimeUpdate?.(ct, dur)
        })

        engine.addEventListener('ended', () => {
          setIsPlaying(false)
          onEnded?.()
        })

        engine.addEventListener('error', (e: any) => {
          const err = e.detail.error
          setError(err)
          onError?.(err)
        })

        // Handle transcoding progress
        engine.addEventListener('transcoding', (e: any) => {
          if (e.detail.status === 'progress') {
            setTranscodingProgress(e.detail.progress)
            onTranscodingProgress?.(e.detail.progress)
          } else if (e.detail.status === 'complete') {
            setTranscodingProgress(null)
          }
        })

        // Initialize
        const detectedStreams = await engine.initialize(url)
        setStreams(detectedStreams)
        setDuration(engine.totalDuration)
        setNeedsHybridPlayback(engine.requiresHybridPlayback)

        // Attach video
        await engine.attachVideo(videoRef.current!)

        // Attach audio (FFmpeg handles transcoding internally)
        if (engine.requiresHybridPlayback) {
          await engine.attachAudio()
        }

        setIsReady(true)

        // Auto-play if requested
        if (autoPlay) {
          await engine.start()
        }

        console.log('[useHybridPlayer] Engine initialized')
      } catch (err) {
        console.error('[useHybridPlayer] Initialization error:', err)
        setError(err instanceof Error ? err : new Error(String(err)))
        onError?.(err instanceof Error ? err : new Error(String(err)))
      }
    }

    initEngine()

    // Cleanup on unmount
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy()
        engineRef.current = null
      }
    }
  }, [url]) // Only re-initialize on URL change

  // Play handler
  const play = useCallback(async () => {
    if (!engineRef.current) return
    await engineRef.current.start()
  }, [])

  // Pause handler
  const pause = useCallback(async () => {
    if (!engineRef.current) return
    await engineRef.current.pause()
  }, [])

  // Seek handler
  const seek = useCallback(async (time: number) => {
    if (!engineRef.current) return
    await engineRef.current.seek(time)
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
