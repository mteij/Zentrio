/**
 * StreamingPlayer - Video player page using Vidstack
 * 
 * This page handles:
 * - URL/state parsing for stream and meta info
 * - Progress saving
 * - Subtitle loading from addons
 * - Episode navigation
 * - Back button overlay
 * 
 * Video playback is handled by VidstackPlayer component.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, X, AlertTriangle, SkipForward } from 'lucide-react'
import { Layout, SkeletonPlayer } from '../../components'
import { VidstackPlayer } from '../../components/player/VidstackPlayer'
import { Stream } from '../../services/addons/types'
import { toast } from 'sonner'
import { useExternalPlayer } from '../../hooks/useExternalPlayer'
import styles from '../../styles/Player.module.css'
import { apiFetch } from '../../lib/apiFetch'

// Threshold for "short video" warning (videos under 5 minutes)
const SHORT_VIDEO_THRESHOLD = 300 // 5 minutes in seconds
// Time before end to show next episode popup
const NEXT_EPISODE_COUNTDOWN_START = 30 // seconds before end

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

export const StreamingPlayer = () => {
    const { profileId } = useParams<{ profileId: string }>()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const location = useLocation()
    const playerWrapperRef = useRef<HTMLDivElement | null>(null)

    // External player hook
    const { openInPlayer, getAvailablePlayers } = useExternalPlayer()
    const [externalMenuOpen, setExternalMenuOpen] = useState(false)

    // Parsed data from URL
    const [stream, setStream] = useState<Stream | null>(null)
    const [meta, setMeta] = useState<MetaInfo | null>(null)
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
    const lastScrobbleProgressRef = useRef(0)

    // Parse URL params or location state
    useEffect(() => {
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
                    const streamParam = searchParams.get('stream')
                    const metaParam = searchParams.get('meta')

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
                const tracks: typeof subtitleTracks = []
                console.log('[Player] === Starting subtitle loading ===')
                console.log('[Player] Content ID:', parsedMeta.id)
                console.log('[Player] Content Type:', parsedMeta.type)
                console.log('[Player] Profile ID:', profileId)
                console.log('[Player] Stream subtitles:', parsedStream.subtitles)
                
                if (parsedStream.subtitles && Array.isArray(parsedStream.subtitles)) {
                    console.log('[Player] Processing inline subtitles, count:', parsedStream.subtitles.length)
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
                } else {
                    console.log('[Player] No inline subtitles found')
                }
                console.log('[Player] Inline subtitles loaded:', tracks.length)

                // Fetch subtitles from addon services
                try {
                    const contentId = parsedMeta.id
                    const contentType = parsedMeta.type
                    const videoHash = parsedStream?.behaviorHints?.videoHash
                    const hashParam = videoHash ? `&videoHash=${videoHash}` : ''
                    const subtitleUrl = `/api/streaming/subtitles/${contentType}/${contentId}?profileId=${profileId}${hashParam}`
                    console.log('[Player] Fetching subtitles from:', subtitleUrl)
                    const res = await apiFetch(subtitleUrl)
                    console.log('[Player] Subtitle API response status:', res.status)
                    if (res.ok) {
                        const data = await res.json()
                        console.log('[Player] Subtitle API response data:', data)
                        if (data.subtitles && Array.isArray(data.subtitles)) {
                            console.log('[Player] Adding', data.subtitles.length, 'subtitles from API')
                            data.subtitles.forEach((sub: { url: string; lang: string; addonName?: string; type?: string; format?: string }) => {
                                tracks.push({
                                    src: sub.url,
                                    label: sub.addonName ? `${sub.lang} (${sub.addonName})` : sub.lang,
                                    language: sub.lang || 'und',
                                    type: sub.type || sub.format, // Use type or format as type
                                    addonName: sub.addonName
                                })
                            })
                        } else {
                            console.log('[Player] API response has no subtitles array')
                        }
                    } else {
                        console.warn('[Player] Subtitle API returned non-OK status:', res.status)
                    }
                } catch (e) {
                    console.warn('[Player] Failed to fetch addon subtitles', e)
                }

                console.log('[Player] Total subtitle tracks loaded:', tracks.length)
                console.log('[Player] Final subtitle tracks:', tracks)
                console.log('[Player] === Finished subtitle loading ===')
                
                if (tracks.length === 0) {
                    console.warn('[Player] ⚠️ No subtitles available')
                    console.warn('[Player] Reason: No addon provides subtitle resources for this content.')
                    console.warn('[Player] Solution: Install a subtitle addon like OpenSubtitles:')
                    console.warn('[Player]   1. Go to Settings > Addons')
                    console.warn('[Player]   2. Add: https://github.com/openSubtitles/stremio-addon/manifest.json')
                    console.warn('[Player]   3. Enable the subtitle addon')
                    console.warn('[Player] Most torrent/debrid addons do NOT provide subtitles.')
                }
                
                setSubtitleTracks(tracks)
            } catch (e) {
                console.error('Failed to initialize player', e)
                setError('Invalid player parameters')
            } finally {
                setLoading(false)
            }
        }

        initPlayer()
    }, [searchParams.toString(), profileId, location.state])

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
            
            // Fire and forget - don't block playback
            apiFetch('/api/trakt/scrobble/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profileId,
                    metaType: meta.type,
                    imdbId: meta.id.startsWith('tt') ? meta.id : undefined,
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
            apiFetch('/api/trakt/scrobble/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profileId,
                    metaType: meta.type,
                    imdbId: meta.id.startsWith('tt') ? meta.id : undefined,
                    season: meta.season,
                    episode: meta.episode,
                    progress: 100
                })
            }).catch(() => {})
            traktScrobbleStartedRef.current = false
        }
        
        if (nextEpisode) {
            // Auto-play next episode
            goToEpisode(nextEpisode)
        }
    }, [nextEpisode, meta, profileId])

    // Handle error
    const handleError = useCallback((error: Error) => {
        console.error('Playback error:', error)
        toast.error('Playback error: ' + error.message)
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
                // Use navigator.sendBeacon for reliable delivery on page unload
                const data = JSON.stringify({
                    profileId,
                    metaType: meta.type,
                    imdbId: meta.id.startsWith('tt') ? meta.id : undefined,
                    season: meta.season,
                    episode: meta.episode,
                    progress: Math.round(progress)
                })
                navigator.sendBeacon('/api/trakt/scrobble/stop', new Blob([data], { type: 'application/json' }))
            }
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
            </div>
        </Layout>
    )
}