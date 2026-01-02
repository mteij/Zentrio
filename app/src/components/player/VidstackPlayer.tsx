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
import {
    Menu,
    Tooltip,
    useMediaRemote,
    useMediaStore,
    useMediaState,
    useCaptionOptions,
    type TextTrack
} from '@vidstack/react'
import { ChevronRight, Captions, Check, Music, Volume2 } from 'lucide-react'

// Import Vidstack styles
import '@vidstack/react/player/styles/base.css'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'

// Custom components for slots
import { CastButton } from './CastButton'

// Lazy load hybrid media engine to reduce initial bundle size
// This is only loaded when hybrid playback is actually needed
const HybridEnginePromise = import('../../services/hybrid-media/HybridEngine').then(m => m.HybridEngine)
const mightNeedHybridPlaybackPromise = import('../../services/hybrid-media').then(m => m.mightNeedHybridPlayback)

// Global cache to prevent re-probing on remounts
// Maps URL -> 'native' | 'hybrid' | 'failed'
const probeCache = new Map<string, { mode: 'native' | 'hybrid', duration?: number }>()

// Track in-flight probes to deduplicate requests
const pendingProbes = new Map<string, Promise<{ mode: 'native' | 'hybrid', duration?: number }>>()

export interface SubtitleTrack {
    src: string
    label: string
    language: string
    type?: string
    addonName?: string
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

function AudioTracksMenu() {
    const remote = useMediaRemote()
    const audioTracks = useMediaState('audioTracks')
    const currentAudioTrack = useMediaState('audioTrack')

    // Debug: log audio tracks
    console.log('[AudioTracksMenu] Audio tracks:', audioTracks)
    console.log('[AudioTracksMenu] Current audio track:', currentAudioTrack)

    // Get display name for language
    const getLangName = (code: string) => {
        try {
            return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code
        } catch {
            return code
        }
    }

    // Always render the button, show info about available tracks
    const hasAudioTracks = audioTracks && audioTracks.length > 0
    const hasMultipleAudioTracks = audioTracks && audioTracks.length > 1

    return (
        <Menu.Root>
            <Menu.Button className="vds-menu-button vds-button" aria-label="Audio tracks">
                <Music className="vds-icon" />
            </Menu.Button>

            <Menu.Content className="vds-menu-items" placement="top" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <div className="vds-menu-title">Audio</div>
                
                {!hasAudioTracks ? (
                    <div style={{ padding: '12px', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                        No audio tracks detected
                    </div>
                ) : (
                    <Menu.RadioGroup value={currentAudioTrack?.id?.toString() || ''}>
                        {audioTracks.map((track) => (
                            <Menu.Radio
                                key={track.id}
                                value={track.id.toString()}
                                className="vds-menu-item"
                                onSelect={() => {
                                    // Audio track IDs are typically numbers, but we need to ensure we're passing the right type
                                    // The track.id is typically a number for audio tracks
                                    (remote as any).changeAudioTrack(typeof track.id === 'number' ? track.id : parseInt(track.id.toString()))
                                }}
                            >
                            <span className="vds-menu-item-label">
                                {track.label || getLangName(track.language || 'und')}
                                {track.language && track.label && ` (${getLangName(track.language)})`}
                            </span>
                            <Check className="vds-radio-icon" size={14} />
                        </Menu.Radio>
                    ))}
                    </Menu.RadioGroup>
                )}
                
                {/* Info about audio tracks */}
                {hasAudioTracks && !hasMultipleAudioTracks && (
                    <div style={{ padding: '12px', color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '8px' }}>
                        Note: This video has a single audio track. Multiple audio tracks appear only if the video file contains multiple audio streams.
                    </div>
                )}
            </Menu.Content>
        </Menu.Root>
    )
}

function SubtitlesMenu({ tracks }: { tracks: SubtitleTrack[] }) {
    const remote = useMediaRemote()
    const captionOptions = useCaptionOptions()
    const textTrack = useMediaState('textTrack')
    const textTracks = useMediaState('textTracks')

    // Debug: log caption options and tracks
    console.log('[SubtitlesMenu] Caption options:', captionOptions)
    console.log('[SubtitlesMenu] Text tracks from state:', textTracks)
    console.log('[SubtitlesMenu] Prop tracks:', tracks)

    // Get display name for language (using Intl.DisplayNames if available)
    const getLangName = (code: string) => {
        try {
            return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code
        } catch {
            return code
        }
    }

    // Check if we have caption options from media OR tracks from props
    // useCaptionOptions() returns tracks detected in the media
    // tracks prop contains subtitle URLs we want to add
    const hasCaptionOptions = captionOptions && captionOptions.length > 0
    const hasPropTracks = tracks && tracks.length > 0
    const hasTextTracks = textTracks && textTracks.length > 0
    const hasAnySubtitles = hasCaptionOptions || hasPropTracks || hasTextTracks

    // Current selected track value
    const currentValue = textTrack ? textTrack.language || textTrack.label || '' : 'off'

    return (
        <Menu.Root>
            <Menu.Button className="vds-menu-button vds-button" aria-label="Subtitles" style={{ display: 'flex' }}>
                <Captions className="vds-icon" size={20} />
            </Menu.Button>

            <Menu.Content className="vds-menu-items" placement="top" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <div className="vds-menu-title">Subtitles</div>
                
                {!hasAnySubtitles ? (
                    <div style={{ padding: '12px', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                        <div style={{ marginBottom: '8px' }}>No subtitles available</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                            Install a subtitle addon (e.g., OpenSubtitles) to load external subtitles
                        </div>
                    </div>
                ) : (
                    <Menu.RadioGroup value={currentValue}>
                        {/* Off Option */}
                        <Menu.Radio
                            value="off"
                            className="vds-menu-item"
                            onSelect={() => {
                                // Disable subtitles by changing text track
                                (remote as any).changeTextTrack(-1)
                            }}
                        >
                            <span className="vds-menu-item-label">Off</span>
                            {!textTrack && <Check className="vds-radio-icon" size={14} />}
                        </Menu.Radio>

                        <div className="vds-menu-divider" />

                        {/* Subtitle Tracks from caption options (detected in media) */}
                        {hasCaptionOptions && captionOptions.map((option) => (
                            <Menu.Radio
                                key={option.value}
                                value={option.value}
                                className="vds-menu-item"
                                onSelect={option.select}
                            >
                                <span className="vds-menu-item-label">
                                    {option.label}
                                </span>
                                <Check className="vds-radio-icon" size={14} />
                            </Menu.Radio>
                        ))}

                        {/* External subtitle tracks from props */}
                        {/* These should appear in textTracks after Track components render */}
                        {hasTextTracks && !hasCaptionOptions && textTracks.map((track: any, index: number) => {
                            // Skip the "off" option if it exists
                            if (track.kind === 'subtitles' && track.language) {
                                return (
                                    <Menu.Radio
                                        key={`external-${index}`}
                                        value={track.language}
                                        className="vds-menu-item"
                                        onSelect={() => {
                                            (remote as any).changeTextTrack(index)
                                        }}
                                    >
                                        <span className="vds-menu-item-label">
                                            {track.label || getLangName(track.language)}
                                        </span>
                                        <Check className="vds-radio-icon" size={14} />
                                    </Menu.Radio>
                                )
                            }
                            return null
                        })}

                        {/* Show message if we have prop tracks but no caption options or text tracks */}
                        {hasPropTracks && !hasCaptionOptions && !hasTextTracks && (
                            <div style={{ padding: '12px', color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>
                                {tracks.length} subtitle(s) loaded but not yet detected
                            </div>
                        )}
                    </Menu.RadioGroup>
                )}
            </Menu.Content>
        </Menu.Root>
    )
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
    // Debug: log subtitles when they change
    useEffect(() => {
        console.log('[VidstackPlayer] Subtitles prop updated:', subtitles)
    }, [subtitles])
    const playerRef = useRef<MediaPlayerInstance>(null)
    const hybridVideoRef = useRef<HTMLVideoElement>(null)
    const engineRef = useRef<any>(null)
    
    // Prevent React Strict Mode from re-probing or re-initializing
    const probeCompletedRef = useRef(false)
    const hybridInitializedRef = useRef(false)
    
    // Playback mode: native (Vidstack), hybrid (custom engine), or probing
    const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(() => {
        // Force native playback in Tauri
        if (window.__TAURI__) {
            console.log('[VidstackPlayer] Tauri environment detected - forcing native playback')
            return 'native'
        }

        // Check cache first
        const cached = probeCache.get(src)
        if (cached) {
            console.log(`[VidstackPlayer] Using cached probe result for ${src.slice(0, 50)}...: ${cached.mode}`)
            if (cached.mode === 'hybrid') {
                 return 'probing' 
            }
            return cached.mode as PlaybackMode
        }

        // If URL looks like it might need hybrid playback, start probing
        // We'll check this after loading helper function
        return 'native'
    })
    
    const [hybridReady, setHybridReady] = useState(false)
    const [hybridDuration, setHybridDuration] = useState(0)
    const [hybridCurrentTime, setHybridCurrentTime] = useState(0)
    const [hybridPlaying, setHybridPlaying] = useState(false)
    const [showControls, setShowControls] = useState(true)
    
    // Probe file to check if we need hybrid playback
    useEffect(() => {
        // Skip probing in Tauri
        if (window.__TAURI__) {
            console.log('[VidstackPlayer] Skipping probe - running in Tauri environment')
            return
        }
        
        // Check cache (again, in case it populated while mounting)
        const cached = probeCache.get(src)
        if (cached) {
             console.log('[VidstackPlayer] Using cached probe result:', cached.mode, 'duration:', cached.duration)
             if (cached.mode === 'hybrid') {
                 setHybridDuration(cached.duration || 0)
                 setPlaybackMode('hybrid')
                 if (cached.duration) onMetadataLoad?.(cached.duration)
             } else {
                 setPlaybackMode('native')
             }
             probeCompletedRef.current = true
             return
        }

        // Skip if we've already completed probing for this src locally
        if (probeCompletedRef.current && engineRef.current) {
            console.log('[VidstackPlayer] Skipping probe - already completed locally')
            setPlaybackMode('hybrid')
            return
        }
        
        let cancelled = false

        const probeFile = async () => {
            try {
                console.log('[VidstackPlayer] Starting probe for:', src.substring(0, 80))
                
                // Lazy load hybrid media dependencies
                const [HybridEngine, mightNeedHybridPlayback, TranscoderServiceModule] = await Promise.all([
                    HybridEnginePromise,
                    mightNeedHybridPlaybackPromise,
                    import('../../services/hybrid-media/TranscoderService').catch((err) => {
                        console.error('[VidstackPlayer] Failed to load TranscoderService:', err)
                        return null
                    })
                ])
                
                console.log('[VidstackPlayer] Dependencies loaded')
                
                // Check if we even need to probe
                if (!mightNeedHybridPlayback(src)) {
                    console.log('[VidstackPlayer] mightNeedHybridPlayback returned false')
                    probeCache.set(src, { mode: 'native' })
                    setPlaybackMode('native')
                    probeCompletedRef.current = true
                    return
                }
                console.log('[VidstackPlayer] mightNeedHybridPlayback returned true, continuing probe')
                
                // Probe file to get metadata
                let metadata = null
                if (TranscoderServiceModule && TranscoderServiceModule.TranscoderService) {
                    const TranscoderService = TranscoderServiceModule.TranscoderService
                    if (typeof TranscoderService.probe === 'function') {
                        console.log('[VidstackPlayer] Calling TranscoderService.probe()...')
                        metadata = await TranscoderService.probe(src)
                        console.log('[VidstackPlayer] Probe returned metadata:', metadata ? 'found' : 'null')
                    }
                }
                
                if (cancelled) {
                    console.log('[VidstackPlayer] Probe cancelled')
                    return
                }

                if (!metadata) {
                    console.log('[VidstackPlayer] No metadata returned from probe, using native playback')
                    probeCache.set(src, { mode: 'native' })
                    setPlaybackMode('native')
                    probeCompletedRef.current = true
                    return
                }
               
                console.log('[VidstackPlayer] Creating HybridEngine with metadata...')
                // Create engine with metadata
                const engine = new HybridEngine(src, metadata)

                console.log('[VidstackPlayer] engine.requiresHybridPlayback:', engine.requiresHybridPlayback)

                if (engine.requiresHybridPlayback) {
                    console.log('[VidstackPlayer] File requires hybrid playback (unsupported audio codec)')
                    engineRef.current = engine
                    probeCompletedRef.current = true
                   
                    // Cache result
                    const duration = engine.getDuration()
                    probeCache.set(src, { mode: 'hybrid', duration })
                   
                    setHybridDuration(duration)
                    setPlaybackMode('hybrid')
                    onMetadataLoad?.(duration)
                } else {
                    console.log('[VidstackPlayer] File can use native playback (supported codecs)')
                    // Engine not needed, cleanup
                    probeCompletedRef.current = true
                   
                    // Cache result
                    probeCache.set(src, { mode: 'native' })
                   
                    setPlaybackMode('native')
                }
            } catch (error) {
                console.error('[VidstackPlayer] Probe failed with exception:', error)
                if (!cancelled) {
                    // Cache failure as native to avoid retry loops
                    probeCache.set(src, { mode: 'native' })
                    setPlaybackMode('native')
                }
            }
        }

        probeFile()

        return () => {
            cancelled = true
        }
    }, [src, onMetadataLoad])

    // Initialize hybrid engine when in hybrid mode
    useEffect(() => {
        if (playbackMode !== 'hybrid' || !engineRef.current) return
        
        // Skip if already initialized (React Strict Mode protection)
        if (hybridInitializedRef.current) {
            console.log('[VidstackPlayer] Skipping hybrid init - already initialized')
            return
        }

        let cancelled = false

        const initHybrid = async () => {
            hybridInitializedRef.current = true
            const engine = engineRef.current!
            
            // Wait for video element ref to be populated
            let retries = 0
            while (!hybridVideoRef.current && retries < 20) {
                await new Promise(r => setTimeout(r, 50))
                retries++
            }

            const video = hybridVideoRef.current
            if (!video) {
                throw new Error('Video element ref not available for hybrid playback')
            }

            try {
                // Initialize engine with video element
                console.log('[VidstackPlayer] Initializing hybrid engine with video element...')
                await engine.initialize(video)
                console.log('[VidstackPlayer] Hybrid engine initialized')

                // Set duration
                const duration = engine.getDuration()
                setHybridDuration(duration)
                console.log('[VidstackPlayer] Duration set:', duration)

                // Listen to engine events
                engine.addEventListener('audioready', (e: any) => {
                    console.log('[VidstackPlayer] Audio data ready for playback')
                    setHybridReady(true)
                    // Don't auto-play - wait for user interaction
                })
                 
                engine.addEventListener('timeupdate', (e: any) => {
                    const { currentTime } = e.detail
                    setHybridCurrentTime(currentTime)
                    onTimeUpdate?.(currentTime, duration)
                })
                 
                engine.addEventListener('ended', () => {
                    onEnded?.()
                    setHybridPlaying(false)
                })
                 
                engine.addEventListener('error', (e: any) => {
                    console.error('[VidstackPlayer] Hybrid engine error:', e.detail.error)
                    // Fall back to native playback
                    setPlaybackMode('native')
                    onError?.(e.detail.error)
                })

                if (cancelled) return

                // Seek to start time
                if (startTime > 0) {
                    console.log('[VidstackPlayer] Seeking to start time:', startTime)
                    await engine.seek(startTime)
                }

                // Auto-play
                if (autoPlay) {
                    console.log('[VidstackPlayer] Starting autoplay...')
                    try {
                        await engine.play()
                        console.log('[VidstackPlayer] Autoplay started successfully')
                    } catch (e) {
                        console.warn('[VidstackPlayer] Autoplay failed:', e)
                    }
                }

                console.log('[VidstackPlayer] Hybrid playback initialized')
            } catch (error) {
                console.error('[VidstackPlayer] Hybrid init failed, falling back to native:', error)
                 
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
    }, [playbackMode, autoPlay, startTime, onTimeUpdate, onError])

    // Ref to store cleanup timeout (for cancellation on Strict Mode remount)
    const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    
    // Cancel any pending cleanup when component mounts
    useEffect(() => {
        if (cleanupTimeoutRef.current) {
            clearTimeout(cleanupTimeoutRef.current)
            cleanupTimeoutRef.current = null
            console.log('[VidstackPlayer] Cancelled pending cleanup (Strict Mode remount)')
        }
    }, [])

    // Define keyboard handlers here before using them
    const handleHybridPlay = useCallback(async () => {
        if (engineRef.current) {
            await engineRef.current.play()
            setHybridPlaying(true)
        }
    }, [])

    const handleHybridPause = useCallback(() => {
        if (engineRef.current) {
            engineRef.current.pause()
            setHybridPlaying(false)
        }
    }, [])

    const handleHybridSeek = useCallback(async (time: number) => {
        if (engineRef.current) {
            await engineRef.current.seek(time)
        }
    }, [])

    // Keyboard shortcuts for hybrid mode
    useEffect(() => {
        if (playbackMode !== 'hybrid') return

        const handleKeyDown = async (e: KeyboardEvent) => {
            // Ignore if typing in an input
            if ((e.target as HTMLElement).tagName === 'INPUT' ||
                (e.target as HTMLElement).tagName === 'TEXTAREA') {
                return
            }

            switch (e.key) {
                case ' ':
                case 'k':
                    e.preventDefault()
                    if (engineRef.current) {
                        if (hybridPlaying) {
                            await handleHybridPause()
                        } else {
                            await handleHybridPlay()
                        }
                    }
                    break
                case 'ArrowLeft':
                    e.preventDefault()
                    const seekBack = Math.max(0, hybridCurrentTime - 5)
                    setHybridCurrentTime(seekBack)
                    await handleHybridSeek(seekBack)
                    break
                case 'ArrowRight':
                    e.preventDefault()
                    const seekForward = Math.min(hybridDuration, hybridCurrentTime + 5)
                    setHybridCurrentTime(seekForward)
                    await handleHybridSeek(seekForward)
                    break
                case 'f':
                    e.preventDefault()
                    if (document.fullscreenElement) {
                        document.exitFullscreen()
                    } else {
                        document.documentElement.requestFullscreen()
                    }
                    break
                case 'm':
                    e.preventDefault()
                    if (hybridVideoRef.current) {
                        hybridVideoRef.current.muted = !hybridVideoRef.current.muted
                    }
                    break
            }
        }

        const handleMouseMove = () => {
            setShowControls(true)
            // Hide controls after 3 seconds of inactivity
            setTimeout(() => {
                if (hybridPlaying) {
                    setShowControls(false)
                }
            }, 3000)
        }

        window.addEventListener('keydown', handleKeyDown)
        window.addEventListener('mousemove', handleMouseMove)

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('mousemove', handleMouseMove)
        }
    }, [playbackMode, hybridPlaying, hybridCurrentTime, hybridDuration, handleHybridPlay, handleHybridPause, handleHybridSeek])

    // Cleanup on unmount or src change
    // Use a timeout to avoid destroying during React Strict Mode's quick unmount/remount
    useEffect(() => {
        return () => {
            // Delay cleanup slightly to allow Strict Mode remount to cancel it
            cleanupTimeoutRef.current = setTimeout(() => {
                console.log('[VidstackPlayer] Running delayed cleanup')
                // Destroy engine
                if (engineRef.current) {
                    engineRef.current.destroy()
                    engineRef.current = null
                }
                
                // Reset refs for new src
                probeCompletedRef.current = false
                hybridInitializedRef.current = false
                cleanupTimeoutRef.current = null
            }, 100) // Short delay - Strict Mode remounts happen synchronously
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
    const handlePlayerError = useCallback(async (event: any) => {
        const detail = event?.detail
        console.error('[VidstackPlayer] Error:', detail?.message || event)
        
        // Check if this might be an audio codec issue
        // If we haven't tried hybrid mode yet and URL might need it
        // AND we are not in Tauri (where we want native only)
        if (playbackMode === 'native' && !window.__TAURI__) {
            // Lazy load helper function
            const mightNeedHybridPlayback = await mightNeedHybridPlaybackPromise
            if (mightNeedHybridPlayback(src)) {
                console.log('[VidstackPlayer] Native playback failed, trying hybrid mode...')
                setPlaybackMode('probing')
                return
            }
        }
        
        onError?.(detail instanceof Error ? detail : new Error(detail?.message || 'Playback error'))
    }, [onError, playbackMode, src])


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

    // Hybrid playback mode with Vidstack UI
    // We provide our own video element that HybridEngine will take control of.
    // The video.src will be set by HybridEngine's MediaSource, not by Vidstack.
    if (playbackMode === 'hybrid') {
        return (
            <div className="vidstack-player hybrid-mode" style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                backgroundColor: '#000',
                overflow: 'hidden'
            }}>
                {/* Explicit video element for hybrid mode - HybridEngine will set src */}
                <video
                    ref={hybridVideoRef}
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                >
                    {/* Subtitle tracks must be children of video element */}
                    {subtitles.map((track, index) => (
                        <track
                            key={track.src || `sub-${index}`}
                            src={track.src}
                            kind="subtitles"
                            srcLang={track.language}
                            label={track.label}
                            default={track.default}
                        />
                    ))}
                </video>
                
                {/* Poster */}
                {poster && !hybridReady && (
                    <img
                        src={poster}
                        alt={title || ''}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            zIndex: 1
                        }}
                    />
                )}

                {/* Loading overlay when hybrid not ready */}
                {!hybridReady && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        zIndex: 40,
                        color: 'white'
                    }}>
                        <div style={{
                            width: 48,
                            height: 48,
                            border: '3px solid rgba(255,255,255,0.3)',
                            borderTopColor: 'white',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            marginBottom: '1rem'
                        }} />
                        <span>Preparing audio transcoding...</span>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                )}

                {/* Hybrid Controls Overlay */}
                {hybridReady && (
                    <div
                        style={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 50,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        }}
                        onClick={async () => {
                            // Toggle play/pause
                            if (engineRef.current) {
                                if (hybridPlaying) {
                                    await handleHybridPause()
                                    setHybridPlaying(false)
                                } else {
                                    // First play requires user interaction
                                    await handleHybridPlay()
                                    setHybridPlaying(true)
                                    // Also play audio element if it exists
                                    const audioElement = engineRef.current.getAudioElement()
                                    if (audioElement) {
                                        audioElement.play().catch((e: unknown) =>
                                            console.warn('[VidstackPlayer] Audio play error:', e)
                                        )
                                    }
                                }
                            }
                        }}
                    >
                        {/* Center Play/Pause Button */}
                        {!hybridPlaying && (
                            <div style={{
                                width: 64,
                                height: 64,
                                borderRadius: '50%',
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                border: '2px solid white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '24px',
                                paddingLeft: '4px' // Optical center for play triangle
                            }}>
                                ▶
                            </div>
                        )}
                        
                        {/* Hybrid Badge */}
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
                            pointerEvents: 'none'
                        }}>
                            HYBRID AUDIO
                        </div>

                        {/* Cast Button */}
                        <div style={{
                            position: 'absolute',
                            top: 16,
                            left: 16,
                            pointerEvents: 'auto'
                        }}>
                            <CastButton />
                        </div>


                        {/* Bottom Controls Bar */}
                        <div
                            style={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                bottom: 0,
                                padding: '20px',
                                background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                cursor: 'default',
                                opacity: showControls ? 1 : 0,
                                transition: 'opacity 0.3s ease'
                            }}
                            onClick={(e) => e.stopPropagation()} // Prevent play/pause toggle
                        >
                            {/* Seek Bar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                                <span style={{ color: 'white', fontSize: '12px', minWidth: '40px' }}>
                                    {new Date(hybridCurrentTime * 1000).toISOString().slice(14, 19)}
                                </span>
                                <input
                                    type="range"
                                    min={0}
                                    max={hybridDuration || 100}
                                    value={hybridCurrentTime}
                                    onChange={(e) => {
                                        const time = parseFloat(e.target.value)
                                        setHybridCurrentTime(time)
                                        handleHybridSeek(time)
                                    }}
                                    style={{
                                        flex: 1,
                                        height: '4px',
                                        accentColor: 'orange',
                                        cursor: 'pointer'
                                    }}
                                />
                                <span style={{ color: 'white', fontSize: '12px', minWidth: '40px' }}>
                                    {new Date((hybridDuration || 0) * 1000).toISOString().slice(14, 19)}
                                </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                                <span>Press space to play/pause</span>
                                <span>← → to seek</span>
                                <span>F for fullscreen</span>
                            </div>
                        </div>
                    </div>
                )}
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
                    googleCastButton: showCast ? <CastButton /> : null,
                    captionButton: <SubtitlesMenu tracks={subtitles} />,
                    beforeFullscreenButton: <AudioTracksMenu />
                }}
            >
            </DefaultVideoLayout>
        </MediaPlayer>
    )
}

export default VidstackPlayer
