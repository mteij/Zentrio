/**
 * VidstackPlayer - Modern video player using Vidstack v1.x
 * 
 * Features:
 * - HLS streaming with quality selection
 * - Built-in subtitles/captions UI
 * - Custom Cast button via slots
 * - CSS variable theming
 * - Keyboard shortcuts
 * - Mobile-friendly
 * - **Automatic hybrid playback for rare audio codecs**
 */

import { useRef, useEffect, useCallback, useMemo, useState } from 'react'
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

// Import Vidstack styles
import '@vidstack/react/player/styles/base.css'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'

// Custom components for slots
import { CastButton } from './CastButton'
import { HybridEngine } from '../../services/hybrid-media/HybridEngine'
import { mightNeedHybridPlayback } from '../../services/hybrid-media'

export interface SubtitleTrack {
    src: string
    label: string
    language: string
    default?: boolean
}

export interface VidstackPlayerProps {
    /** Video source URL (MP4, HLS, etc.) */
    src: string
    /** Poster image URL */
    poster?: string
    /** Content title */
    title?: string
    /** Subtitle tracks */
    subtitles?: SubtitleTrack[]
    /** Callback when time updates (for progress saving) */
    onTimeUpdate?: (currentTime: number, duration: number) => void
    /** Callback when playback ends */
    onEnded?: () => void
    /** Callback when error occurs */
    onError?: (error: Error) => void
    /** Callback when metadata loads */
    onMetadataLoad?: (duration: number) => void
    /** Resume from this position (seconds) */
    startTime?: number
    /** Auto-play on load */
    autoPlay?: boolean
    /** Stream URL for external player */
    streamUrl?: string
    /** Show Cast button */
    showCast?: boolean
}

type PlaybackMode = 'native' | 'hybrid' | 'probing'

export function VidstackPlayer({
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
    showCast = true
}: VidstackPlayerProps) {
    const playerRef = useRef<MediaPlayerInstance>(null)
    const hybridVideoRef = useRef<HTMLVideoElement>(null)
    const engineRef = useRef<HybridEngine | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    
    // Playback mode: native (Vidstack), hybrid (custom engine), or probing
    const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(() => {
        // If URL looks like it might need hybrid playback, start probing
        if (mightNeedHybridPlayback(src)) {
            return 'probing'
        }
        return 'native'
    })
    
    const [hybridReady, setHybridReady] = useState(false)
    const [hybridDuration, setHybridDuration] = useState(0)
    const [hybridPlaying, setHybridPlaying] = useState(false)
    
    // Probe the file to check if we need hybrid playback
    useEffect(() => {
        if (playbackMode !== 'probing' || !src) return
        
        let cancelled = false

        const probeFile = async () => {
            try {
                console.log('[VidstackPlayer] Probing file for audio codec compatibility...')
                
                const engine = new HybridEngine()
                const streams = await engine.initialize(src)
                
                if (cancelled) {
                    engine.destroy()
                    return
                }

                if (engine.requiresHybridPlayback) {
                    console.log('[VidstackPlayer] File requires hybrid playback (unsupported audio codec)')
                    engineRef.current = engine
                    setHybridDuration(engine.totalDuration)
                    setPlaybackMode('hybrid')
                    onMetadataLoad?.(engine.totalDuration)
                } else {
                    console.log('[VidstackPlayer] File can use native playback')
                    engine.destroy()
                    setPlaybackMode('native')
                }
            } catch (error) {
                console.warn('[VidstackPlayer] Probe failed, falling back to native:', error)
                if (!cancelled) {
                    setPlaybackMode('native')
                }
            }
        }

        probeFile()

        return () => {
            cancelled = true
        }
    }, [src, playbackMode])

    // Initialize hybrid engine when in hybrid mode
    useEffect(() => {
        if (playbackMode !== 'hybrid' || !engineRef.current || !hybridVideoRef.current) return

        let cancelled = false

        const initHybrid = async () => {
            const engine = engineRef.current!
            const video = hybridVideoRef.current!

            try {
                // Attach video
                await engine.attachVideo(video)

                // Try to attach audio - this may fail if SharedArrayBuffer is not available
                // or if the audio codec is not supported (e.g., E-AC3/DTS)
                try {
                    audioContextRef.current = new AudioContext()
                    await engine.attachAudio(audioContextRef.current)
                } catch (audioError) {
                    // SharedArrayBuffer, AudioWorklet, or codec not available
                    // Fall back to native playback (video will play, audio may not work)
                    console.warn('[VidstackPlayer] Audio setup failed, falling back to native playback:', audioError)
                    
                    // Close AudioContext first (before engine.destroy which might try to close it)
                    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                        try {
                            await audioContextRef.current.close()
                        } catch {
                            // Ignore close errors
                        }
                    }
                    audioContextRef.current = null
                    
                    // Cleanup engine (it should handle gracefully that audio wasn't fully set up)
                    await engine.destroy()
                    engineRef.current = null
                    
                    // Switch to native playback mode
                    setPlaybackMode('native')
                    return
                }

                if (cancelled) return

                // Set up event handlers
                engine.addEventListener('timeupdate', (e: any) => {
                    if (!cancelled) {
                        onTimeUpdate?.(e.detail.currentTime, e.detail.duration)
                    }
                })

                engine.addEventListener('ended', () => {
                    if (!cancelled) {
                        setHybridPlaying(false)
                        onEnded?.()
                    }
                })

                engine.addEventListener('statechange', (e: any) => {
                    if (!cancelled) {
                        setHybridPlaying(e.detail.state === 'playing')
                    }
                })

                // Seek to start time
                if (startTime > 0) {
                    await engine.seek(startTime)
                }

                setHybridReady(true)

                // Auto-play
                if (autoPlay) {
                    if (audioContextRef.current.state === 'suspended') {
                        await audioContextRef.current.resume()
                    }
                    await engine.start()
                }

                console.log('[VidstackPlayer] Hybrid playback initialized')
            } catch (error) {
                console.error('[VidstackPlayer] Hybrid init failed, falling back to native:', error)
                
                // Close AudioContext first (check state to avoid double-close)
                if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                    try {
                        await audioContextRef.current.close()
                    } catch {
                        // Ignore close errors
                    }
                }
                audioContextRef.current = null
                
                // Cleanup engine
                if (engineRef.current) {
                    await engineRef.current.destroy()
                    engineRef.current = null
                }
                
                // Switch to native playback
                setPlaybackMode('native')
                onError?.(error instanceof Error ? error : new Error(String(error)))
            }
        }

        initHybrid()

        return () => {
            cancelled = true
        }
    }, [playbackMode, autoPlay, startTime])

    // Cleanup on unmount or src change
    useEffect(() => {
        return () => {
            // Close AudioContext first (check state to avoid double-close)
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close().catch(() => {})
            }
            audioContextRef.current = null
            
            // Then destroy engine
            if (engineRef.current) {
                engineRef.current.destroy()
                engineRef.current = null
            }
        }
    }, [src])
    
    // Seek to start time when player is ready (native mode)
    useEffect(() => {
        if (playbackMode !== 'native') return
        
        const player = playerRef.current
        if (player && startTime > 0) {
            const handleCanPlay = () => {
                player.currentTime = startTime
            }
            player.addEventListener('can-play', handleCanPlay, { once: true })
            return () => player.removeEventListener('can-play', handleCanPlay)
        }
    }, [startTime, playbackMode])
    
    // Handle time update for progress saving (native mode)
    const handleTimeUpdate = useCallback(() => {
        const player = playerRef.current
        if (player && onTimeUpdate) {
            onTimeUpdate(player.currentTime, player.state.duration)
        }
    }, [onTimeUpdate])
    
    // Handle playback end (native mode)
    const handleEnded = useCallback(() => {
        onEnded?.()
    }, [onEnded])
    
    // Handle metadata loaded (native mode)
    const handleLoadedMetadata = useCallback(() => {
        const player = playerRef.current
        if (player && onMetadataLoad) {
            onMetadataLoad(player.state.duration)
        }
    }, [onMetadataLoad])
    
    // Determine source type for Vidstack
    const mediaSrc = useMemo((): MediaSrc => {
        if (!src) {
            return { src: '', type: 'video/mp4' }
        }
        
        const lowerUrl = src.toLowerCase()
        
        // HLS
        if (lowerUrl.includes('.m3u8')) {
            return { src, type: 'application/x-mpegurl' }
        }
        // DASH
        if (lowerUrl.includes('.mpd')) {
            return { src, type: 'application/dash+xml' }
        }
        // WebM
        if (lowerUrl.includes('.webm')) {
            return { src, type: 'video/webm' }
        }
        // Default to MP4 (works for most formats including MKV in supported browsers)
        return { src, type: 'video/mp4' }
    }, [src])
    
    // Handle player errors (native mode) - detect audio issues
    const handlePlayerError = useCallback((event: any) => {
        const detail = event?.detail
        console.error('[VidstackPlayer] Error:', detail?.message || event)
        
        // Check if this might be an audio codec issue
        // If we haven't tried hybrid mode yet and the URL might need it
        if (playbackMode === 'native' && mightNeedHybridPlayback(src)) {
            console.log('[VidstackPlayer] Native playback failed, trying hybrid mode...')
            setPlaybackMode('probing')
            return
        }
        
        onError?.(detail instanceof Error ? detail : new Error(detail?.message || 'Playback error'))
    }, [onError, playbackMode, src])

    // Hybrid mode controls
    const handleHybridPlay = useCallback(async () => {
        if (engineRef.current) {
            if (audioContextRef.current?.state === 'suspended') {
                await audioContextRef.current.resume()
            }
            await engineRef.current.start()
        }
    }, [])

    const handleHybridPause = useCallback(async () => {
        if (engineRef.current) {
            await engineRef.current.pause()
        }
    }, [])

    const handleHybridSeek = useCallback(async (time: number) => {
        if (engineRef.current) {
            await engineRef.current.seek(time)
        }
    }, [])

    // Loading state while probing
    if (playbackMode === 'probing') {
        return (
            <div className="vidstack-player" style={{ 
                position: 'relative',
                width: '100%',
                height: '100%',
                backgroundColor: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {poster && (
                    <img 
                        src={poster} 
                        alt={title || ''} 
                        style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            opacity: 0.5
                        }}
                    />
                )}
                <div style={{ 
                    color: 'white', 
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    <div className="vds-buffering-indicator" style={{
                        width: 48,
                        height: 48,
                        border: '3px solid rgba(255,255,255,0.3)',
                        borderTopColor: 'white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <span>Analyzing media...</span>
                </div>
                <style>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        )
    }

    // Hybrid playback mode
    if (playbackMode === 'hybrid') {
        return (
            <div className="vidstack-player hybrid-mode" style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                backgroundColor: '#000'
            }}>
                {/* Video element for MSE */}
                <video
                    ref={hybridVideoRef}
                    muted
                    playsInline
                    style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                    }}
                />

                {/* Poster while loading */}
                {poster && !hybridReady && (
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

                {/* Loading indicator */}
                {!hybridReady && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2
                    }}>
                        <div style={{
                            width: 48,
                            height: 48,
                            border: '3px solid rgba(255,255,255,0.3)',
                            borderTopColor: 'white',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }} />
                    </div>
                )}

                {/* Simple playback controls */}
                {hybridReady && (
                    <div 
                        style={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 3,
                            cursor: 'pointer'
                        }}
                        onClick={() => {
                            if (hybridPlaying) {
                                handleHybridPause()
                            } else {
                                handleHybridPlay()
                            }
                        }}
                    >
                        {!hybridPlaying && (
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: 80,
                                height: 80,
                                borderRadius: '50%',
                                backgroundColor: 'rgba(0,0,0,0.7)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 32,
                                color: 'white'
                            }}>
                                ▶
                            </div>
                        )}
                    </div>
                )}

                {/* Hybrid mode indicator */}
                <div style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    padding: '4px 8px',
                    backgroundColor: 'rgba(255, 165, 0, 0.8)',
                    borderRadius: 4,
                    fontSize: 12,
                    color: 'black',
                    fontWeight: 'bold',
                    zIndex: 5
                }}>
                    HYBRID AUDIO
                </div>

                <style>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        )
    }

    // Native Vidstack playback (default)
    return (
        <MediaPlayer
            ref={playerRef}
            src={mediaSrc}
            title={title}
            autoPlay={autoPlay}
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onError={handlePlayerError}
            onLoadedMetadata={handleLoadedMetadata}
            className="vidstack-player"
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
            
            <DefaultVideoLayout
                icons={defaultLayoutIcons}
                slots={{
                    googleCastButton: showCast ? <CastButton /> : null
                }}
            />
        </MediaPlayer>
    )
}

export default VidstackPlayer
