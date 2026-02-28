/**
 * ZentrioPlayer
 *
 * Fully integrated custom video player — Stremio/Nuvio inspired design.
 * All player UI (back button, title, episode nav, external player, PiP,
 * next-episode popup, find-new-stream popup) lives here.
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import {
  Play, Pause, Volume2, VolumeX, Volume1,
  Maximize, Minimize, Settings, Subtitles,
  SkipBack, SkipForward, ArrowLeft,
  ChevronLeft, ChevronRight,
  ExternalLink,
  PictureInPicture2, Cast,
  SkipForward as NextEpIcon,
  AlertTriangle, RefreshCw, X,
  Sun, Moon
} from 'lucide-react'
import { usePlayerEngine } from './hooks/usePlayerEngine'
import type { MediaSource, SubtitleTrack, AudioTrack, QualityLevel } from './engines/types'
import styles from '../../styles/ZentrioPlayer.module.css'

/* ─────────────────────── Types ─────────────────────── */

type OrientationMode = 'auto' | 'landscape' | 'portrait'

export interface EpisodeInfo {
  season: number
  number: number
  title?: string
}



interface ZentrioPlayerProps {
  src: string
  type?: string
  poster?: string
  /** Full display title (e.g. "Breaking Bad S1:E3") */
  title?: string
  /** Subtitle label only (e.g. "Pilot") */
  subtitle?: string
  subtitles?: SubtitleTrack[]
  startTime?: number
  autoPlay?: boolean

  /* Ecosystem integration */
  onBack?: () => void
  prevEpisode?: EpisodeInfo | null
  nextEpisode?: EpisodeInfo | null
  onNavigateEpisode?: (ep: EpisodeInfo) => void
  /** Seconds before end to trigger next-episode popup (default 30) */
  nextEpisodeAt?: number
  /** When < this many seconds, show "Find New Stream" popup instead of next-ep only (default 120 = 2 min) */
  shortVideoThreshold?: number
  onFindNewStream?: () => void

  onOpenExternal?: () => Promise<{ success: boolean; message: string }>

  /* Callbacks */
  onTimeUpdate?: (currentTime: number, duration: number) => void
  onEnded?: () => void
  onError?: (error: Error) => void
  onMetadataLoad?: (duration: number) => void
}

/* ─────────────────────── Helpers ─────────────────────── */

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

const isMobileDevice = () =>
  typeof window !== 'undefined' &&
  (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || ('ontouchstart' in window && window.innerWidth <= 1024))

/* ─────────────────────── Countdown Ring ─────────────────────── */

function CountdownRing({ total, current }: { total: number; current: number }) {
  const r = 18
  const circ = 2 * Math.PI * r
  const progress = total > 0 ? current / total : 0
  const dashoffset = circ * (1 - progress)
  return (
    <svg className={styles.countdownRing} viewBox="0 0 44 44" width={44} height={44}>
      <circle cx={22} cy={22} r={r} className={styles.countdownTrack} />
      <circle
        cx={22} cy={22} r={r}
        className={styles.countdownFill}
        strokeDasharray={circ}
        strokeDashoffset={dashoffset}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
      />
      <text x={22} y={22} className={styles.countdownText} textAnchor="middle" dominantBaseline="central">
        {Math.ceil(current)}
      </text>
    </svg>
  )
}

/* ─────────────────────── Main Component ─────────────────────── */

export function ZentrioPlayer({
  src,
  type,
  poster,
  title,
  subtitle,
  subtitles = [],
  startTime = 0,
  autoPlay = true,
  onBack,
  prevEpisode,
  nextEpisode,
  onNavigateEpisode,
  nextEpisodeAt = 30,
  shortVideoThreshold = 120,
  onFindNewStream,
  onOpenExternal,
  onTimeUpdate,
  onEnded,
  onError,
  onMetadataLoad,
}: ZentrioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gestureRef = useRef({ startX: 0, startY: 0, startTime: 0, lastTapTime: 0, seeking: false, voluming: false })
  const nextEpTriggeredRef = useRef(false)
  const shortVideoTriggeredRef = useRef(false)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const durationRef = useRef(0)

  /* UI state */
  const [controlsVisible, setControlsVisible] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [isFullscreen, setIsFullscreenState] = useState(false)

  /* Menu state */
  const [openMenu, setOpenMenu] = useState<'settings' | 'subtitles' | 'external' | null>(null)
  const [settingsPage, setSettingsPage] = useState<'main' | 'speed' | 'quality' | 'audio' | 'orientation'>('main')

  /* Seek / volume feedback */
  const [seekFeedback, setSeekFeedback] = useState<{ dir: 'left' | 'right'; secs: number } | null>(null)
  const [volumeOSD, setVolumeOSD] = useState<number | null>(null)
  const volumeOSDTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Orientation */
  const [orientationMode, setOrientationMode] = useState<OrientationMode>('landscape')

  /* Progress hover */
  const [hoverTime, setHoverTime] = useState<{ time: number; pct: number } | null>(null)
  const [isDraggingProgress, setIsDraggingProgress] = useState(false)
  const [dragPct, setDragPct] = useState(0)

  /* Next episode popup */
  const [showNextEp, setShowNextEp] = useState(false)
  const [nextEpCountdown, setNextEpCountdown] = useState(nextEpisodeAt)

  /* Short video / find new stream */
  const [showShortVideo, setShowShortVideo] = useState(false)
  const shortDismissedRef = useRef(false)

  /* ── Engine ── */
  const {
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
    toggleFullscreen,
    loadSource,
    addSubtitleTracks,
    getSubtitleTracks,
    setSubtitleTrack,
    getAudioTracks,
    setAudioTrack,
    getQualityLevels,
    setQualityLevel,
  } = usePlayerEngine({
    autoPlay,
    startTime,
    onTimeUpdate: (t, d) => {
      durationRef.current = d
      onTimeUpdate?.(t, d)
      handlePlaybackProgress(t, d)
    },
    onEnded,
    onError,
    onMetadataLoad: (d) => {
      durationRef.current = d
      onMetadataLoad?.(d)
      // Detect short video (< threshold)
      if (d > 0 && d < shortVideoThreshold && !shortDismissedRef.current) {
        setShowShortVideo(true)
        shortVideoTriggeredRef.current = true
      }
    }
  })

  /* ── Load source on change ── */
  useEffect(() => {
    if (src) loadSource({ src, type })
  }, [src, type]) // loadSource is stable — its only deps are startTime/autoPlay (primitives)

  /* ── Subtitles ── */
  useEffect(() => {
    if (subtitles.length > 0) addSubtitleTracks(subtitles)
  }, [subtitles, addSubtitleTracks])

  /* ── Mobile detect ── */
  useEffect(() => {
    const check = () => setIsMobile(isMobileDevice())
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  /* ── Fullscreen sync ── */
  useEffect(() => {
    const handler = () => setIsFullscreenState(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  /* ── Next episode progress logic ── */
  const handlePlaybackProgress = useCallback((t: number, d: number) => {
    if (d <= 0) return
    const remaining = d - t

    // Next episode popup
    if (nextEpisode && remaining <= nextEpisodeAt && remaining > 0 && !nextEpTriggeredRef.current) {
      nextEpTriggeredRef.current = true
      setShowNextEp(true)
      setNextEpCountdown(remaining)

      countdownRef.current = setInterval(() => {
        setNextEpCountdown(prev => {
          const next = prev - 1
          if (next <= 0) {
            clearInterval(countdownRef.current!)
            countdownRef.current = null
            onNavigateEpisode?.(nextEpisode)
          }
          return next
        })
      }, 1000)
    }
  }, [nextEpisode, nextEpisodeAt, onNavigateEpisode])

  /* Reset next episode tracking when video/episode changes */
  useEffect(() => {
    nextEpTriggeredRef.current = false
    shortVideoTriggeredRef.current = false
    shortDismissedRef.current = false
    setShowNextEp(false)
    setShowShortVideo(false)
    setNextEpCountdown(nextEpisodeAt)
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [src, nextEpisodeAt])

  /* ── Controls auto-hide ── */
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true)
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    if (!state.paused) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!openMenu) setControlsVisible(false)
      }, 3000)
    }
  }, [state.paused, openMenu])

  /* Keep controls visible when paused or menu open */
  useEffect(() => {
    if (state.paused || openMenu) {
      setControlsVisible(true)
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current)
    } else {
      resetControlsTimeout()
    }
  }, [state.paused, openMenu, resetControlsTimeout])

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlayPause(); break
        case 'ArrowLeft': e.preventDefault(); seek(Math.max(0, state.currentTime - 10)); flashSeek('left', 10); break
        case 'ArrowRight': e.preventDefault(); seek(Math.min(state.duration, state.currentTime + 10)); flashSeek('right', 10); break
        case 'ArrowUp': e.preventDefault(); setVolume(Math.min(1, state.volume + 0.1)); break
        case 'ArrowDown': e.preventDefault(); setVolume(Math.max(0, state.volume - 0.1)); break
        case 'f': e.preventDefault(); toggleFullscreen(); break
        case 'm': e.preventDefault(); setMuted(!state.muted); break
        case 'Escape': if (openMenu) setOpenMenu(null); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [togglePlayPause, seek, setVolume, setMuted, toggleFullscreen, state.currentTime, state.duration, state.volume, state.muted, openMenu])

  /* ── Seek feedback flash ── */
  const flashSeek = useCallback((dir: 'left' | 'right', secs: number) => {
    setSeekFeedback({ dir, secs })
    setTimeout(() => setSeekFeedback(null), 600)
  }, [])

  /* ── Volume OSD ── */
  const showVolumeOSD = useCallback((v: number) => {
    setVolumeOSD(Math.round(v * 100))
    if (volumeOSDTimeout.current) clearTimeout(volumeOSDTimeout.current)
    volumeOSDTimeout.current = setTimeout(() => setVolumeOSD(null), 1500)
  }, [])

  /* ── Progress bar pointer ── */
  const progressRef = useRef<HTMLDivElement>(null)

  const getPctFromEvent = (e: React.MouseEvent | React.PointerEvent | MouseEvent | PointerEvent) => {
    const bar = progressRef.current
    if (!bar) return 0
    const rect = bar.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }

  const handleProgressPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDraggingProgress(true)
    const pct = getPctFromEvent(e)
    setDragPct(pct)
  }, [])

  const handleProgressPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const pct = getPctFromEvent(e)
    setHoverTime({ time: pct * state.duration, pct })
    if (isDraggingProgress) setDragPct(pct)
  }, [state.duration, isDraggingProgress])

  const handleProgressPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingProgress) {
      const pct = getPctFromEvent(e)
      seek(pct * state.duration)
    }
    setIsDraggingProgress(false)
  }, [isDraggingProgress, seek, state.duration])

  const handleProgressLeave = useCallback(() => {
    if (!isDraggingProgress) setHoverTime(null)
  }, [isDraggingProgress])

  const displayProgress = isDraggingProgress ? dragPct : (state.duration > 0 ? state.currentTime / state.duration : 0)

  /* ── Touch gestures ── */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    gestureRef.current = { ...gestureRef.current, startX: t.clientX, startY: t.clientY, startTime: state.currentTime, seeking: false, voluming: false }
    resetControlsTimeout()
  }, [state.currentTime, resetControlsTimeout])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    const g = gestureRef.current
    const dx = t.clientX - g.startX
    const dy = t.clientY - g.startY
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    if (Math.abs(dx) > 20 && !g.voluming) {
      g.seeking = true
      const pct = dx / rect.width
      const delta = pct * Math.min(state.duration, 120)
      const newTime = Math.max(0, Math.min(state.duration, g.startTime + delta * 3))
      setHoverTime({ time: newTime, pct: newTime / state.duration })
    } else if (Math.abs(dy) > 20 && !g.seeking) {
      const touchX = t.clientX - rect.left
      if (touchX > rect.width * 0.5) {
        g.voluming = true
        const delta = -dy / rect.height
        const newVol = Math.max(0, Math.min(1, state.volume + delta))
        setVolume(newVol)
        showVolumeOSD(newVol)
        g.startY = t.clientY
      }
    }
  }, [state.duration, state.volume, setVolume, showVolumeOSD])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const g = gestureRef.current
    if (g.seeking && hoverTime) {
      seek(hoverTime.time)
      setHoverTime(null)
    }

    // Double-tap detection
    const now = Date.now()
    const diff = now - g.lastTapTime
    if (diff < 300 && diff > 50 && !g.seeking) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const x = g.startX - rect.left
        if (x < rect.width * 0.35) {
          seek(Math.max(0, state.currentTime - 10))
          flashSeek('left', 10)
        } else if (x > rect.width * 0.65) {
          seek(Math.min(state.duration, state.currentTime + 10))
          flashSeek('right', 10)
        } else {
          togglePlayPause()
        }
      }
      g.lastTapTime = 0
    } else {
      g.lastTapTime = now
    }

    g.seeking = false
    g.voluming = false
  }, [hoverTime, seek, state.currentTime, state.duration, togglePlayPause, flashSeek])

  /* ── PiP ── */
  const togglePip = useCallback(async () => {
    const vid = videoRef.current
    if (!vid) return
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture().catch(() => {})
    } else if (document.pictureInPictureEnabled) {
      await vid.requestPictureInPicture().catch(() => {})
    }
  }, [videoRef])

  /* ── External Player ── */
  const handleExternalPlayer = useCallback(async () => {
    if (onOpenExternal) {
      await onOpenExternal()
    }
  }, [onOpenExternal])

  /* ── Derived ── */
  const subtitleTracks = getSubtitleTracks()
  const audioTracks = getAudioTracks()
  const qualityLevels = getQualityLevels()
  const playbackRates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
  const bufferedPct = state.buffered && state.buffered.length > 0 && state.duration > 0
    ? (state.buffered.end(state.buffered.length - 1) / state.duration) * 100
    : 0

  /* ── Error state ── */
  if (error) {
    return (
      <div className={styles.playerContainer}>
        <div className={styles.errorOverlay}>
          <AlertTriangle className={styles.errorIcon} />
          <div className={styles.errorTitle}>Playback Error</div>
          <div className={styles.errorMessage}>{error.message}</div>
          {onBack && <button className={styles.errorBack} onClick={onBack}>Go Back</button>}
        </div>
      </div>
    )
  }

  /* ── Volume icon ── */
  const VolumeIcon = state.muted || state.volume === 0 ? VolumeX : state.volume < 0.5 ? Volume1 : Volume2

  /* ────────────────── Render ────────────────── */
  return (
    <div
      ref={containerRef}
      className={styles.playerContainer}
      onMouseMove={resetControlsTimeout}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        // Toggle play/pause on bare click (not on controls)
        if ((e.target as HTMLElement).closest('[data-controls]')) return
        if (openMenu) { setOpenMenu(null); return }
        resetControlsTimeout()
        togglePlayPause()
      }}
    >
      {/* Video */}
      <video ref={videoRef} className={styles.videoElement} playsInline poster={poster} />

      {/* Poster while loading */}
      {poster && isLoading && (
        <img src={poster} alt={title} className={styles.posterImage} />
      )}

      {/* Buffering spinner (distinct from initial load) */}
      {state.buffering && !isLoading && (
        <div className={styles.bufferingSpinner}>
          <div className={styles.bufferingRing} />
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinner} />
          <span className={styles.loadingText}>Loading...</span>
        </div>
      )}

      {/* Seek feedback ripples */}
      {seekFeedback && (
        <div className={`${styles.seekRipple} ${styles[seekFeedback.dir]}`}>
          {seekFeedback.dir === 'left' ? <SkipBack size={32} /> : <SkipForward size={32} />}
          <span>{seekFeedback.dir === 'left' ? '-' : '+'}{seekFeedback.secs}s</span>
        </div>
      )}

      {/* Volume OSD (touch gesture volume) */}
      {volumeOSD !== null && (
        <div className={styles.volumeOSD}>
          <VolumeIcon size={24} />
          <div className={styles.volumeOSDBar}>
            <div className={styles.volumeOSDFill} style={{ height: `${volumeOSD}%` }} />
          </div>
          <span className={styles.volumeOSDValue}>{volumeOSD}%</span>
        </div>
      )}

      {/* Seek time preview (touch scrub) */}
      {hoverTime && !isDraggingProgress && isMobile && (
        <div className={styles.touchSeekPreview}>
          <span className={styles.touchSeekTime}>{formatTime(hoverTime.time)}</span>
        </div>
      )}

      {/* ═══════════════ Controls Overlay ═══════════════ */}
      <div className={`${styles.controlsOverlay} ${controlsVisible ? styles.visible : ''}`} data-controls>

        {/* Gradient backgrounds */}
        <div className={styles.gradientTop} />
        <div className={styles.gradientBottom} />

        {/* ── TOP BAR ── */}
        <div className={styles.topBar}>
          <div className={styles.topLeft}>
            {onBack && (
              <button
                className={styles.iconBtn}
                onClick={(e) => { e.stopPropagation(); onBack() }}
                aria-label="Go back"
              >
                <ArrowLeft size={22} />
              </button>
            )}
            {title && (
              <div className={styles.titleInfo}>
                <span className={styles.titleMain}>{title}</span>
                {subtitle && <span className={styles.titleSub}>{subtitle}</span>}
              </div>
            )}
          </div>

          <div className={styles.topRight}>
            {/* Episode nav in top bar on desktop */}
            {!isMobile && prevEpisode && (
              <button
                className={styles.iconBtnSm}
                onClick={(e) => { e.stopPropagation(); onNavigateEpisode?.(prevEpisode) }}
                aria-label="Previous episode"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            {!isMobile && nextEpisode && (
              <button
                className={styles.iconBtnSm}
                onClick={(e) => { e.stopPropagation(); onNavigateEpisode?.(nextEpisode) }}
                aria-label="Next episode"
              >
                <ChevronRight size={20} />
              </button>
            )}

            {/* Combined external / PiP / Cast dropdown */}
            {(onOpenExternal || document.pictureInPictureEnabled) && (
              <div className={styles.menuWrap}>
                <button
                  className={`${styles.iconBtn} ${openMenu === 'external' ? styles.active : ''}`}
                  onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === 'external' ? null : 'external') }}
                  aria-label="Open in…"
                >
                  <ExternalLink size={20} />
                </button>
                {openMenu === 'external' && (
                  <div className={`${styles.dropdownPanel} ${styles.dropdownRight}`} onClick={e => e.stopPropagation()}>
                    <div className={styles.dropdownTitle}>Open In</div>
                    {onOpenExternal && (
                      <button className={styles.dropdownItem} onClick={() => { handleExternalPlayer(); setOpenMenu(null) }}>
                        <ExternalLink size={16} />
                        <span>External Player</span>
                      </button>
                    )}
                    {document.pictureInPictureEnabled && (
                      <button className={styles.dropdownItem} onClick={() => { togglePip(); setOpenMenu(null) }}>
                        <PictureInPicture2 size={16} />
                        <span>Picture in Picture</span>
                      </button>
                    )}
                    <button
                      className={styles.dropdownItem}
                      onClick={() => {
                        const vid = document.querySelector('video')
                        if (vid && (vid as any).remote) {
                          (vid as any).remote.prompt().catch(() => {})
                        }
                        setOpenMenu(null)
                      }}
                    >
                      <Cast size={16} />
                      <span>Cast</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER EPISODE NAV (mobile) ── */}
        {isMobile && (prevEpisode || nextEpisode) && (
          <div className={styles.centerEpNav}>
            {prevEpisode && (
              <button
                className={styles.epNavBtn}
                onClick={(e) => { e.stopPropagation(); onNavigateEpisode?.(prevEpisode) }}
              >
                <ChevronLeft size={20} />
                <span>Prev</span>
              </button>
            )}
            {nextEpisode && (
              <button
                className={styles.epNavBtn}
                onClick={(e) => { e.stopPropagation(); onNavigateEpisode?.(nextEpisode) }}
              >
                <span>Next</span>
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        )}

        {/* ── CENTER BIG PLAY (when paused) ── */}
        {state.paused && !state.buffering && (
          <button
            className={styles.centerPlay}
            onClick={(e) => { e.stopPropagation(); togglePlayPause() }}
            aria-label="Play"
          >
            <Play size={36} />
          </button>
        )}

        {/* ── BOTTOM CONTROLS ── */}
        <div className={styles.bottomBar}>
          {/* Progress bar */}
          <div
            ref={progressRef}
            className={`${styles.progressContainer} ${isDraggingProgress ? styles.dragging : ''}`}
            onPointerDown={handleProgressPointerDown}
            onPointerMove={handleProgressPointerMove}
            onPointerUp={handleProgressPointerUp}
            onPointerLeave={handleProgressLeave}
            onClick={e => e.stopPropagation()}
          >
            {/* Time tooltip on hover */}
            {hoverTime && !isMobile && (
              <div
                className={styles.progressTooltip}
                style={{ left: `${hoverTime.pct * 100}%` }}
              >
                {formatTime(hoverTime.time)}
              </div>
            )}
            <div className={styles.progressTrack}>
              <div className={styles.progressBuffered} style={{ width: `${bufferedPct}%` }} />
              <div className={styles.progressPlayed} style={{ width: `${displayProgress * 100}%` }} />
              <div className={styles.progressHandle} style={{ left: `${displayProgress * 100}%` }} />
            </div>
          </div>

          {/* Control row */}
          <div className={styles.controlRow} onClick={e => e.stopPropagation()}>
            {/* Left group */}
            <div className={styles.controlGroup}>
              <button className={styles.ctrlBtn} onClick={togglePlayPause} aria-label={state.paused ? 'Play' : 'Pause'}>
                {state.paused ? <Play size={22} /> : <Pause size={22} />}
              </button>
              <button className={styles.ctrlBtn} onClick={() => seek(Math.max(0, state.currentTime - 10))} aria-label="Skip back 10s">
                <SkipBack size={20} />
              </button>
              <button className={styles.ctrlBtn} onClick={() => seek(Math.min(state.duration, state.currentTime + 10))} aria-label="Skip forward 10s">
                <SkipForward size={20} />
              </button>

              {/* Volume — horizontal inline slider on desktop, mute-only on mobile */}
              <div className={styles.volumeWrap}>
                <button
                  className={styles.ctrlBtn}
                  onClick={() => setMuted(!state.muted)}
                  aria-label={state.muted ? 'Unmute' : 'Mute'}
                >
                  <VolumeIcon size={20} />
                </button>
                {!isMobile && (
                  <div
                    className={styles.volumeSliderInline}
                    style={{ '--vol': Math.round((state.muted ? 0 : state.volume) * 100) } as React.CSSProperties}
                  >
                    <input
                      type="range"
                      min={0} max={1} step={0.02}
                      value={state.muted ? 0 : state.volume}
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        setVolume(v)
                        if (state.muted && v > 0) setMuted(false)
                        if (v === 0) setMuted(true)
                      }}
                      className={styles.volumeRange}
                      aria-label="Volume"
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                )}
              </div>

              {/* Time */}
              <div className={styles.timeDisplay}>
                <span className={styles.timeCurrents}>{formatTime(state.currentTime)}</span>
                <span className={styles.timeSep}>/</span>
                <span className={styles.timeDur}>{formatTime(state.duration)}</span>
              </div>
            </div>

            {/* Right group */}
            <div className={styles.controlGroup}>
              {/* Subtitles */}
              {subtitleTracks.length > 0 && (
                <div className={styles.menuWrap}>
                  <button
                    className={`${styles.ctrlBtn} ${openMenu === 'subtitles' ? styles.active : ''}`}
                    onClick={() => setOpenMenu(openMenu === 'subtitles' ? null : 'subtitles')}
                    aria-label="Subtitles"
                  >
                    <Subtitles size={20} />
                  </button>
                  {openMenu === 'subtitles' && (
                    <div className={`${styles.dropdownPanel} ${styles.dropdownUp}`}>
                      <div className={styles.dropdownTitle}>Subtitles</div>
                      <button
                        className={`${styles.dropdownItem} ${subtitleTracks.every(t => !t.enabled) ? styles.selected : ''}`}
                        onClick={() => { setSubtitleTrack(null); setOpenMenu(null) }}
                      >
                        Off
                      </button>
                      {subtitleTracks.map(t => (
                        <button
                          key={t.id}
                          className={`${styles.dropdownItem} ${t.enabled ? styles.selected : ''}`}
                          onClick={() => { setSubtitleTrack(t.id); setOpenMenu(null) }}
                        >
                          {t.label}
                          {t.enabled && <span className={styles.check}>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Settings */}
              <div className={styles.menuWrap}>
                <button
                  className={`${styles.ctrlBtn} ${openMenu === 'settings' ? styles.active : ''}`}
                  onClick={() => { setOpenMenu(openMenu === 'settings' ? null : 'settings'); setSettingsPage('main') }}
                  aria-label="Settings"
                >
                  <Settings size={20} />
                </button>
                {openMenu === 'settings' && (
                  <div className={`${styles.dropdownPanel} ${styles.dropdownUp} ${styles.settingsPanel}`}>
                    {settingsPage === 'main' && (
                      <>
                        <div className={styles.dropdownTitle}>Settings</div>
                        <button className={styles.settingsRow} onClick={() => setSettingsPage('speed')}>
                          <span>Speed</span>
                          <span className={styles.settingsValue}>{state.playbackRate === 1 ? 'Normal' : `${state.playbackRate}x`} ›</span>
                        </button>
                        {qualityLevels.length > 0 && (
                          <button className={styles.settingsRow} onClick={() => setSettingsPage('quality')}>
                            <span>Quality</span>
                            <span className={styles.settingsValue}>{qualityLevels.find(q => q.selected)?.label || 'Auto'} ›</span>
                          </button>
                        )}
                        {audioTracks.length > 1 && (
                          <button className={styles.settingsRow} onClick={() => setSettingsPage('audio')}>
                            <span>Audio</span>
                            <span className={styles.settingsValue}>{audioTracks.find(a => a.enabled)?.label || 'Default'} ›</span>
                          </button>
                        )}
                      </>
                    )}
                    {settingsPage === 'speed' && (
                      <>
                        <button className={styles.backRow} onClick={() => setSettingsPage('main')}>‹ Speed</button>
                        {playbackRates.map(r => (
                          <button
                            key={r}
                            className={`${styles.dropdownItem} ${state.playbackRate === r ? styles.selected : ''}`}
                            onClick={() => { setPlaybackRate(r); setSettingsPage('main') }}
                          >
                            {r === 1 ? 'Normal' : `${r}×`}
                            {state.playbackRate === r && <span className={styles.check}>✓</span>}
                          </button>
                        ))}
                      </>
                    )}
                    {settingsPage === 'quality' && (
                      <>
                        <button className={styles.backRow} onClick={() => setSettingsPage('main')}>‹ Quality</button>
                        {qualityLevels.map(q => (
                          <button
                            key={q.id}
                            className={`${styles.dropdownItem} ${q.selected ? styles.selected : ''}`}
                            onClick={() => { setQualityLevel(q.id); setSettingsPage('main') }}
                          >
                            {q.label}
                            {q.selected && <span className={styles.check}>✓</span>}
                          </button>
                        ))}
                      </>
                    )}
                    {settingsPage === 'audio' && (
                      <>
                        <button className={styles.backRow} onClick={() => setSettingsPage('main')}>‹ Audio</button>
                        {audioTracks.map(a => (
                          <button
                            key={a.id}
                            className={`${styles.dropdownItem} ${a.enabled ? styles.selected : ''}`}
                            onClick={() => { setAudioTrack(a.id); setSettingsPage('main') }}
                          >
                            {a.label}
                            {a.enabled && <span className={styles.check}>✓</span>}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Fullscreen */}
              <button className={styles.ctrlBtn} onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════ NEXT EPISODE POPUP ═════════════ */}
      {showNextEp && nextEpisode && (
        <div className={`${styles.nextEpCard} ${styles.slideIn}`}>
          <div className={styles.nextEpHeader}>Up Next</div>
          <div className={styles.nextEpTitle}>
            S{nextEpisode.season}:E{nextEpisode.number}
            {nextEpisode.title && ` — ${nextEpisode.title}`}
          </div>
          <div className={styles.nextEpActions}>
            <button
              className={styles.nextEpPlay}
              onClick={() => {
                if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
                setShowNextEp(false)
                onNavigateEpisode?.(nextEpisode)
              }}
            >
              <NextEpIcon size={16} />
              Play Now
            </button>
            <CountdownRing total={nextEpisodeAt} current={nextEpCountdown} />
            <button
              className={styles.nextEpCancel}
              onClick={() => {
                if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
                setShowNextEp(false)
                nextEpTriggeredRef.current = false
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ═════════════ SHORT VIDEO / FIND NEW STREAM ═════════════ */}
      {showShortVideo && (
        <div className={`${styles.shortVideoCard} ${styles.slideIn}`}>
          <button
            className={styles.shortVideoClose}
            onClick={() => { setShowShortVideo(false); shortDismissedRef.current = true }}
          >
            <X size={14} />
          </button>
          <div className={styles.shortVideoIcon}>
            <AlertTriangle size={18} />
          </div>
          <div className={styles.shortVideoContent}>
            <div className={styles.shortVideoTitle}>Short Video</div>
            <div className={styles.shortVideoDesc}>
              This stream appears to be less than {Math.round(shortVideoThreshold / 60)} minutes.
              {nextEpisode ? ' This may not be the full video.' : ' Try a different source.'}
            </div>
            <div className={styles.shortVideoActions}>
              {onFindNewStream && (
                <button className={styles.shortVideoBtn} onClick={() => { setShowShortVideo(false); onFindNewStream() }}>
                  <RefreshCw size={14} />
                  Find New Stream
                </button>
              )}
              {nextEpisode && (
                <button
                  className={`${styles.shortVideoBtn} ${styles.secondary}`}
                  onClick={() => { setShowShortVideo(false); onNavigateEpisode?.(nextEpisode) }}
                >
                  <ChevronRight size={14} />
                  Skip to Next Episode
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ZentrioPlayer
