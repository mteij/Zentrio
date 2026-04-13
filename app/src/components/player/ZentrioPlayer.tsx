/**
 * ZentrioPlayer
 *
 * Fully integrated custom video player — Stremio/Nuvio inspired design.
 * All player UI (back button, title, episode nav, external player, PiP,
 * next-episode popup, find-new-stream popup) lives here.
 */

import {
    AlertTriangle,
    Cast,
    Check,
    ChevronLeft, ChevronRight,
    Crosshair,
    ExternalLink,
    Flag,
    Loader2,
    Maximize, Minimize,
    SkipForward as NextEpIcon,
    Pause,
    PictureInPicture2,
    Play,
    RefreshCw,
    RotateCcw, RotateCw,
    Settings, Subtitles,
    Volume1,
    Volume2, VolumeX,
    X
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getAppTarget } from '../../lib/app-target'
import { hapticScrubTick } from '../../lib/haptics'
import { setTauriPlayerMode } from '../../lib/tauri-player-mode'
import styles from '../../styles/ZentrioPlayer.module.css'
import type { SubtitleTrack } from './engines/types'
import { usePlayerEngine } from './hooks/usePlayerEngine'

/* ─────────────────────── Types ─────────────────────── */

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

  /** IntroDB segments for skip intro/recap/outro */
  segments?: { type: string; start: number; end: number; confidence?: number; submissionCount?: number }[]
  /** Whether to show skip buttons (from streaming settings, default true) */
  skipIntrosOutros?: boolean
  /** Whether to show segments with low confidence/few votes (marked as Unconfirmed) */
  showUnvalidatedSegments?: boolean
  /** Whether the user has an IntroDB API key — shows the contribute button */
  canContributeSegments?: boolean
  /** Called when user submits a new segment via the contribute panel */
  onSubmitSegment?: (type: string, startSec: number, endSec: number) => Promise<{ ok: boolean; error?: string }>

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

/** Check if running in Tauri mobile context */
const isTauriMobile = () => {
  const target = getAppTarget()
  return target.isTauri && (target.isMobile || target.isTv)
}

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
  segments = [],
  skipIntrosOutros = true,
  showUnvalidatedSegments = true,
  canContributeSegments = false,
  onSubmitSegment,
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
  const appTarget = getAppTarget()

  /* UI state */
  const [controlsVisible, setControlsVisible] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [isFullscreen, setIsFullscreenState] = useState(false)

  /* Menu state */
  const [openMenu, setOpenMenu] = useState<'settings' | 'subtitles' | 'external' | null>(null)
  const [settingsPage, setSettingsPage] = useState<'main' | 'speed' | 'quality' | 'audio'>('main')
  const [selectedSubtitleLang, setSelectedSubtitleLang] = useState<string | null>(null)

  /* Seek / volume feedback */
  const [seekFeedback, setSeekFeedback] = useState<{ dir: 'left' | 'right'; secs: number } | null>(null)
  const [volumeOSD, setVolumeOSD] = useState<number | null>(null)
  const volumeOSDTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Progress hover */
  const [hoverTime, setHoverTime] = useState<{ time: number; pct: number } | null>(null)
  const [isDraggingProgress, setIsDraggingProgress] = useState(false)
  const [dragPct, setDragPct] = useState(0)
  const dragMinuteRef = useRef(-1)

  /* Next episode popup */
  const [showNextEp, setShowNextEp] = useState(false)
  const [nextEpCountdown, setNextEpCountdown] = useState(nextEpisodeAt)

  /* Short video / find new stream */
  const [showShortVideo, setShowShortVideo] = useState(false)
  const shortDismissedRef = useRef(false)

  /* Skip segment (IntroDB) */
  const [activeSegment, setActiveSegment] = useState<{ type: string; start: number; end: number; validated: boolean } | null>(null)
  const dismissedSegmentsRef = useRef<Set<number>>(new Set()) // dismissed by start time
  const CONFIDENCE_THRESHOLD = 0.5

  /* Contribute panel (IntroDB submission) */
  const [showContribute, setShowContribute] = useState(false)
  const [contributeType, setContributeType] = useState<'intro' | 'recap' | 'outro'>('intro')
  const [contributeStart, setContributeStart] = useState(0)
  const [contributeEnd, setContributeEnd] = useState(0)
  const [contributeSubmitting, setContributeSubmitting] = useState(false)
  const [contributeResult, setContributeResult] = useState<'success' | 'error' | null>(null)

  /* ── Engine ── */
  const {
    videoRef,
    state,
    isLoading,
    error,
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
    activeEngineType,
  } = usePlayerEngine({
    autoPlay,
    startTime,
    onTimeUpdate: (t, d) => {
      durationRef.current = d
      onTimeUpdate?.(t, d)
      handlePlaybackProgress(t, d)
    },
    onEnded,
    onClose: (reason) => {
      if (reason === 'back') {
        onBack?.()
      }
    },
    onError,
    onMetadataLoad: (d) => {
      durationRef.current = d
      onMetadataLoad?.(d)
      if (d > 0 && d < shortVideoThreshold && !shortDismissedRef.current) {
        setShowShortVideo(true)
        shortVideoTriggeredRef.current = true
      }
    }
  })

  /* ── Load source on change ── */
  useEffect(() => {
    if (src) loadSource({ src, type })
  }, [loadSource, src, type])

  /* ── Subtitles ── */
  useEffect(() => {
    if (subtitles.length > 0) addSubtitleTracks(subtitles)
  }, [subtitles, addSubtitleTracks])

  /* ── Mobile detect ── */
  useEffect(() => {
    const check = () => {
      const target = getAppTarget()
      setIsMobile(target.isMobile)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  /* ── Orientation Lock ── */
  // Mobile video always uses landscape. On Tauri/Android, ExoPlayerPlugin already
  // enforces this in Kotlin when play() starts. The JS call here covers iOS and PWA.
  useEffect(() => {
    if (!isMobile) return

    const applyOrientation = async () => {
      if (isTauriMobile()) {
        // Kotlin already locked landscape in ExoPlayerPlugin.play(); this call keeps
        // iOS (TauriPlayerEngine) consistent with the same landscape contract.
        await setTauriPlayerMode(true, 'landscape')
        return
      }
      try {
        const so = screen.orientation as any
        await so?.lock?.('landscape')
      } catch (_e) {
        // Silently ignore - lock() requires fullscreen and user gesture on web
      }
    }

    applyOrientation()

    return () => {
      if (isTauriMobile()) return
      try {
        const so = screen.orientation as any
        so?.unlock?.()
      } catch (_e) {
        // Silently ignore
      }
    }
  }, [isMobile])

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

    // Segment detection (IntroDB skip intro/recap/outro)
    if (skipIntrosOutros && segments.length > 0) {
      const hit = segments.find(s => {
        if (t < s.start || t >= s.end) return false
        if (dismissedSegmentsRef.current.has(s.start)) return false
        const isValidated = (s.confidence ?? 1) >= CONFIDENCE_THRESHOLD
        if (!isValidated && !showUnvalidatedSegments) return false
        return true
      })
      setActiveSegment(hit ? { ...hit, validated: (hit.confidence ?? 1) >= CONFIDENCE_THRESHOLD } : null)
    }
  }, [nextEpisode, nextEpisodeAt, onNavigateEpisode, skipIntrosOutros, showUnvalidatedSegments, segments])

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
    dismissedSegmentsRef.current = new Set()
    setActiveSegment(null)
    setShowContribute(false)
    setContributeResult(null)
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
    // TV uses D-pad controls in Player.tv.tsx, not keyboard shortcuts
    if (appTarget.primaryInput === 'remote') return

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlayPause(); break
        case 'ArrowLeft':
          e.preventDefault()
          seek(Math.max(0, state.currentTime - 10))
          setSeekFeedback({ dir: 'left', secs: 10 })
          setTimeout(() => setSeekFeedback(null), 600)
          break
        case 'ArrowRight':
          e.preventDefault()
          seek(Math.min(state.duration, state.currentTime + 10))
          setSeekFeedback({ dir: 'right', secs: 10 })
          setTimeout(() => setSeekFeedback(null), 600)
          break
        case 'ArrowUp': e.preventDefault(); setVolume(Math.min(1, state.volume + 0.1)); break
        case 'ArrowDown': e.preventDefault(); setVolume(Math.max(0, state.volume - 0.1)); break
        case 'f': e.preventDefault(); toggleFullscreen(); break
        case 'm': e.preventDefault(); setMuted(!state.muted); break
        case 'Escape': if (openMenu) setOpenMenu(null); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [appTarget.primaryInput, togglePlayPause, seek, setVolume, setMuted, toggleFullscreen, state.currentTime, state.duration, state.volume, state.muted, openMenu])

  /* ── Menu click-outside (desktop + mobile) ── */
  useEffect(() => {
    if (!openMenu) return
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-menu]')) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openMenu])

  /* ── Seek feedback flash ── */
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
    dragMinuteRef.current = Math.floor(pct * state.duration / 60)
  }, [state.duration])

  const handleProgressPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const pct = getPctFromEvent(e)
    setHoverTime({ time: pct * state.duration, pct })
    if (isDraggingProgress) {
      setDragPct(pct)
      const minute = Math.floor(pct * state.duration / 60)
      if (minute !== dragMinuteRef.current) {
        dragMinuteRef.current = minute
        hapticScrubTick()
      }
    }
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
    if (appTarget.primaryInput !== 'touch') return
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    gestureRef.current = { ...gestureRef.current, startX: t.clientX, startY: t.clientY, startTime: state.currentTime, seeking: false, voluming: false }
    resetControlsTimeout()
  }, [appTarget.primaryInput, state.currentTime, resetControlsTimeout])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (appTarget.primaryInput !== 'touch') return
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
  }, [appTarget.primaryInput, state.duration, state.volume, setVolume, showVolumeOSD])

  const handleTouchEnd = useCallback((_e: React.TouchEvent) => {
    if (appTarget.primaryInput !== 'touch') return
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
          setSeekFeedback({ dir: 'left', secs: 10 })
          setTimeout(() => setSeekFeedback(null), 600)
        } else if (x > rect.width * 0.65) {
          seek(Math.min(state.duration, state.currentTime + 10))
          setSeekFeedback({ dir: 'right', secs: 10 })
          setTimeout(() => setSeekFeedback(null), 600)
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
  }, [appTarget.primaryInput, hoverTime, seek, state.currentTime, state.duration, togglePlayPause])

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
      className={`${styles.playerContainer} ${activeEngineType === 'android-native' ? styles.playerTransparent : ''}`}
      onMouseMove={resetControlsTimeout}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        // Clicks on the control bars are blocked by data-controls on topBar/bottomBar
        if ((e.target as HTMLElement).closest('[data-controls]')) return
        resetControlsTimeout()
        // Desktop only — mobile uses touch gestures (double-tap) for play/pause
        if (!isMobile) togglePlayPause()
      }}
    >
      {/* Video */}
      <video
        ref={videoRef}
        className={`${styles.videoElement} ${activeEngineType === 'android-native' ? styles.videoHidden : ''}`}
        playsInline
        poster={poster}
      />

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
          {seekFeedback.dir === 'left' ? (
             <span className={styles.skipIconWrap}>
               <RotateCcw size={32} />
               <span className={styles.skipIconText} style={{ fontSize: '11px' }}>10</span>
             </span>
          ) : (
             <span className={styles.skipIconWrap}>
               <RotateCw size={32} />
               <span className={styles.skipIconText} style={{ fontSize: '11px' }}>10</span>
             </span>
          )}
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
      <div className={`${styles.controlsOverlay} ${controlsVisible ? styles.visible : ''}`}>

        {/* Gradient backgrounds */}
        <div className={styles.gradientTop} />
        <div className={styles.gradientBottom} />

        {/* ── TOP BAR ── */}
        <div className={styles.topBar} data-controls>
          <div className={styles.topLeft}>
            {onBack && (
              <button
                className={styles.iconBtn}
                onClick={(e) => { e.stopPropagation(); onBack() }}
                aria-label="Go back"
              >
                <ChevronLeft size={22} />
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
              <div className={styles.menuWrap} data-menu>
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
        <div className={styles.bottomBar} data-controls>
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
              {/* Hide skip buttons on mobile */}
              {!isMobile && (
                <>
                  <button className={styles.ctrlBtn} onClick={() => seek(Math.max(0, state.currentTime - 10))} aria-label="Skip back 10s">
                    <span className={styles.skipIconWrap}>
                      <RotateCcw size={20} />
                      <span className={styles.skipIconText}>10</span>
                    </span>
                  </button>
                  <button className={styles.ctrlBtn} onClick={() => seek(Math.min(state.duration, state.currentTime + 10))} aria-label="Skip forward 10s">
                    <span className={styles.skipIconWrap}>
                      <RotateCw size={20} />
                      <span className={styles.skipIconText}>10</span>
                    </span>
                  </button>
                </>
              )}

              {/* Volume — horizontal inline slider on desktop (hidden entirely on mobile) */}
              {!isMobile && (
                <div className={styles.volumeWrap}>
                  <button
                    className={styles.ctrlBtn}
                    onClick={() => setMuted(!state.muted)}
                    aria-label={state.muted ? 'Unmute' : 'Mute'}
                  >
                    <VolumeIcon size={20} />
                  </button>
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
                </div>
              )}

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
                <div className={styles.menuWrap} data-menu>
                  <button
                    className={`${styles.ctrlBtn} ${openMenu === 'subtitles' ? styles.active : ''}`}
                    onClick={() => {
                      if (openMenu !== 'subtitles') {
                        // Initialize selected language when opening
                        const tracksWithLang = subtitleTracks.filter(t => t.language)
                        const activeTrack = subtitleTracks.find(t => t.enabled)
                        if (activeTrack && activeTrack.language) {
                          setSelectedSubtitleLang(activeTrack.language)
                        } else if (tracksWithLang.length > 0) {
                          setSelectedSubtitleLang(tracksWithLang[0].language)
                        } else {
                          setSelectedSubtitleLang('Unknown')
                        }
                        setOpenMenu('subtitles')
                      } else {
                        setOpenMenu(null)
                      }
                    }}
                    aria-label="Subtitles"
                  >
                    <Subtitles size={20} />
                  </button>
                  {openMenu === 'subtitles' && (
                    <div className={`${styles.dropdownPanel} ${styles.dropdownUp} ${styles.subtitlesPanel}`}>
                      
                      {/* Left Column: Languages */}
                      <div className={styles.subtitlesLeftCol}>
                        <div className={styles.dropdownTitle}>Subtitles</div>
                        <button
                          className={`${styles.dropdownItem} ${styles.subtitlesOffBtn} ${subtitleTracks.every(t => !t.enabled) ? styles.selected : ''}`}
                          onClick={() => { setSubtitleTrack(null); setOpenMenu(null) }}
                        >
                          Off
                        </button>
                        
                        <div className={styles.subtitlesLangList}>
                          {Object.keys(
                            subtitleTracks.reduce((acc, t) => {
                              const lang = t.language || 'Unknown'
                              if (!acc[lang]) acc[lang] = []
                              acc[lang].push(t)
                              return acc
                            }, {} as Record<string, SubtitleTrack[]>)
                          )
                          .sort((a, b) => a.localeCompare(b))
                          .map(lang => (
                            <button
                              key={lang}
                              className={`${styles.dropdownItem} ${styles.subtitlesLangBtn} ${selectedSubtitleLang === lang ? styles.activeLang : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedSubtitleLang(lang)
                              }}
                            >
                              {lang}
                              <ChevronRight size={14} className={styles.langChevron} />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Right Column: Tracks for selected language */}
                      <div className={styles.subtitlesRightCol}>
                        <div className={styles.subtitleGroupTitle}>{selectedSubtitleLang || 'Tracks'}</div>
                        <div className={styles.subtitlesTrackList}>
                          {subtitleTracks
                            .filter(t => (t.language || 'Unknown') === selectedSubtitleLang)
                            .map(t => (
                              <button
                                key={t.id}
                                className={`${styles.dropdownItem} ${styles.subtitleGroupItem} ${t.enabled ? styles.selected : ''}`}
                                onClick={() => { setSubtitleTrack(t.id); setOpenMenu(null) }}
                              >
                                <span className={styles.subtitleLabel} title={t.label}>{t.label}</span>
                                {t.enabled && <span className={styles.check}>✓</span>}
                              </button>
                            ))}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              )}

              {/* Settings */}
              <div className={styles.menuWrap} data-menu>
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

              {/* IntroDB contribute button */}
              {canContributeSegments && (
                <button
                  className={`${styles.ctrlBtn} ${showContribute ? styles.active : ''}`}
                  onClick={() => {
                    setShowContribute(v => !v)
                    if (!showContribute) {
                      setContributeStart(state.currentTime)
                      setContributeEnd(Math.min(state.duration, state.currentTime + 30))
                      setContributeResult(null)
                    }
                  }}
                  aria-label="Report segment"
                  title="Contribute to IntroDB"
                >
                  <Flag size={18} />
                </button>
              )}

              {/* Fullscreen (hidden on mobile) */}
              {!isMobile && (
                <button className={styles.ctrlBtn} onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
                  {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════ SKIP SEGMENT BUTTON (IntroDB) ═════════════ */}
      {activeSegment && skipIntrosOutros && (
        <div className={`${styles.skipSegmentWrap} ${controlsVisible ? styles.skipSegmentWithControls : ''}`} data-controls>
          <button
            className={`${styles.skipSegmentBtn} ${!activeSegment.validated ? styles.skipSegmentUnconfirmed : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              seek(activeSegment.end)
              dismissedSegmentsRef.current.add(activeSegment.start)
              setActiveSegment(null)
            }}
          >
            Skip {activeSegment.type === 'intro' ? 'Intro' : activeSegment.type === 'recap' ? 'Recap' : 'Outro'}
            {!activeSegment.validated && <span className={styles.skipSegmentBadge}>Unconfirmed</span>}
          </button>
          <button
            className={styles.skipSegmentDismiss}
            onClick={(e) => {
              e.stopPropagation()
              dismissedSegmentsRef.current.add(activeSegment.start)
              setActiveSegment(null)
            }}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ═════════════ INTRODB CONTRIBUTE PANEL ═════════════ */}
      {showContribute && canContributeSegments && (
        <div className={`${styles.contributePanel} ${styles.slideIn}`} data-controls onClick={e => e.stopPropagation()}>
          <div className={styles.contributePanelHeader}>
            <span className={styles.contributePanelTitle}>
              <Flag size={14} />
              Report Segment
            </span>
            <button className={styles.nextEpCancel} onClick={() => setShowContribute(false)}>
              <X size={14} />
            </button>
          </div>

          {/* Segment type */}
          <div className={styles.contributeTypeRow}>
            {(['intro', 'recap', 'outro'] as const).map(t => (
              <button
                key={t}
                className={`${styles.contributeTypeBtn} ${contributeType === t ? styles.contributeTypeActive : ''}`}
                onClick={() => setContributeType(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Time setters */}
          <div className={styles.contributeTimeRow}>
            <div className={styles.contributeTimeField}>
              <span className={styles.contributeTimeLabel}>Start</span>
              <span className={styles.contributeTimeValue}>{formatTime(contributeStart)}</span>
              <button
                className={styles.contributeCapture}
                onClick={() => setContributeStart(state.currentTime)}
                title="Set to current time"
              >
                <Crosshair size={13} />
              </button>
            </div>
            <div className={styles.contributeTimeField}>
              <span className={styles.contributeTimeLabel}>End</span>
              <span className={styles.contributeTimeValue}>{formatTime(contributeEnd)}</span>
              <button
                className={styles.contributeCapture}
                onClick={() => setContributeEnd(state.currentTime)}
                title="Set to current time"
              >
                <Crosshair size={13} />
              </button>
            </div>
          </div>

          {/* Submit */}
          {contributeResult === 'success' ? (
            <div className={styles.contributeSuccess}>
              <Check size={15} /> Submitted — thanks for contributing!
            </div>
          ) : (
            <button
              className={styles.contributeSubmitBtn}
              disabled={contributeSubmitting || contributeStart >= contributeEnd}
              onClick={async () => {
                setContributeSubmitting(true)
                setContributeResult(null)
                const result = await onSubmitSegment?.(contributeType, contributeStart, contributeEnd)
                setContributeSubmitting(false)
                if (result?.ok) {
                  setContributeResult('success')
                } else {
                  setContributeResult('error')
                }
              }}
            >
              {contributeSubmitting
                ? <><Loader2 size={14} className={styles.spin} /> Submitting…</>
                : contributeResult === 'error'
                  ? 'Failed — try again'
                  : 'Submit to IntroDB'}
            </button>
          )}
        </div>
      )}

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
