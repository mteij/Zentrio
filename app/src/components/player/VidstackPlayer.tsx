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
    useMediaRemote,
    useMediaState,
    useCaptionOptions,
} from '@vidstack/react'
import { Captions, Check, Music, RotateCw, Smartphone, Settings } from 'lucide-react'

// Import Vidstack styles
import '@vidstack/react/player/styles/base.css'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'

// Custom components for slots
import { CastButton } from './CastButton'
import { toast } from '../../utils/toast'

// Lazy load hybrid media engine to reduce initial bundle size
// This is only loaded when hybrid playback is actually needed
const HybridEnginePromise = import('../../services/hybrid-media/HybridEngine').then(m => m.HybridEngine)
const mightNeedHybridPlaybackPromise = import('../../services/hybrid-media').then(m => m.mightNeedHybridPlayback)

// Tauri detection - hybrid playback is web-only
const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI__

// Global cache to prevent re-probing on remounts
// Maps URL -> 'native' | 'hybrid' | 'failed'
const probeCache = new Map<string, { mode: 'native' | 'hybrid', duration?: number }>()

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
    /** Notify when subtitle tracks fail to load */
    onSubtitleTrackError?: (track: SubtitleTrack) => void
}

function AudioTracksMenu() {
    const remote = useMediaRemote()
    const audioTracks = useMediaState('audioTracks')
    const currentAudioTrack = useMediaState('audioTrack')
    const [audioReady, setAudioReady] = useState(false)

    useEffect(() => {
        const timer = window.setTimeout(() => setAudioReady(true), 1200)
        return () => window.clearTimeout(timer)
    }, [])

    // Get display name for language
    const getLangName = (code: string) => {
        try {
            return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code
        } catch {
            return code
        }
    }

    // Stremio-like behavior: always expose at least one stable option
    const hasAudioTracks = audioTracks && audioTracks.length > 0
    const hasMultipleAudioTracks = audioTracks && audioTracks.length > 1
    const selectedTrackId = currentAudioTrack?.id?.toString() || 'auto'

    const trackOptions = useMemo<Array<{
        id: string
        label: string
        language?: string
        isAuto: boolean
        track?: any
    }>>(() => {
        if (!hasAudioTracks) {
            return [{ id: 'auto', label: 'Auto', language: 'und', isAuto: true }]
        }
        return [
            { id: 'auto', label: 'Auto', language: 'und', isAuto: true },
            ...audioTracks.map((track) => ({
                id: track.id?.toString?.() || 'unknown',
                label: track.label,
                language: track.language,
                isAuto: false,
                track
            }))
        ]
    }, [audioTracks, hasAudioTracks])

    return (
        <Menu.Root>
            <Menu.Button className="vds-menu-button vds-button" aria-label="Audio tracks">
                <Music className="vds-icon" />
            </Menu.Button>

            <Menu.Content className="vds-menu-items" placement="top" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <div className="vds-menu-title">Audio</div>

                <Menu.RadioGroup value={selectedTrackId}>
                    {trackOptions.map((opt) => (
                        opt.isAuto ? (
                            <Menu.Radio
                                key="audio-auto"
                                value="auto"
                                className="vds-menu-item"
                                onSelect={() => {
                                    if (hasAudioTracks && audioTracks[0]) {
                                        const first = audioTracks[0]
                                        ;(remote as any).changeAudioTrack(
                                            typeof first.id === 'number' ? first.id : parseInt(first.id?.toString?.() || '0')
                                        )
                                    }
                                    toast.success('Audio set to Auto')
                                }}
                            >
                                <span className="vds-menu-item-label">Auto</span>
                                <Check className="vds-radio-icon" size={14} />
                            </Menu.Radio>
                        ) : (
                            <Menu.Radio
                                key={opt.id}
                                value={opt.id}
                                className="vds-menu-item"
                                onSelect={() => {
                                    const rawId = opt.track?.id
                                    ;(remote as any).changeAudioTrack(
                                        typeof rawId === 'number' ? rawId : parseInt(rawId?.toString?.() || '0')
                                    )
                                }}
                            >
                            <span className="vds-menu-item-label">
                                {opt.label || getLangName(opt.language || 'und')}
                                {opt.language && opt.label && ` (${getLangName(opt.language)})`}
                            </span>
                            <Check className="vds-radio-icon" size={14} />
                        </Menu.Radio>
                        )
                    ))}
                </Menu.RadioGroup>
                
                {/* Info about audio tracks */}
                {hasAudioTracks && !hasMultipleAudioTracks && (
                    <div style={{ padding: '12px', color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginTop: '8px' }}>
                        Note: This video has a single audio track. Multiple audio tracks appear only if the video file contains multiple audio streams.
                    </div>
                )}

                {!hasAudioTracks && audioReady && (
                    <div style={{ padding: '12px', color: 'rgba(255,255,255,0.65)', fontSize: '12px', marginTop: '4px' }}>
                        No explicit tracks reported. Using default audio.
                    </div>
                )}
            </Menu.Content>
        </Menu.Root>
    )
}

function SubtitlesMenu({ tracks: _tracks }: { tracks: SubtitleTrack[] }) {
    // We only need remote for turning off subtitles (setting track -1)
    const remote = useMediaRemote()
    const captionOptions = useCaptionOptions()
    // Use textTrack only to see what is currently active
    const textTrack = useMediaState('textTrack')
    const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null)

    // Helper to extract clean language code
    const getCleanLang = useCallback((track: any) => {
        // 1. Trust explicit language property if valid (2-3 chars usually, not ":subtitles-...")
        if (track.language && track.language.length < 5 && !track.language.includes(':')) {
            return track.language
        }
        
        // 2. Try to parse from ID/Value if it looks like ":subtitles-ita"
        // Format seen: ":subtitles-ita (opensubtitles v3)" or just "subtitles-ita"
        const idToCheck = track.value || track.id || ''
        const match = idToCheck.match(/subtitles-([a-z]{2,3})\b/)
        if (match) return match[1]
        
        return track.language || 'unknown'
    }, [])

    // Helper to get display name
    const getLangName = useCallback((code: string) => {
        try {
            if (!code || code === 'off' || code === 'unknown') return 'Unknown'
            return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code
        } catch {
            return code
        }
    }, [])

    // Process all available tracks into a structured format
    // We strictly use captionOptions as they represent the tracks Vidstack is aware of and can select.
    const processedTracks = useMemo(() => {
        const byLanguage: Record<string, any[]> = {}
        const allLangs = new Set<string>()

        if (captionOptions) {
            captionOptions.forEach(opt => {
                if (opt.value === 'off') return
                const lang = getCleanLang(opt)
                if (!byLanguage[lang]) byLanguage[lang] = []
                
                // Prevent duplicate IDs within the same language group
                // This prevents "two children with same key" errors if addons return duplicates
                if (!byLanguage[lang].some(t => t.id === opt.value)) {
                    byLanguage[lang].push({
                        id: opt.value,
                        label: opt.label,
                        src: 'native',
                        select: opt.select,
                        selected: opt.selected,
                        // Store option for direct selection
                        option: opt
                    })
                }
                allLangs.add(lang)
            })
        }

        return {
            byLanguage,
            languages: Array.from(allLangs).sort((a, b) => getLangName(a).localeCompare(getLangName(b)))
        }
    }, [captionOptions, getLangName, getCleanLang])

    // Current selected language
    const currentLang = textTrack?.language || (textTrack?.mode === 'showing' ? 'unknown' : null)
    
    // Auto-select language category
    useEffect(() => {
        if (selectedLanguage) return
        if (currentLang && processedTracks.byLanguage[currentLang]) {
            setSelectedLanguage(currentLang)
            return
        }
        if (processedTracks.languages.length > 0) {
            setSelectedLanguage(processedTracks.languages[0])
        }
    }, [currentLang, processedTracks, selectedLanguage])

    const hasAnySubtitles = processedTracks.languages.length > 0

    return (
        <Menu.Root>
            {/* Global style to hide the default Captions menu item in the Settings menu (duplicate) */}
             <style>{`
                /* Hide the Captions item in the main settings menu */
                .vds-menu-items [data-testid="captions-menu-item"],
                .vds-menu-item[aria-label="Captions"],
                .vds-menu-item[aria-label="Subtitles"],
                .vds-menu-item[data-section="captions"],
                /* Try to target by icon presence if supported */
                .vds-menu-item:has(svg.vds-icon-captions),
                .vds-menu-item:has([aria-label="Captions"]) {
                   display: none !important;
                }
            `}</style>
            
            <Menu.Button className="vds-menu-button vds-button" aria-label="Subtitles" style={{ display: 'flex' }}>
                <Captions className="vds-icon" size={20} />
            </Menu.Button>

            <Menu.Content className="vds-menu-items" placement="top" style={{ 
                width: '600px', 
                height: '400px', 
                maxHeight: '80vh',
                maxWidth: '90vw',
                display: 'flex', 
                flexDirection: 'column',
                padding: 0,
                overflow: 'hidden'
            }}>
                <div className="vds-menu-title" style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    Subtitles
                </div>
                
                {!hasAnySubtitles ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
                        <div>No subtitles available</div>
                        <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.7 }}>
                            Install a subtitle addon (e.g. OpenSubtitles)
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                        {/* Left Column: Languages */}
                        <div style={{ 
                            width: '200px', 
                            borderRight: '1px solid rgba(255,255,255,0.1)', 
                            overflowY: 'auto',
                            backgroundColor: 'rgba(0,0,0,0.2)'
                        }}>
                             {/* Off Option - Fixed at top */}
                            <div 
                                className="vds-menu-item" 
                                style={{ 
                                    padding: '10px 16px', 
                                    cursor: 'pointer',
                                    backgroundColor: !textTrack || textTrack.mode === 'disabled' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}
                                onClick={() => {
                                     (remote as any).changeTextTrack(-1)
                                     toast.success('Subtitles turned off')
                                }}
                            >
                                <span className="vds-menu-item-label">Off</span>
                                {(!textTrack || textTrack.mode === 'disabled') && <Check className="vds-radio-icon" size={14} />}
                            </div>

                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

                             {/* Language List */}
                             {processedTracks.languages.map(lang => (
                                 <div 
                                    key={lang}
                                    className="vds-menu-item"
                                    style={{ 
                                        padding: '10px 16px', 
                                        cursor: 'pointer',
                                        backgroundColor: selectedLanguage === lang ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                        opacity: currentLang === lang ? 1 : 0.8
                                    }}
                                    onClick={() => setSelectedLanguage(lang)}
                                 >
                                     <span className="vds-menu-item-label">
                                         {getLangName(lang)}
                                         <span style={{ fontSize: '10px', marginLeft: '6px', opacity: 0.5 }}>
                                             {processedTracks.byLanguage[lang].length}
                                         </span>
                                     </span>
                                     {currentLang === lang && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--media-brand)', marginLeft: 'auto' }} />}
                                 </div>
                             ))}
                        </div>

                        {/* Right Column: Tracks for selected language */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                            {!selectedLanguage ? (
                                <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>Select a language</div>
                            ) : (
                                <div>
                                    <div style={{ 
                                        padding: '8px 12px', 
                                        fontSize: '12px', 
                                        fontWeight: 'bold', 
                                        color: 'var(--media-brand)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        {getLangName(selectedLanguage)}
                                    </div>
                                    <Menu.RadioGroup value={textTrack?.id || ''}>
                                        {processedTracks.byLanguage[selectedLanguage].map((track, i) => (
                                            <Menu.Radio
                                                key={`${track.id}-${i}`}
                                                value={track.id}
                                                className="vds-menu-item"
                                                style={{ padding: '8px 12px', borderRadius: '4px' }}
                                                onSelect={() => {
                                                    // ALWAYS use option.select() - it handles internal logic correctly
                                                    if (track.option && track.option.select) {
                                                        track.option.select()
                                                        toast.success(`Subtitle set to ${track.label}`)
                                                    } else {
                                                        console.error('Track missing select method:', track)
                                                        toast.error('Failed to select subtitle')
                                                    }
                                                }}
                                            >
                                                <span className="vds-menu-item-label" style={{ fontSize: '13px' }}>
                                                    {track.label}
                                                </span>
                                                <Check className="vds-radio-icon" size={14} />
                                            </Menu.Radio>
                                        ))}
                                    </Menu.RadioGroup>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Menu.Content>
        </Menu.Root>
    )
}

// Orientation type
type OrientationMode = 'auto' | 'landscape' | 'portrait'

// Helper to get saved orientation preference
const getSavedOrientationPreference = (): OrientationMode => {
    if (typeof window === 'undefined') return 'landscape'
    const saved = localStorage.getItem('player-orientation-mode')
    return (saved as OrientationMode) || 'landscape'
}

// Helper to check if mobile
const isMobileDevice = (): boolean => {
    if (typeof window === 'undefined') return false
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (window.innerWidth <= 768 && 'ontouchstart' in window)
}

function OrientationMenu() {
    const [orientationMode, setOrientationMode] = useState<OrientationMode>('landscape')

    useEffect(() => {
        setOrientationMode(getSavedOrientationPreference())
    }, [])

    const handleOrientationChange = (mode: OrientationMode) => {
        setOrientationMode(mode)
        localStorage.setItem('player-orientation-mode', mode)
        
        // Try to apply orientation lock
        if ('screen' in window && 'orientation' in (window as any).screen) {
            const screen = (window as any).screen
            if (screen.orientation && screen.orientation.lock && screen.orientation.unlock) {
                if (mode === 'landscape') {
                    screen.orientation.lock('landscape').catch(() => {})
                } else if (mode === 'portrait') {
                    screen.orientation.lock('portrait').catch(() => {})
                } else {
                    screen.orientation.unlock().catch(() => {})
                }
            }
        }
        
        toast.success(`Orientation set to ${mode === 'auto' ? 'auto (unlocked)' : mode}`)
    }

    // Only show on mobile devices
    if (!isMobileDevice()) return null

    return (
        <Menu.Root>
            <Menu.Button className="vds-menu-button vds-button" aria-label="Orientation settings">
                <Smartphone className="vds-icon" />
            </Menu.Button>

            <Menu.Content className="vds-menu-items" placement="top">
                <div className="vds-menu-title">Orientation</div>

                <Menu.RadioGroup value={orientationMode}>
                    <Menu.Radio
                        value="landscape"
                        className="vds-menu-item"
                        onSelect={() => handleOrientationChange('landscape')}
                    >
                        <span className="vds-menu-item-label">Landscape (Default)</span>
                        {orientationMode === 'landscape' && <Check className="vds-radio-icon" size={14} />}
                    </Menu.Radio>
                    <Menu.Radio
                        value="portrait"
                        className="vds-menu-item"
                        onSelect={() => handleOrientationChange('portrait')}
                    >
                        <span className="vds-menu-item-label">Portrait</span>
                        {orientationMode === 'portrait' && <Check className="vds-radio-icon" size={14} />}
                    </Menu.Radio>
                    <Menu.Radio
                        value="auto"
                        className="vds-menu-item"
                        onSelect={() => handleOrientationChange('auto')}
                    >
                        <span className="vds-menu-item-label">Auto (Unlocked)</span>
                        {orientationMode === 'auto' && <Check className="vds-radio-icon" size={14} />}
                    </Menu.Radio>
                </Menu.RadioGroup>
                
                <div style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.5)', fontSize: '11px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '8px' }}>
                    Lock the screen orientation during playback
                </div>
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
    onSubtitleTrackError,
    onMetadataLoad,
    startTime = 0,
    autoPlay = true,
    showCast = true
}: VidstackPlayerProps) {
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
        // Force native playback in Tauri - hybrid is web-only
        if (isTauri) {
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

    // Best-effort subtitle failure detection for native mode.
    // If external subtitle tracks were provided but Vidstack doesn't expose text tracks after load,
    // treat this as a loading failure and notify host page for retry UX.
    useEffect(() => {
        if (playbackMode !== 'native' || !onSubtitleTrackError || subtitles.length === 0) return

        const timer = window.setTimeout(() => {
            type PlayerTextTrack = { kind?: string }
            const player = playerRef.current as unknown as {
                state?: { textTracks?: PlayerTextTrack[] }
            } | null

            const textTracks = player?.state?.textTracks
            const hasLoadedSubtitleTrack =
                Array.isArray(textTracks) &&
                textTracks.some(
                    (track: PlayerTextTrack) =>
                        track.kind === 'subtitles' || track.kind === 'captions'
                )

            if (!hasLoadedSubtitleTrack) {
                onSubtitleTrackError(subtitles[0])
            }
        }, 6000)

        return () => window.clearTimeout(timer)
    }, [playbackMode, onSubtitleTrackError, subtitles])
    
    // Store callbacks in refs to avoid re-triggering probe effect
    const onMetadataLoadRef = useRef(onMetadataLoad)
    onMetadataLoadRef.current = onMetadataLoad

    // Probe file to check if we need hybrid playback
    useEffect(() => {
        // Skip probing in Tauri - hybrid playback is web-only
        if (isTauri) {
            console.log('[VidstackPlayer] Skipping probe - Tauri uses native playback')
            return
        }
        
        // Check cache (again, in case it populated while mounting)
        const cached = probeCache.get(src)
        if (cached) {
             console.log('[VidstackPlayer] Using cached probe result:', cached.mode, 'duration:', cached.duration)
             if (cached.mode === 'hybrid') {
                 setHybridDuration(cached.duration || 0)
                 setPlaybackMode('hybrid')
                 if (cached.duration) onMetadataLoadRef.current?.(cached.duration)
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
                    console.log('[VidstackPlayer] Probe cancelled after completion, ignoring result')
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
                    onMetadataLoadRef.current?.(duration)
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
    }, [src]) // Only re-run when src changes, not when callbacks change

    // Store callbacks in refs to avoid re-triggering effects
    const onTimeUpdateRef = useRef(onTimeUpdate)
    const onEndedRef = useRef(onEnded)
    const onErrorRef = useRef(onError)
    onTimeUpdateRef.current = onTimeUpdate
    onEndedRef.current = onEnded
    onErrorRef.current = onError

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
                engine.addEventListener('audioready', (_e: any) => {
                    console.log('[VidstackPlayer] Audio data ready for playback')
                    setHybridReady(true)
                    // Don't auto-play - wait for user interaction
                })
                 
                engine.addEventListener('timeupdate', (e: any) => {
                    const { currentTime } = e.detail
                    setHybridCurrentTime(currentTime)
                    onTimeUpdateRef.current?.(currentTime, duration)
                })
                 
                engine.addEventListener('ended', () => {
                    onEndedRef.current?.()
                    setHybridPlaying(false)
                })
                 
                engine.addEventListener('error', (e: any) => {
                    console.error('[VidstackPlayer] Hybrid engine error:', e.detail.error)
                    // Fall back to native playback
                    setPlaybackMode('native')
                    onErrorRef.current?.(e.detail.error)
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
                onErrorRef.current?.(error instanceof Error ? error : new Error(String(error)))
            }
        }

        initHybrid()

        return () => {
            cancelled = true
        }
    }, [playbackMode, autoPlay, startTime]) // Only re-run when these change, not callbacks

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
            await engineRef.current.resume()
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
                case 'ArrowLeft': {
                    e.preventDefault()
                    const seekBack = Math.max(0, hybridCurrentTime - 5)
                    setHybridCurrentTime(seekBack)
                    await handleHybridSeek(seekBack)
                    break
                }
                case 'ArrowRight': {
                    e.preventDefault()
                    const seekForward = Math.min(hybridDuration, hybridCurrentTime + 5)
                    setHybridCurrentTime(seekForward)
                    await handleHybridSeek(seekForward)
                    break
                }
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
        if (playbackMode === 'native' && !isTauri) {
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
                    <span style={{ fontSize: '12px', opacity: 0.7 }}>
                        Checking codec compatibility
                    </span>
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
                        onError={() => onSubtitleTrackError?.(track)}
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
                        <span style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px' }}>
                            Processing in chunks for instant playback
                        </span>
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
                    beforeFullscreenButton: <>
                        <AudioTracksMenu />
                        <OrientationMenu />
                    </>
                }}
            >
            </DefaultVideoLayout>
        </MediaPlayer>
    )
}

export default VidstackPlayer
