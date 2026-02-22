/**
 * usePlayerEngine Hook
 * 
 * Manages the player engine lifecycle and state.
 */

import { useRef, useState, useEffect, useCallback } from 'react'
import type { IPlayerEngine, PlayerState, MediaSource, SubtitleTrack, AudioTrack, QualityLevel } from '../engines/types'
import { createEngine, createEngineByType, detectEngineType, isTauriEnvironment } from '../engines'

interface UsePlayerEngineOptions {
  /** Auto-play when source is loaded */
  autoPlay?: boolean
  /** Start time in seconds */
  startTime?: number
  /** Callback when time updates */
  onTimeUpdate?: (currentTime: number, duration: number) => void
  /** Callback when playback ends */
  onEnded?: () => void
  /** Callback when error occurs */
  onError?: (error: Error) => void
  /** Callback when metadata loads */
  onMetadataLoad?: (duration: number) => void
  /** Callback when player is ready */
  onCanPlay?: () => void
}

interface UsePlayerEngineReturn {
  /** Video element ref to attach to video element */
  videoRef: React.RefObject<HTMLVideoElement | null>
  /** Current player state */
  state: PlayerState
  /** Whether the engine is loading */
  isLoading: boolean
  /** Any error that occurred */
  error: Error | null
  /** Play function */
  play: () => Promise<void>
  /** Pause function */
  pause: () => void
  /** Seek function */
  seek: (time: number) => Promise<void>
  /** Set volume (0-1) */
  setVolume: (volume: number) => void
  /** Set muted state */
  setMuted: (muted: boolean) => void
  /** Set playback rate */
  setPlaybackRate: (rate: number) => void
  /** Toggle play/pause */
  togglePlayPause: () => void
  /** Enter fullscreen */
  enterFullscreen: () => Promise<void>
  /** Exit fullscreen */
  exitFullscreen: () => Promise<void>
  /** Toggle fullscreen */
  toggleFullscreen: () => Promise<void>
  /** Whether in fullscreen */
  isFullscreen: boolean
  /** Load a new source */
  loadSource: (source: MediaSource) => Promise<void>
  /** Add subtitle tracks */
  addSubtitleTracks: (tracks: SubtitleTrack[]) => void
  /** Get available subtitle tracks */
  getSubtitleTracks: () => SubtitleTrack[]
  /** Set active subtitle track */
  setSubtitleTrack: (id: string | null) => void
  /** Get available audio tracks */
  getAudioTracks: () => AudioTrack[]
  /** Set active audio track */
  setAudioTrack: (id: string) => void
  /** Get available quality levels */
  getQualityLevels: () => QualityLevel[]
  /** Set quality level */
  setQualityLevel: (id: string) => void
  /** The current engine instance */
  engine: IPlayerEngine | null
  /** Whether the engine is ready */
  engineReady: boolean
}

export function usePlayerEngine(options: UsePlayerEngineOptions = {}): UsePlayerEngineReturn {
  const {
    autoPlay = false,
    startTime = 0,
    onTimeUpdate,
    onEnded,
    onError,
    onMetadataLoad,
    onCanPlay
  } = options

  // ── Stable callback refs ──────────────────────────────────────────────────
  // Store callbacks in refs so event listeners and loadSource never need them
  // in their dependency arrays — preventing the loadSource→render→loadSource loop.
  const cbRefs = useRef({ onTimeUpdate, onEnded, onError, onMetadataLoad, onCanPlay })
  useEffect(() => {
    cbRefs.current = { onTimeUpdate, onEnded, onError, onMetadataLoad, onCanPlay }
  }) // runs after every render — keeps refs current without causing extra renders
  // ─────────────────────────────────────────────────────────────────────────

  const videoRef = useRef<HTMLVideoElement>(null)
  const engineRef = useRef<IPlayerEngine | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pendingSourceRef = useRef<MediaSource | null>(null)
  const engineReadyRef = useRef(false)
  const engineTypeRef = useRef<string>('web')
  const loadedSrcRef = useRef<string>('')  // guard against re-loading same URL
  const initPromiseRef = useRef<Promise<void> | null>(null)
  
  const [state, setState] = useState<PlayerState>({
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
    playbackRate: 1,
    paused: true,
    buffering: true,
    ended: false,
    ready: false,
    buffered: null
  })
  
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [engineReady, setEngineReady] = useState(false)

  // Initialize engine
  useEffect(() => {
    let destroyed = false

    const initEngine = async () => {
      // Wait for video element to be available
      let attempts = 0
      while (!videoRef.current && attempts < 50 && !destroyed) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }

      if (destroyed || !videoRef.current) {
        if (!videoRef.current) {
          console.error('[usePlayerEngine] Video element not found after 5 seconds')
          setError(new Error('Video element not found'))
          setIsLoading(false)
        }
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        // Create appropriate engine for environment (no source yet — uses env detection only)
        const engine = await createEngine()
        
        if (destroyed) {
          engine.destroy()
          return
        }
        
        engineRef.current = engine
        engineTypeRef.current = isTauriEnvironment() ? 'tauri' : 'web'

        // Attach all event listeners to the active engine.
        // Reads callbacks via cbRefs.current so no closure capture needed.
        const attachListeners = (e: IPlayerEngine) => {
          e.addEventListener('timeupdate', (time, duration) => {
            setState(prev => ({ ...prev, currentTime: time, duration }))
            cbRefs.current.onTimeUpdate?.(time, duration)
          })
          e.addEventListener('ended', () => {
            setState(prev => ({ ...prev, ended: true, paused: true }))
            cbRefs.current.onEnded?.()
          })
          e.addEventListener('error', (err) => {
            setError(err)
            cbRefs.current.onError?.(err)
          })
          e.addEventListener('statechange', (newState) => {
            setState(prev => ({ ...prev, ...newState }))
          })
          e.addEventListener('loadedmetadata', (duration) => {
            setState(prev => ({ ...prev, duration }))
            cbRefs.current.onMetadataLoad?.(duration)
          })
          e.addEventListener('canplay', () => {
            setState(prev => ({ ...prev, ready: true, buffering: false }))
            cbRefs.current.onCanPlay?.()
          })
          e.addEventListener('waiting', () => {
            setState(prev => ({ ...prev, buffering: true }))
          })
          e.addEventListener('playing', () => {
            setState(prev => ({ ...prev, buffering: false }))
          })
        }

        attachListeners(engine)

        // Initialize engine with video element
        await engine.initialize(videoRef.current)

        if (destroyed) return

        engineReadyRef.current = true
        setEngineReady(true)
        setIsLoading(false)
        console.log('[usePlayerEngine] Engine initialized:', isTauriEnvironment() ? 'Tauri' : 'Web')

        // Load pending source if any
        if (pendingSourceRef.current) {
          console.log('[usePlayerEngine] Loading pending source:', pendingSourceRef.current.src.substring(0, 80))
          const source = pendingSourceRef.current
          pendingSourceRef.current = null

          // Check if a different engine is needed for this source
          const neededType = await detectEngineType(source)
          if (neededType !== engineTypeRef.current && videoRef.current) {
            console.log(`[usePlayerEngine] Switching engine: ${engineTypeRef.current} → ${neededType}`)
            const oldEngine = engineRef.current!
            const newEngine = await createEngineByType(neededType as any)
            attachListeners(newEngine)
            await newEngine.initialize(videoRef.current)
            oldEngine.destroy()
            engineRef.current = newEngine
            engineTypeRef.current = neededType
          }
          
          await engineRef.current!.loadSource(source)
          
          if (startTime > 0) {
            const seekOnReady = () => {
              engineRef.current?.seek(startTime)
              engineRef.current?.removeEventListener('canplay', seekOnReady)
            }
            engineRef.current!.addEventListener('canplay', seekOnReady)
          }
          
          if (autoPlay) {
            try {
              await engineRef.current!.play()
            } catch (playError) {
              console.log('[usePlayerEngine] Autoplay blocked, user interaction required')
            }
          }
        }
      } catch (err) {
        if (destroyed) return
        console.error('[usePlayerEngine] Failed to initialize engine:', err)
        setError(err instanceof Error ? err : new Error(String(err)))
        setIsLoading(false)
      }
    }

    initPromiseRef.current = initEngine()

    // Cleanup
    return () => {
      destroyed = true
      if (engineRef.current) {
        engineRef.current.destroy()
        engineRef.current = null
      }
      engineReadyRef.current = false
      setEngineReady(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Play
  const play = useCallback(async () => {
    if (!engineRef.current) return
    try {
      await engineRef.current.play()
    } catch (err) {
      console.error('[usePlayerEngine] Play error:', err)
      onError?.(err instanceof Error ? err : new Error(String(err)))
    }
  }, [onError])

  // Pause
  const pause = useCallback(() => {
    engineRef.current?.pause()
  }, [])

  // Seek
  const seek = useCallback(async (time: number) => {
    if (!engineRef.current) return
    await engineRef.current.seek(time)
  }, [])

  // Set volume
  const setVolume = useCallback((volume: number) => {
    engineRef.current?.setVolume(volume)
    setState(prev => ({ ...prev, volume }))
  }, [])

  // Set muted
  const setMuted = useCallback((muted: boolean) => {
    engineRef.current?.setMuted(muted)
    setState(prev => ({ ...prev, muted }))
  }, [])

  // Set playback rate
  const setPlaybackRate = useCallback((rate: number) => {
    engineRef.current?.setPlaybackRate(rate)
    setState(prev => ({ ...prev, playbackRate: rate }))
  }, [])

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (state.paused) {
      play()
    } else {
      pause()
    }
  }, [state.paused, play, pause])

  // Enter fullscreen
  const enterFullscreen = useCallback(async () => {
    const element = containerRef.current || videoRef.current?.parentElement
    if (!element) return

    try {
      await element.requestFullscreen()
    } catch (err) {
      console.error('[usePlayerEngine] Fullscreen error:', err)
    }
  }, [])

  // Exit fullscreen
  const exitFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) return

    try {
      await document.exitFullscreen()
    } catch (err) {
      console.error('[usePlayerEngine] Exit fullscreen error:', err)
    }
  }, [])

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreen()
    } else {
      await enterFullscreen()
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen])

  // Load source — switches engine type if needed (e.g., web→hybrid for MKV with rare codecs).
  // Uses cbRefs so callbacks are NOT in the dependency array → no infinite loop.
  const loadSource = useCallback(async (source: MediaSource) => {
    // Guard: skip if this exact URL is already loaded
    if (source.src && source.src === loadedSrcRef.current) {
      console.log('[usePlayerEngine] loadSource: same URL already loaded, skipping')
      return
    }

    console.log('[usePlayerEngine] loadSource called, engineReady:', engineReadyRef.current)
    
    // If engine isn't ready yet, queue the source for later
    if (!engineReadyRef.current || !engineRef.current) {
      console.log('[usePlayerEngine] Engine not ready, queueing source')
      pendingSourceRef.current = source
      return
    }

    setIsLoading(true)
    setError(null)
    loadedSrcRef.current = source.src

    try {
      // Detect if a different engine is needed for this source URL
      // (e.g., web → hybrid for MKV with rare audio codecs)
      const neededType = await detectEngineType(source)
      if (neededType !== engineTypeRef.current && videoRef.current) {
        console.log(`[usePlayerEngine] Switching engine: ${engineTypeRef.current} → ${neededType}`)
        const oldEngine = engineRef.current
        const newEngine = await createEngineByType(neededType as any)

        // Re-attach listeners via refs (stable closure)
        newEngine.addEventListener('timeupdate', (time, dur) => {
          setState(prev => ({ ...prev, currentTime: time, duration: dur }))
          cbRefs.current.onTimeUpdate?.(time, dur)
        })
        newEngine.addEventListener('ended', () => {
          setState(prev => ({ ...prev, ended: true, paused: true }))
          cbRefs.current.onEnded?.()
        })
        newEngine.addEventListener('error', (err) => { setError(err); cbRefs.current.onError?.(err) })
        newEngine.addEventListener('statechange', (s) => { setState(prev => ({ ...prev, ...s })) })
        newEngine.addEventListener('loadedmetadata', (d) => {
          setState(prev => ({ ...prev, duration: d }))
          cbRefs.current.onMetadataLoad?.(d)
        })
        newEngine.addEventListener('canplay', () => {
          setState(prev => ({ ...prev, ready: true, buffering: false }))
          cbRefs.current.onCanPlay?.()
        })
        newEngine.addEventListener('waiting', () => { setState(prev => ({ ...prev, buffering: true })) })
        newEngine.addEventListener('playing', () => { setState(prev => ({ ...prev, buffering: false })) })

        await newEngine.initialize(videoRef.current)
        oldEngine.destroy()
        engineRef.current = newEngine
        engineTypeRef.current = neededType
      }

      console.log('[usePlayerEngine] Loading source:', source.src.substring(0, 80))
      await engineRef.current.loadSource(source)

      // Seek to start time if provided
      if (startTime > 0) {
        const seekOnReady = () => {
          engineRef.current?.seek(startTime)
          engineRef.current?.removeEventListener('canplay', seekOnReady)
        }
        engineRef.current.addEventListener('canplay', seekOnReady)
      }

      // Auto-play if requested
      if (autoPlay) {
        try {
          await engineRef.current.play()
        } catch (playError) {
          console.log('[usePlayerEngine] Autoplay blocked, user interaction required')
        }
      }

      setIsLoading(false)
    } catch (err) {
      console.error('[usePlayerEngine] Load source error:', err)
      loadedSrcRef.current = ''  // reset so a retry is possible
      setError(err instanceof Error ? err : new Error(String(err)))
      setIsLoading(false)
    }
  }, [startTime, autoPlay])  // ← no callbacks in deps: they're accessed via cbRefs

  // Add subtitle tracks
  const addSubtitleTracks = useCallback((tracks: SubtitleTrack[]) => {
    engineRef.current?.addSubtitleTracks(tracks)
  }, [])

  // Get subtitle tracks
  const getSubtitleTracks = useCallback(() => {
    return engineRef.current?.getSubtitleTracks() || []
  }, [])

  // Set subtitle track
  const setSubtitleTrack = useCallback((id: string | null) => {
    engineRef.current?.setSubtitleTrack(id)
  }, [])

  // Get audio tracks
  const getAudioTracks = useCallback(() => {
    return engineRef.current?.getAudioTracks() || []
  }, [])

  // Set audio track
  const setAudioTrack = useCallback((id: string) => {
    engineRef.current?.setAudioTrack(id)
  }, [])

  // Get quality levels
  const getQualityLevels = useCallback(() => {
    return engineRef.current?.getQualityLevels() || []
  }, [])

  // Set quality level
  const setQualityLevel = useCallback((id: string) => {
    engineRef.current?.setQualityLevel(id)
  }, [])

  return {
    videoRef,
    state,
    isLoading,
    error,
    play,
    pause,
    seek,
    setVolume,
    setMuted,
    setPlaybackRate,
    togglePlayPause,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    isFullscreen,
    loadSource,
    addSubtitleTracks,
    getSubtitleTracks,
    setSubtitleTrack,
    getAudioTracks,
    setAudioTrack,
    getQualityLevels,
    setQualityLevel,
    engine: engineRef.current,
    engineReady
  }
}

export default usePlayerEngine
