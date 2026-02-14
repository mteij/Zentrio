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
  type MediaPlayerInstance,
  type MediaSrc
} from '@vidstack/react'
import {
  DefaultVideoLayout,
  defaultLayoutIcons
} from '@vidstack/react/player/layouts/default'
import { HybridEngine } from '../../services/hybrid-media/HybridEngine'
import { TranscoderService } from '../../services/hybrid-media/TranscoderService'
import type { StreamInfo, EngineState, MediaMetadata, StreamType, CodecInfo } from '../../services/hybrid-media/types'

// Tauri detection - hybrid media service is web-only
// In Tauri, native playback is used instead
const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI__

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
  // Hybrid media is not available in Tauri apps - uses native playback instead
  if (isTauri) {
    console.warn('[RareMediaProvider] Hybrid media is not available in Tauri apps - use native playback')
    return (
      <div className="hybrid-error tauri-warning">
        <p>Hybrid playback is disabled in Tauri. Use native VidstackPlayer instead.</p>
      </div>
    )
  }
  const playerRef = useRef<MediaPlayerInstance>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const engineRef = useRef<HybridEngine | null>(null)
  
  const [isEngineReady, setIsEngineReady] = useState(false)
  const [engineState, setEngineState] = useState<EngineState>('idle')
  const [streams, setStreams] = useState<StreamInfo[]>([])
  const [duration, setDuration] = useState(0)
  const [mediaSrc, setMediaSrc] = useState<MediaSrc | null>(null)
  const [transcodingProgress, setTranscodingProgress] = useState<number | null>(null)

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

        setIsEngineReady(false)
        setEngineState('initializing')
        setTranscodingProgress(null)

        // Probe media file first to get metadata
        const metadata = await TranscoderService.probe(src)
        if (!metadata) {
          throw new Error('Failed to probe media metadata')
        }

        const durationSec = metadata.format?.duration ?? 0

        const toCodecInfo = (s: { codec_id?: number; codec_name?: string }): CodecInfo => {
          const codecName = (s.codec_name ?? 'unknown').toLowerCase()
          return {
            codecId: s.codec_id ?? 0,
            codecName,
            codecString: codecName
          }
        }

        const detectedStreams: StreamInfo[] = (metadata.streams ?? []).flatMap((s) => {
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

        setStreams(detectedStreams)
        setDuration(durationSec)

        // Check if we actually need hybrid playback
        const audioStream = detectedStreams.find(s => s.type === 'audio')
        const audioCodec = audioStream?.codec.codecName

        // Only enable hybrid playback for codecs commonly unsupported in browsers
        const needsHybrid = !!audioCodec && (
          audioCodec === 'flac' ||
          audioCodec === 'dts' ||
          audioCodec === 'ac3' ||
          audioCodec === 'eac3' ||
          audioCodec === 'truehd'
        )

        if (!needsHybrid) {
          // Audio is natively supported, use normal playback
          console.log('[RareMediaProvider] Using native playback - audio codec:', audioCodec)
          setMediaSrc({ src, type: 'video/mp4' })
          setIsEngineReady(true)
          onMetadataLoad?.(durationSec, detectedStreams)
          return
        }

        // Create engine with new API
        console.log('[RareMediaProvider] Using hybrid playback - audio codec:', audioCodec)
        const engine = new HybridEngine(src, metadata, {
          onError: (error) => {
            if (cancelled) return
            onError?.(error)
          }
        })
        engineRef.current = engine

        // Event handlers
        engine.addEventListener('statechange', (e: Event) => {
          if (cancelled) return
          const detail = (e as CustomEvent<{ state: EngineState }>).detail
          setEngineState(detail.state)
        })

        engine.addEventListener('timeupdate', (e: Event) => {
          if (cancelled) return
          const detail = (e as CustomEvent<{ currentTime: number; duration?: number }>).detail
          onTimeUpdate?.(detail.currentTime, detail.duration ?? engine.getDuration())
        })

        engine.addEventListener('progress', (e: Event) => {
          if (cancelled) return
          const detail = (e as CustomEvent<{ progress: number }>).detail
          if (typeof detail?.progress === 'number') {
            setTranscodingProgress(Math.round(detail.progress * 100))
          }
        })

        engine.addEventListener('ended', () => {
          if (cancelled) return
          onEnded?.()
        })

        engine.addEventListener('error', (e: Event) => {
          if (cancelled) return
          const detail = (e as CustomEvent<{ error: Error }>).detail
          onError?.(detail.error)
        })

        setDuration(engine.getDuration())
        
        // We'll initialize when we have the video element
        setEngineState('ready')
        onMetadataLoad?.(engine.getDuration(), detectedStreams)
        
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
        
        // Initialize engine with video element
        await engine.initialize(video)
        
        setIsEngineReady(true)

        // Seek to start time if needed
        if (startTime > 0) {
          await engine.seek(startTime)
        }

        // Auto-play if requested
        if (autoPlay) {
          await engine.play()
        }
      } catch (error) {
        console.error('[RareMediaProvider] Initialize error:', error)
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
    }
  }, [])

  // Handle play from Vidstack
  const handlePlay = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.play()
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
