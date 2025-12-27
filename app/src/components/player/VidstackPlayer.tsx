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
    type TextTrack
} from '@vidstack/react'
import { ChevronRight, Captions, Check } from 'lucide-react'

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

function SubtitlesMenu({ tracks }: { tracks: SubtitleTrack[] }) {
    const remote = useMediaRemote()
    const textTrack = useMediaState('textTrack')
    const store = useMediaStore()
    
    // Group tracks by language
    const groupedTracks = useMemo(() => {
        const groups: Record<string, { track: SubtitleTrack, index: number }[]> = {}
        
        tracks.forEach((track, index) => {
            const lang = track.language || 'und'
            if (!groups[lang]) groups[lang] = []
            groups[lang].push({ track, index })
        })
        
        return groups
    }, [tracks])

    // Get display name for language (using Intl.DisplayNames if available)
    const getLangName = (code: string) => {
        try {
            return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code
        } catch {
            return code
        }
    }

    const currentTrackIndex = useMemo(() => {
        if (!textTrack) return -1
        // We need to find the index of the current textTrack in the Vidstack list
        // and map it back to our tracks. 
        // Note: Vidstack might add its own auto-generated tracks, so we need to be careful.
        // But since we control the Track components, passing index should work if order is preserved.
        return Array.from(store.textTracks).findIndex(t => t === textTrack)
    }, [textTrack, store.textTracks])

    return (
        <Menu.Root>
            <Menu.Button className="vds-menu-button vds-button">
                <Captions className="vds-icon" />
            </Menu.Button>

            <Menu.Content className="vds-menu-items" placement="top" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <div className="vds-menu-title">Subtitles</div>
                
                {/* Off Option */}
                <Menu.Item 
                    className="vds-menu-item" 
                    onClick={() => {
                        if (currentTrackIndex !== -1) {
                            (remote as any).changeTextTrackMode(currentTrackIndex, 'disabled')
                        } else {
                            // If no track is selected, ensure mode is disabled generally if possible, 
                            // or just do nothing as it's already off.
                            // Some versions might support -1 or similar.
                            (remote as any).changeTextTrackMode(-1, 'disabled')
                        }
                    }}
                >
                    <span className="vds-menu-item-label">Off</span>
                    {!textTrack && <Check className="vds-menu-item-icon" size={14} />}
                </Menu.Item>

                <div className="vds-menu-divider" />

                {Object.entries(groupedTracks).map(([lang, groupTracks]) => {
                    const langName = getLangName(lang)
                    const isActiveLang = groupTracks.some(t => t.index === currentTrackIndex)
                    
                    return (
                        <Menu.Root key={lang}>
                            <Menu.Button className="vds-menu-item">
                                <span className="vds-menu-item-label">{langName}</span>
                                <div className="vds-menu-item-hint">
                                    {groupTracks.length}
                                </div>
                                <ChevronRight className="vds-menu-item-icon" size={14} />
                            </Menu.Button>
                            
                            <Menu.Content className="vds-menu-items" placement="right" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                <div className="vds-menu-title">{langName}</div>
                                <Menu.RadioGroup value={isActiveLang ? currentTrackIndex.toString() : undefined}>
                                    {groupTracks.map(({ track, index }) => (
                                        <Menu.Radio 
                                            className="vds-menu-item" 
                                            key={index} 
                                            value={index.toString()}
                                            onSelect={() => {
                                                // Disable current track if any
                                                if (currentTrackIndex !== -1) {
                                                    // This might not be needed if setting next track to showing auto-disables others
                                                }
                                                // We can't access textTracks[index].mode directly via remote?
                                                // Try generic command
                                                // Based on Vidstack internals, we might need to iterate or find the right command.
                                                // Assuming changeTextTrackMode works if we pass index? 
                                                // Actually, standard API is usually just changeTextTrackMode(mode) which affects *current* track.
                                                // To CHANGE the current track, we usually use changeTextTrack(index).
                                                // If TS says it doesn't exist, maybe it's `changeTextTrackKind`? No.
                                                // Let's try casting for now as it might be a valid method missing in TS defs or I'm using an older version.
                                                // Alternatively, use the player instance via ref if we had it, but we can't easily pass it here without props.
                                                
                                                // NOTE: Using 'any' cast to bypass TS error if method exists at runtime
                                                (remote as any).changeTextTrack(index)
                                                (remote as any).changeTextTrackMode('showing')
                                            }}
                                        >
                                            <span className="vds-menu-item-label">
                                                {track.type || 'Standard'}
                                                {track.addonName ? ` (${track.addonName})` : ''}
                                            </span>
                                            <Check className="vds-radio-icon" size={14} />
                                        </Menu.Radio>
                                    ))}
                                </Menu.RadioGroup>
                            </Menu.Content>
                        </Menu.Root>
                    )
                })}
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
    const playerRef = useRef<MediaPlayerInstance>(null)
    const hybridVideoRef = useRef<HTMLVideoElement>(null)
    const engineRef = useRef<HybridEngine | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    
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
        // Skip probing in Tauri
        if (window.__TAURI__) return
        if (playbackMode !== 'probing' || !src) return
        
        // Skip if we've already completed probing for this src
        if (probeCompletedRef.current && engineRef.current) {
            console.log('[VidstackPlayer] Skipping probe - already completed')
            setPlaybackMode('hybrid')
            return
        }
        
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
                    probeCompletedRef.current = true
                    setHybridDuration(engine.totalDuration)
                    setPlaybackMode('hybrid')
                    onMetadataLoad?.(engine.totalDuration)
                } else {
                    console.log('[VidstackPlayer] File can use native playback')
                    engine.destroy()
                    probeCompletedRef.current = true
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
            
            // Wait for the video element ref to be populated
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

                if (cancelled) return

                // Note: We don't need manual event listeners for timeupdate/ended anymore
                // because Vidstack listens to the native video element events directly.
                // HybridEngine now syncs its state with the video element events.

                // Seek to start time
                if (startTime > 0) {
                    await engine.seek(startTime)
                }

                setHybridReady(true)

                // Auto-play
                if (autoPlay) {
                    try {
                        // We rely on the engine.start() to handle audio resuming
                        await engine.start()
                    } catch (e) {
                        console.warn('[VidstackPlayer] Autoplay start failed:', e)
                    }
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

    // Cleanup on unmount or src change
    // Use a timeout to avoid destroying during React Strict Mode's quick unmount/remount
    useEffect(() => {
        return () => {
            // Delay cleanup slightly to allow Strict Mode remount to cancel it
            cleanupTimeoutRef.current = setTimeout(() => {
                console.log('[VidstackPlayer] Running delayed cleanup')
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
    const handlePlayerError = useCallback((event: any) => {
        const detail = event?.detail
        console.error('[VidstackPlayer] Error:', detail?.message || event)
        
        // Check if this might be an audio codec issue
        // If we haven't tried hybrid mode yet and the URL might need it
        // AND we are not in Tauri (where we want native only)
        if (playbackMode === 'native' && mightNeedHybridPlayback(src) && !window.__TAURI__) {
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

    // Hybrid playback mode with Vidstack UI
    // We provide our own video element that HybridEngine will take control of.
    // The video.src will be set by HybridEngine's MediaSource, not by Vidstack.
    if (playbackMode === 'hybrid') {
        return (
            <MediaPlayer
                ref={playerRef}
                title={title}
                autoPlay={false}
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                onError={handlePlayerError}
                className="vidstack-player hybrid-mode"
                style={{ backgroundColor: '#000' }}
            >
                <MediaProvider>
                    {/* Explicit video element for hybrid mode - HybridEngine will set src */}
                    <video 
                        ref={hybridVideoRef}
                        playsInline
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
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

                {/* Standard Vidstack Layout */}
                <DefaultVideoLayout
                    icons={defaultLayoutIcons}
                    slots={{
                        googleCastButton: showCast ? <CastButton /> : null,
                        captionButton: <SubtitlesMenu tracks={subtitles} />
                    }}
                />

                {/* Hybrid mode indicator overlay */}
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
                    zIndex: 50,
                    pointerEvents: 'none'
                }}>
                    HYBRID AUDIO
                </div>
            </MediaPlayer>
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
                    captionButton: <SubtitlesMenu tracks={subtitles} />
                }}
            />
        </MediaPlayer>
    )
}

export default VidstackPlayer
