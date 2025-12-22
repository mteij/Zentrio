/**
 * RareMediaProvider - Vidstack-compatible provider for rare audio codecs
 * 
 * Integrates HybridEngine with Vidstack's MediaPlayer component.
 * Handles video files with FLAC, Vorbis, AC3, DTS audio that browsers
 * cannot decode natively.
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import {
  MediaPlayer,
  MediaProvider,
  Poster,
  Track,
  type MediaPlayerInstance
} from '@vidstack/react'
import {
  DefaultVideoLayout,
  defaultLayoutIcons
} from '@vidstack/react/player/layouts/default'
import { HybridEngine } from '../../services/hybrid-media/HybridEngine'
import type { StreamInfo, EngineState } from '../../services/hybrid-media/types'

export interface SubtitleTrack {
  src: string
  label: string
  language: string
  default?: boolean
}

export interface RareMediaProviderProps {
  /** Media URL (MKV, AVI, etc. with rare audio codecs) */
  src: string
  /** Poster image URL */
  poster?: string
  /** Content title */
  title?: string
  /** Subtitle tracks */
  subtitles?: SubtitleTrack[]
  /** Callback when time updates */
  onTimeUpdate?: (currentTime: number, duration: number) => void
  /** Callback when playback ends */
  onEnded?: () => void
  /** Callback on error */
  onError?: (error: Error) => void
  /** Callback when metadata loads */
  onMetadataLoad?: (duration: number, streams: StreamInfo[]) => void
  /** Resume from this position */
  startTime?: number
  /** Auto-play on load */
  autoPlay?: boolean
  /** Show additional controls slot content */
  slots?: {
    googleCastButton?: React.ReactNode
  }
}

export function RareMediaProvider({
  src,
  poster,
  title,
  subtitles = [],
  onTimeUpdate,
  onEnded,
  onError,
  onMetadataLoad,
  startTime = 0,
  autoPlay = true,
  slots = {}
}: RareMediaProviderProps) {
  const playerRef = useRef<MediaPlayerInstance>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const engineRef = useRef<HybridEngine | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  
  const [isEngineReady, setIsEngineReady] = useState(false)
  const [engineState, setEngineState] = useState<EngineState>('idle')
  const [streams, setStreams] = useState<StreamInfo[]>([])
  const [duration, setDuration] = useState(0)
  const [mediaSrc, setMediaSrc] = useState<{ src: string; type: string } | null>(null)

  // Initialize engine when source changes
  useEffect(() => {
    if (!src) return
    
    let cancelled = false
    
    const initEngine = async () => {
      try {
        // Cleanup previous
        if (engineRef.current) {
          await engineRef.current.destroy()
        }
        if (audioContextRef.current) {
          await audioContextRef.current.close()
          audioContextRef.current = null
        }

        setIsEngineReady(false)
        setEngineState('initializing')

        // Create engine
        const engine = new HybridEngine()
        engineRef.current = engine

        // Event handlers
        engine.addEventListener('statechange', (e: any) => {
          if (cancelled) return
          setEngineState(e.detail.state)
        })

        engine.addEventListener('timeupdate', (e: any) => {
          if (cancelled) return
          onTimeUpdate?.(e.detail.currentTime, e.detail.duration)
        })

        engine.addEventListener('ended', () => {
          if (cancelled) return
          onEnded?.()
        })

        engine.addEventListener('error', (e: any) => {
          if (cancelled) return
          onError?.(e.detail.error)
        })

        // Initialize
        const detectedStreams = await engine.initialize(src)
        
        if (cancelled) {
          engine.destroy()
          return
        }

        setStreams(detectedStreams)
        setDuration(engine.totalDuration)

        // Check if we actually need hybrid playback
        if (!engine.requiresHybridPlayback) {
          // Audio is natively supported, use normal playback
          console.log('[RareMediaProvider] Using native playback')
          setMediaSrc({ src, type: 'video/mp4' })
          await engine.destroy()
          engineRef.current = null
          setIsEngineReady(true)
          onMetadataLoad?.(engine.totalDuration, detectedStreams)
          return
        }

        // Need hybrid playback
        console.log('[RareMediaProvider] Using hybrid playback')
        
        // We'll attach when we have the video element
        setEngineState('ready')
        onMetadataLoad?.(engine.totalDuration, detectedStreams)
        
      } catch (error) {
        if (cancelled) return
        console.error('[RareMediaProvider] Init error:', error)
        setEngineState('error')
        onError?.(error instanceof Error ? error : new Error(String(error)))
      }
    }

    initEngine()

    return () => {
      cancelled = true
    }
  }, [src])

  // Attach engine to video element when available
  useEffect(() => {
    if (!engineRef.current || engineState !== 'ready' || !videoRef.current) return
    
    const attachEngine = async () => {
      try {
        const engine = engineRef.current!
        const video = videoRef.current!
        
        // Attach video
        await engine.attachVideo(video)
        
        // Create and attach audio
        audioContextRef.current = new AudioContext()
        await engine.attachAudio(audioContextRef.current)
        
        setIsEngineReady(true)

        // Seek to start time if needed
        if (startTime > 0) {
          await engine.seek(startTime)
        }

        // Auto-play if requested
        if (autoPlay) {
          if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume()
          }
          await engine.start()
        }
      } catch (error) {
        console.error('[RareMediaProvider] Attach error:', error)
        onError?.(error instanceof Error ? error : new Error(String(error)))
      }
    }

    attachEngine()
  }, [engineState, startTime, autoPlay])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy()
        engineRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [])

  // Handle play from Vidstack
  const handlePlay = useCallback(async () => {
    if (engineRef.current) {
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume()
      }
      await engineRef.current.start()
    }
  }, [])

  // Handle pause from Vidstack
  const handlePause = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.pause()
    }
  }, [])

  // Handle seeking from Vidstack
  const handleSeeking = useCallback(async (event: any) => {
    if (engineRef.current && event?.detail?.currentTime !== undefined) {
      await engineRef.current.seek(event.detail.currentTime)
    }
  }, [])

  // Handle playback end
  const handleEnded = useCallback(() => {
    onEnded?.()
  }, [onEnded])

  // Handle player errors
  const handleError = useCallback((event: any) => {
    const error = event?.detail instanceof Error 
      ? event.detail 
      : new Error(event?.detail?.message || 'Playback error')
    onError?.(error)
  }, [onError])

  // If using native playback (audio was natively supported)
  if (mediaSrc) {
    return (
      <MediaPlayer
        ref={playerRef}
        src={mediaSrc}
        title={title}
        autoPlay={autoPlay}
        playsInline
        onEnded={handleEnded}
        onError={handleError}
        className="rare-media-player"
      >
        <MediaProvider>
          {poster && <Poster className="vds-poster" src={poster} alt={title || ''} />}
          {subtitles.map((track, index) => (
            <Track
              key={track.src || `sub-${index}`}
              src={track.src}
              kind="subtitles"
              label={track.label}
              language={track.language}
              default={track.default}
            />
          ))}
        </MediaProvider>
        <DefaultVideoLayout icons={defaultLayoutIcons} slots={slots} />
      </MediaPlayer>
    )
  }

  // Hybrid playback mode
  return (
    <div className="rare-media-player hybrid-mode">
      {/* Hidden video element for MSE video output */}
      <video
        ref={videoRef}
        muted
        playsInline
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          zIndex: 0
        }}
      />
      
      {/* Custom overlay for controls (simplified) */}
      <div className="hybrid-controls-overlay">
        {/* Loading state */}
        {engineState === 'initializing' && (
          <div className="hybrid-loading">
            <span>Loading...</span>
          </div>
        )}
        
        {/* Error state */}
        {engineState === 'error' && (
          <div className="hybrid-error">
            <span>Playback Error</span>
          </div>
        )}
        
        {/* Poster */}
        {poster && !isEngineReady && (
          <img 
            src={poster} 
            alt={title || ''} 
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 1
            }}
          />
        )}
      </div>
      
      {/* Custom play/pause overlay - basic controls */}
      {isEngineReady && (
        <div 
          className="hybrid-touch-controls"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={async () => {
            if (engineState === 'playing') {
              await handlePause()
            } else {
              await handlePlay()
            }
          }}
        >
          {/* Semi-transparent center play button */}
          {engineState !== 'playing' && (
            <div className="hybrid-play-button">
              ▶
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default RareMediaProvider
