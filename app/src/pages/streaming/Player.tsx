/**
 * StreamingPlayer - Video player page using Vidstack
 * 
 * This page handles:
 * - URL/state parsing for stream and meta info
 * - Progress saving
 * - Subtitle loading from addons
 * - Episode navigation
 * - Back button overlay
 * - Mobile orientation handling
 * 
 * Video playback is handled by VidstackPlayer component.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, X, AlertTriangle, SkipForward, Smartphone } from 'lucide-react'
import { Layout, SkeletonPlayer } from '../../components'
import { VidstackPlayer } from '../../components/player/VidstackPlayer'
import { Stream } from '../../services/addons/types'
import { toast } from 'sonner'
import { useExternalPlayer } from '../../hooks/useExternalPlayer'
import styles from '../../styles/Player.module.css'
import { apiFetch } from '../../lib/apiFetch'
import { isTauri } from '../../lib/auth-client'
import { resolveBeaconUrl } from '../../lib/url'

// Threshold for "short video" warning (videos under 5 minutes)
const SHORT_VIDEO_THRESHOLD = 300 // 5 minutes in seconds
// Time before end to show next episode popup
const NEXT_EPISODE_COUNTDOWN_START = 30 // seconds before end

// Orientation settings type
type OrientationMode = 'auto' | 'landscape' | 'portrait'

// Helper to detect mobile devices
const isMobileDevice = (): boolean => {
    if (typeof window === 'undefined') return false
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (window.innerWidth <= 768 && 'ontouchstart' in window)
}

// Helper to check if in portrait mode
const isPortraitMode = (): boolean => {
    if (typeof window === 'undefined') return false
    return window.innerHeight > window.innerWidth
}

// Get saved orientation preference
const getSavedOrientationPreference = (): OrientationMode => {
    if (typeof window === 'undefined') return 'landscape'
    const saved = localStorage.getItem('player-orientation-mode')
    return (saved as OrientationMode) || 'landscape'
}

// Save orientation preference
const saveOrientationPreference = (mode: OrientationMode): void => {
    localStorage.setItem('player-orientation-mode', mode)
}

interface EpisodeInfo {
    season: number
    number: number
    title: string
}

interface MetaInfo {
    id: string
    type: string
    name: string
    poster?: string
    season?: number
    episode?: number
    videos?: { season: number; number: number; id: string; title?: string }[]
}

type PlayerSubtitleTrack = {
    src: string
    label: string
    language: string
    type?: string
    addonName?: string
    default?: boolean
}

function mergeSubtitleTracks(
    baseTracks: PlayerSubtitleTrack[],
    incomingTracks: PlayerSubtitleTrack[],
): PlayerSubtitleTrack[] {
    if (incomingTracks.length === 0) return baseTracks

    const bySrc = new Map<string, PlayerSubtitleTrack>()
    baseTracks.forEach((track) => {
        if (track.src) bySrc.set(track.src, track)
    })

    incomingTracks.forEach((track) => {
        if (!track.src) return
        if (!bySrc.has(track.src)) bySrc.set(track.src, track)
    })

    return Array.from(bySrc.values())
}

export const StreamingPlayer = () => {
    const { profileId } = useParams<{ profileId: string }>()
    const [searchParams] = useSearchParams()
    const searchParamsKey = searchParams.toString()
    const navigate = useNavigate()
    const location = useLocation()
    const playerWrapperRef = useRef<HTMLDivElement | null>(null)

    // External player hook
    const { openInPlayer, getAvailablePlayers } = useExternalPlayer()
    const [externalMenuOpen, setExternalMenuOpen] = useState(false)

    // Parsed data from URL
    const [stream, setStream] = useState<Stream | null>(null)
    const [meta, setMeta] = useState<MetaInfo | null>(null)
    const [startTime, setStartTime] = useState<number>(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Subtitles from addons
  const [subtitleTracks, setSubtitleTracks] = useState<Array<{
        src: string
        label: string
        language: string
        type?: string
        addonName?: string
        default?: boolean
  }>>([])
  const subtitleRetryMapRef = useRef<Map<string, number>>(new Map())

    // Episode navigation
    const [prevEpisode, setPrevEpisode] = useState<EpisodeInfo | null>(null)
    const [nextEpisode, setNextEpisode] = useState<EpisodeInfo | null>(null)

    // UI State
    const [showOverlay, setShowOverlay] = useState(true)
    const overlayTimeoutRef = useRef<number | null>(null)

    // Duration for progress saving
    const [duration, setDuration] = useState(0)
    const lastSavedProgressRef = useRef<number>(0)

    // Next episode popup state
    const [showNextEpisodePopup, setShowNextEpisodePopup] = useState(false)
    const [countdown, setCountdown] = useState(NEXT_EPISODE_COUNTDOWN_START)
    const countdownIntervalRef = useRef<number | null>(null)

    // Short video warning state
    const [showShortVideoWarning, setShowShortVideoWarning] = useState(false)
    const [shortVideoProgress, setShortVideoProgress] = useState(0)
    const shortVideoWarningDismissedRef = useRef(false)

    // Trakt scrobbling state
    const traktScrobbleStartedRef = useRef(false)

    // Mobile orientation state
    const [isMobile, setIsMobile] = useState(false)
    const [isPortrait, setIsPortrait] = useState(false)
    const [orientationMode, setOrientationMode] = useState<OrientationMode>('landscape')
    const [showOrientationPrompt, setShowOrientationPrompt] = useState(false)
    const [orientationPromptDismissed, setOrientationPromptDismissed] = useState(false)
    const orientationLockAttemptedRef = useRef(false)

    // Force reload if not cross-origin isolated (needed for FFMPEG)
    useEffect(() => {
        // Skip for Tauri (uses native playback)
        if (isTauri()) return

        if (!window.crossOriginIsolated) {
            console.log('[Player] Not cross-origin isolated, reloading to enable...')
            // Prevent infinite reload loops with a session storage flag, although the server should handle it
            if (!sessionStorage.getItem('reloading_for_isolation')) {
                sessionStorage.setItem('reloading_for_isolation', 'true')
                window.location.reload()
            } else {
                 // If we reloaded and still failed, clear the flag to avoid getting stuck, but log error
                 console.error('[Player] Failed to enable isolation after reload')
                 sessionStorage.removeItem('reloading_for_isolation')
            }
        } else {
            // We are isolated, clear the flag
            sessionStorage.removeItem('reloading_for_isolation')
        }
    }, [])

    // Mobile orientation handling
    useEffect(() => {
        // Initialize orientation settings
        const mobile = isMobileDevice()
        const portrait = isPortraitMode()
        const savedMode = getSavedOrientationPreference()
        
        setIsMobile(mobile)
        setIsPortrait(portrait)
        setOrientationMode(savedMode)

        // Show orientation prompt on mobile if in portrait and mode is landscape
        if (mobile && portrait && savedMode === 'landscape') {
            setShowOrientationPrompt(true)
        }

        // Listen for orientation changes
        const handleOrientationChange = () => {
            const newPortrait = isPortraitMode()
            setIsPortrait(newPortrait)
            
            // Show/hide prompt based on orientation
            if (isMobile && savedMode === 'landscape') {
                if (newPortrait && !orientationPromptDismissed) {
                    setShowOrientationPrompt(true)
                } else {
                    setShowOrientationPrompt(false)
                }
            }
        }

        // Listen for resize events (covers orientation change)
        window.addEventListener('resize', handleOrientationChange)
        
        // Also listen for the orientationchange event for older browsers
        window.addEventListener('orientationchange', handleOrientationChange)

        return () => {
            window.removeEventListener('resize', handleOrientationChange)
            window.removeEventListener('orientationchange', handleOrientationChange)
        }
    }, [orientationPromptDismissed])

    // Attempt to lock orientation on mobile when player loads
    useEffect(() => {
        if (!isMobile || orientationLockAttemptedRef.current) return
        
        orientationLockAttemptedRef.current = true
        
        // Try to lock to landscape if that's the preference
        if (orientationMode === 'landscape' && 'screen' in window && 'orientation' in (window as any).screen) {
            const screen = (window as any).screen
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch((e: Error) => {
                    // Orientation lock not supported or denied - this is fine
                    console.log('[Player] Orientation lock not available or denied:', e.message)
                })
            }
        }
    }, [isMobile, orientationMode])

    // Handle orientation mode change
    const handleOrientationModeChange = useCallback((mode: OrientationMode) => {
        setOrientationMode(mode)
        saveOrientationPreference(mode)
        
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
        
        toast.success(`Orientation set to ${mode === 'auto' ? 'auto' : mode}`)
    }, [])

    // Dismiss orientation prompt
    const dismissOrientationPrompt = useCallback(() => {
        setShowOrientationPrompt(false)
        setOrientationPromptDismissed(true)
    }, [])

    // Parse URL params or location state
    useEffect(() => {
        let cancelled = false

        const fetchResumeProgress = async (parsedMeta: MetaInfo): Promise<number> => {
            try {
                const seasonParam = parsedMeta.season ? `&season=${parsedMeta.season}` : ''
                const episodeParam = parsedMeta.episode ? `&episode=${parsedMeta.episode}` : ''
                const progressUrl = `/api/streaming/progress/${parsedMeta.type}/${parsedMeta.id}?profileId=${profileId}${seasonParam}${episodeParam}`
                const progRes = await apiFetch(progressUrl)
                if (!progRes.ok) return 0

                const progData = await progRes.json()
                return progData.position && !progData.isWatched ? progData.position : 0
            } catch {
                return 0
            }
        }

        const fetchAddonSubtitles = async (
            parsedMeta: MetaInfo,
            parsedStream: Stream,
            profileIdValue: string,
        ): Promise<PlayerSubtitleTrack[]> => {
            try {
                const videoHash = parsedStream?.behaviorHints?.videoHash
                const hashParam = videoHash ? `&videoHash=${videoHash}` : ''
                const subtitleUrl = `/api/streaming/subtitles/${parsedMeta.type}/${parsedMeta.id}?profileId=${profileIdValue}${hashParam}`
                const res = await apiFetch(subtitleUrl)
                if (!res.ok) return []

                const data = await res.json()
                if (!data.subtitles || !Array.isArray(data.subtitles)) return []

                return data.subtitles
                    .filter((sub: { url?: string }) => !!sub?.url)
                    .map(
                        (sub: {
                            url: string
                            lang: string
                            addonName?: string
                            type?: string
                            format?: string
                        }) => ({
                            src: sub.url,
                            label: sub.addonName ? `${sub.lang} (${sub.addonName})` : sub.lang,
                            language: sub.lang || 'und',
                            type: sub.type || sub.format,
                            addonName: sub.addonName,
                        }),
                    )
            } catch {
                return []
            }
        }

        const initPlayer = async () => {
            try {
                let parsedStream: Stream | null = null
                let parsedMeta: MetaInfo | null = null

                // Check location state first (from navigation)
                if (location.state?.stream && location.state?.meta) {
                    parsedStream = location.state.stream
                    parsedMeta = location.state.meta
                } else {
                    // Fall back to URL params
                    const params = new URLSearchParams(searchParamsKey)
                    const streamParam = params.get('stream')
                    const metaParam = params.get('meta')

                    if (!streamParam || !metaParam) {
                        navigate(`/streaming/${profileId}`)
                        return
                    }

                    parsedStream = JSON.parse(streamParam)
                    parsedMeta = JSON.parse(metaParam)
                }

                if (!parsedStream || !parsedMeta) {
                    throw new Error('Invalid stream or meta data')
                }

                setStream(parsedStream)
                setMeta(parsedMeta)

                // Load inline subtitles from stream
                const tracks: PlayerSubtitleTrack[] = []
                if (parsedStream.subtitles && Array.isArray(parsedStream.subtitles)) {
                    parsedStream.subtitles.forEach((sub: { url: string; lang: string }, i: number) => {
                        if (sub?.url) {
                            tracks.push({
                                src: sub.url,
                                label: sub.lang || 'Unknown',
                                language: sub.lang || 'und',
                                default: i === 0
                            })
                        }
                    })
                }

                setSubtitleTracks(tracks)

                // Run progress fetch and subtitle addon fetch in parallel.
                // We await progress for resume accuracy, while subtitles merge in background.
                const subtitlePromise = fetchAddonSubtitles(parsedMeta, parsedStream, profileId!).then((addonTracks) => {
                    if (cancelled || addonTracks.length === 0) return
                    setSubtitleTracks((prev) => mergeSubtitleTracks(prev as PlayerSubtitleTrack[], addonTracks))
                })

                const watchStart = await fetchResumeProgress(parsedMeta)
                if (cancelled) return

                setStartTime(watchStart)
                lastSavedProgressRef.current = watchStart
                setLoading(false)

                void subtitlePromise
            } catch (e) {
                console.error('Failed to initialize player', e)
                if (cancelled) return
                setError('Invalid player parameters')
                setLoading(false)
            }
        }

        initPlayer()

        return () => {
            cancelled = true
        }
    }, [searchParamsKey, profileId, location.state, navigate])

    // Calculate episode navigation
    useEffect(() => {
        if (!meta || meta.type !== 'series' || !meta.videos || !meta.season || !meta.episode) return

        const currentSeason = meta.season
        const currentEpisode = meta.episode
        const videos = meta.videos.sort((a, b) => (a.season - b.season) || (a.number - b.number))

        const currentIndex = videos.findIndex(
            v => v.season === currentSeason && v.number === currentEpisode
        )

        if (currentIndex > 0) {
            const prev = videos[currentIndex - 1]
            setPrevEpisode({ season: prev.season, number: prev.number, title: prev.title || '' })
        }

        if (currentIndex < videos.length - 1) {
            const next = videos[currentIndex + 1]
            setNextEpisode({ season: next.season, number: next.number, title: next.title || '' })
        }
    }, [meta])

    // Progress saving and popup logic
    const handleTimeUpdate = useCallback((currentTime: number, dur: number) => {
        if (dur > 0) setDuration(dur)
        
        // Check for short video warning (under 5 minutes)
        if (dur > 0 && dur < SHORT_VIDEO_THRESHOLD && !shortVideoWarningDismissedRef.current && nextEpisode) {
            if (!showShortVideoWarning) {
                setShowShortVideoWarning(true)
            }
            // Update progress bar (0-100%)
            const progress = Math.min((currentTime / dur) * 100, 100)
            setShortVideoProgress(progress)
        }
        
        // Check for next episode popup (within 30 seconds of end)
        const timeRemaining = dur - currentTime
        if (dur > 0 && nextEpisode && timeRemaining <= NEXT_EPISODE_COUNTDOWN_START && timeRemaining > 0) {
            if (!showNextEpisodePopup && !countdownIntervalRef.current) {
                setShowNextEpisodePopup(true)
                setCountdown(Math.ceil(timeRemaining))
                
                // Start countdown interval
                countdownIntervalRef.current = window.setInterval(() => {
                    setCountdown(prev => {
                        if (prev <= 1) {
                            if (countdownIntervalRef.current) {
                                clearInterval(countdownIntervalRef.current)
                                countdownIntervalRef.current = null
                            }
                            return 0
                        }
                        return prev - 1
                    })
                }, 1000)
            }
        }
        
        // Save progress every 10 seconds
        if (
            meta &&
            profileId &&
            dur > 0 &&
            Math.abs(currentTime - lastSavedProgressRef.current) >= 10
        ) {
            lastSavedProgressRef.current = currentTime
            const progress = currentTime / dur

            // Don't save if near start or end
            if (progress > 0.02 && progress < 0.95) {
                apiFetch('/api/streaming/progress', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        profileId,
                        metaId: meta.id,
                        metaType: meta.type,
                        season: meta.season,
                        episode: meta.episode,
                        position: currentTime,
                        duration: dur,
                        title: meta.name,
                        poster: meta.poster
                    })
                }).catch(console.error)
            }
        }

        // Trakt scrobbling - start if not already started
        if (
            meta &&
            profileId &&
            dur > 0 &&
            !traktScrobbleStartedRef.current
        ) {
            traktScrobbleStartedRef.current = true
            const progress = (currentTime / dur) * 100
            
            // Extract IDs
            const isImdb = meta.id.startsWith('tt')
            const imdbId = isImdb ? meta.id : undefined
            const tmdbId = !isImdb ? meta.id.replace(/^tmdb:/, '') : undefined

            // Fire and forget - don't block playback
            apiFetch('/api/trakt/scrobble/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profileId,
                    metaType: meta.type,
                    imdbId,
                    tmdbId,
                    season: meta.season,
                    episode: meta.episode,
                    progress: Math.round(progress)
                })
            }).catch(() => {}) // Silently ignore errors
        }
    }, [meta, profileId, nextEpisode, showShortVideoWarning, showNextEpisodePopup])

    // Handle video ended
    const handleVideoEnded = useCallback(() => {
        // Clear countdown interval
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
            countdownIntervalRef.current = null
        }

        // Trakt scrobble stop (100% progress marks as watched)
        if (meta && profileId && traktScrobbleStartedRef.current) {
            // Extract IDs
            const isImdb = meta.id.startsWith('tt')
            const imdbId = isImdb ? meta.id : undefined
            const tmdbId = !isImdb ? meta.id.replace(/^tmdb:/, '') : undefined

            apiFetch('/api/trakt/scrobble/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profileId,
                    metaType: meta.type,
                    imdbId,
                    tmdbId,
                    season: meta.season,
                    episode: meta.episode,
                    progress: 100
                })
            }).catch(() => {})
            traktScrobbleStartedRef.current = false
        }
        
        if (nextEpisode && meta) {
            // Auto-play next episode
            navigate(`/streaming/${profileId}/${meta.type}/${meta.id}/s${nextEpisode.season}e${nextEpisode.number}`)
        }
    }, [nextEpisode, meta, profileId, navigate])

    // Handle error
  const handleError = useCallback((error: Error) => {
    console.error('Playback error:', error)
    toast.error('Playback error: ' + error.message)
  }, [])

  const handleSubtitleTrackError = useCallback((track: PlayerSubtitleTrack) => {
    const key = track.src || track.label
    const attempt = subtitleRetryMapRef.current.get(key) || 0

    if (attempt === 0) {
      subtitleRetryMapRef.current.set(key, 1)
      setSubtitleTracks((prev) => {
        const without = prev.filter((t) => t.src !== track.src)
        return [...without, { ...track, src: `${track.src}${track.src.includes('?') ? '&' : '?'}retry=1` }]
      })
      toast.warning(`Subtitle failed (${track.label}). Retrying once...`)
      return
    }

    toast.error(`Subtitle failed to load: ${track.label}`)
  }, [])

    // Handle metadata loaded
    const handleMetadataLoad = useCallback((dur: number) => {
        setDuration(dur)
        // Reset popup states on new video
        setShowNextEpisodePopup(false)
        setShowShortVideoWarning(false)
        shortVideoWarningDismissedRef.current = false
        setCountdown(NEXT_EPISODE_COUNTDOWN_START)
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
            countdownIntervalRef.current = null
        }
    }, [])

    // Navigate to episode
    const goToEpisode = useCallback((ep: EpisodeInfo) => {
        if (!meta || !stream) return

        // Find the video info
        const video = meta.videos?.find(v => v.season === ep.season && v.number === ep.number)
        if (!video) return

        // Navigate to streams page for new episode
        navigate(`/streaming/${profileId}/${meta.type}/${meta.id}/s${ep.season}e${ep.number}`)
    }, [meta, stream, profileId, navigate])

    // Overlay auto-hide
    const resetOverlayTimeout = useCallback(() => {
        setShowOverlay(true)
        if (overlayTimeoutRef.current) {
            clearTimeout(overlayTimeoutRef.current)
        }
        overlayTimeoutRef.current = window.setTimeout(() => {
            setShowOverlay(false)
        }, 3000)
    }, [])

    // Keyboard shortcuts for back
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' || e.key === 'Backspace') {
                e.preventDefault()
                navigate(-1)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [navigate])

    // Cleanup scrobble on unmount (user navigating away)
    useEffect(() => {
        return () => {
            if (meta && profileId && traktScrobbleStartedRef.current && duration > 0) {
                const progress = (lastSavedProgressRef.current / duration) * 100
                
                // Extract IDs
                const isImdb = meta.id.startsWith('tt')
                const imdbId = isImdb ? meta.id : undefined
                const tmdbId = !isImdb ? meta.id.replace(/^tmdb:/, '') : undefined

                // Use navigator.sendBeacon for reliable delivery on page unload
                const data = JSON.stringify({
                    profileId,
                    metaType: meta.type,
                    imdbId,
                    tmdbId,
                    season: meta.season,
                    episode: meta.episode,
                    progress: Math.round(progress)
                })
                navigator.sendBeacon(resolveBeaconUrl('/api/trakt/scrobble/stop'), new Blob([data], { type: 'application/json' }))
            }
            
            // Notify other components that history was updated
            window.dispatchEvent(new CustomEvent('history-updated'))
        }
    }, [meta, profileId, duration])

    // Loading state
    if (loading) {
        return (
            <Layout title="Loading..." showHeader={false} showFooter={false}>
                <SkeletonPlayer />
            </Layout>
        )
    }

    // Error state
    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-black text-red-500">
                {error}
            </div>
        )
    }

    if (!stream || !meta) return null

    const displayTitle = meta.season && meta.episode
        ? `${meta.name} S${meta.season}:E${meta.episode}`
        : meta.name

    return (
        <Layout title={`Playing: ${meta.name}`} showHeader={false} showFooter={false}>
            <div
                ref={playerWrapperRef}
                className={styles.playerWrapper}
                onMouseMove={resetOverlayTimeout}
                onTouchStart={resetOverlayTimeout}
            >
                {/* Vidstack Player */}
                <VidstackPlayer
                    src={stream.url!}
                    poster={meta.poster}
                    title={displayTitle}
                    subtitles={subtitleTracks}
                    streamUrl={stream.url}
                    onTimeUpdate={handleTimeUpdate}
                    onMetadataLoad={handleMetadataLoad}
                    onEnded={handleVideoEnded}
                    onError={handleError}
                    onSubtitleTrackError={handleSubtitleTrackError}
                    startTime={startTime}
                    autoPlay={true}
                    showCast={true}
                />

                {/* Back button overlay */}
                <div className={`${styles.backOverlay} ${showOverlay ? styles.visible : ''}`}>
                    <button
                        className={styles.backButton}
                        onClick={() => navigate(-1)}
                        aria-label="Go back"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    
                    <div className={styles.titleOverlay}>
                        <span className={styles.title}>{meta.name}</span>
                        {meta.season && meta.episode && (
                            <span className={styles.episodeBadge}>S{meta.season}:E{meta.episode}</span>
                        )}
                    </div>
                </div>

                {/* External player button overlay (top-right) */}
                {stream.url && (
                    <div className={`${styles.externalPlayerOverlay} ${showOverlay ? styles.visible : ''}`}>
                        <button
                            className={styles.externalPlayerButton}
                            onClick={() => setExternalMenuOpen(!externalMenuOpen)}
                            aria-label="Open in external player"
                        >
                            <ExternalLink size={20} />
                        </button>
                        
                        {externalMenuOpen && (
                            <div className={styles.externalPlayerMenu}>
                                {getAvailablePlayers().map(player => (
                                    <button
                                        key={player.id}
                                        className={styles.externalPlayerMenuItem}
                                        onClick={async () => {
                                            setExternalMenuOpen(false)
                                            const result = await openInPlayer(player.id as any, {
                                                url: stream.url!,
                                                title: meta.name
                                            })
                                            if (result.success) {
                                                toast.success(result.message)
                                            } else {
                                                toast.error(result.message)
                                            }
                                        }}
                                    >
                                        {player.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Episode navigation overlay */}
                {(prevEpisode || nextEpisode) && showOverlay && (
                    <div className={styles.episodeNavOverlay}>
                        {prevEpisode && (
                            <button
                                className={styles.episodeNavButton}
                                onClick={() => goToEpisode(prevEpisode)}
                            >
                                <ChevronLeft size={20} />
                                <span>Previous</span>
                            </button>
                        )}
                        {nextEpisode && (
                            <button
                                className={styles.episodeNavButton}
                                onClick={() => goToEpisode(nextEpisode)}
                            >
                                <span>Next</span>
                                <ChevronRight size={20} />
                            </button>
                        )}
                    </div>
                )}

                {/* Next Episode Popup (bottom right) - shown when near end of video */}
                {showNextEpisodePopup && nextEpisode && (
                    <div className={`${styles.nextEpisodeOverlay} ${styles.visible}`}>
                        <div className={styles.nextEpisodeTitle}>Up Next</div>
                        <div className={styles.nextEpisodeName}>
                            S{nextEpisode.season}:E{nextEpisode.number}
                            {nextEpisode.title && ` - ${nextEpisode.title}`}
                        </div>
                        <div className={styles.countdown}>
                            Playing in {countdown}s
                        </div>
                        <div className={styles.nextEpisodeActions}>
                            <button
                                className={`${styles.nextEpisodeButton} ${styles.primary}`}
                                onClick={() => {
                                    if (countdownIntervalRef.current) {
                                        clearInterval(countdownIntervalRef.current)
                                        countdownIntervalRef.current = null
                                    }
                                    goToEpisode(nextEpisode)
                                }}
                            >
                                <SkipForward size={16} style={{ marginRight: 6 }} />
                                Play Now
                            </button>
                            <button
                                className={`${styles.nextEpisodeButton} ${styles.secondary}`}
                                onClick={() => {
                                    if (countdownIntervalRef.current) {
                                        clearInterval(countdownIntervalRef.current)
                                        countdownIntervalRef.current = null
                                    }
                                    setShowNextEpisodePopup(false)
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Short Video Warning (bottom right) - shown for videos under 5 mins */}
                {showShortVideoWarning && nextEpisode && !showNextEpisodePopup && (
                    <div className={`${styles.shortVideoPrompt} ${styles.visible}`}>
                        <button
                            className={styles.shortVideoClose}
                            onClick={() => {
                                setShowShortVideoWarning(false)
                                shortVideoWarningDismissedRef.current = true
                            }}
                            aria-label="Dismiss"
                        >
                            <X size={16} />
                        </button>
                        <div className={styles.shortVideoIcon}>
                            <AlertTriangle size={18} />
                        </div>
                        <div className={styles.shortVideoContent}>
                            <div className={styles.shortVideoTitle}>Short Video</div>
                            <div className={styles.shortVideoDesc}>
                                This appears to be a short clip. Next episode will play automatically.
                            </div>
                            <div className={styles.shortVideoActions}>
                                <button
                                    className={`${styles.shortVideoButton} ${styles.primary}`}
                                    onClick={() => goToEpisode(nextEpisode)}
                                >
                                    Skip to Next Episode
                                </button>
                            </div>
                        </div>
                        <div className={styles.shortVideoProgress}>
                            <div 
                                className={styles.shortVideoProgressBar} 
                                style={{ width: `${shortVideoProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Mobile Orientation Prompt - shown on mobile in portrait mode */}
                {showOrientationPrompt && isMobile && isPortrait && (
                    <div className={styles.orientationLockOverlay}>
                        <div className={styles.orientationLockIcon}>
                            <Smartphone size={40} />
                        </div>
                        <div className={styles.orientationLockText}>
                            Rotate your device to landscape
                        </div>
                        <div className={styles.orientationLockSubtext}>
                            For the best viewing experience, use landscape mode
                        </div>
                        <button 
                            className={styles.orientationLockButton}
                            onClick={() => {
                                // Try to request fullscreen which often triggers landscape
                                if (playerWrapperRef.current) {
                                    playerWrapperRef.current.requestFullscreen?.().catch(() => {})
                                }
                                dismissOrientationPrompt()
                            }}
                        >
                            Continue in Portrait
                        </button>
                        <button 
                            className={styles.orientationLockDismiss}
                            onClick={dismissOrientationPrompt}
                        >
                            Don't show again
                        </button>
                    </div>
                )}
            </div>
        </Layout>
    )
}
