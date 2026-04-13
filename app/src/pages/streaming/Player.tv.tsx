/**
 * StreamingPlayerTvView — D-pad-first TV player
 *
 * Full-screen player for Android TV / CwGTV.
 * All interactions are remote-control-driven; no touch or mouse zones.
 * Business logic (progress, Trakt, launcher sync) mirrors Player.standard.tsx.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { ArrowLeft, ChevronRight, Pause, Play, SkipBack, SkipForward, Subtitles, Volume2 } from 'lucide-react'
import { TvFocusItem, TvFocusProvider, TvFocusScope, TvFocusZone } from '../../components/tv'
import { apiFetch } from '../../lib/apiFetch'
import { getAppTarget } from '../../lib/app-target'
import { queueProgress } from '../../lib/offline-progress-queue'
import { setTauriPlayerMode } from '../../lib/tauri-player-mode'
import { removeContinueWatchingLauncher, syncContinueWatchingLauncher } from '../../lib/tv-launcher'
import { resolveBeaconUrl } from '../../lib/url'
import { usePlayerEngine } from '../../components/player/hooks/usePlayerEngine'
import type { SubtitleTrack, AudioTrack } from '../../components/player/engines/types'
import type { PlayerScreenModel } from './Player.model'
import styles from './Player.tv.module.css'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('PlayerTv')

/* ─── Constants ─── */
const CONTROLS_HIDE_DELAY = 4000
const NEXT_EP_TRIGGER_SECONDS = 30
const NEXT_EP_COUNTDOWN_SECONDS = 10
const LAUNCHER_SYNC_INTERVAL = 30
const SEEK_STEP = 30

/* ─── Types ─── */
interface MetaInfo {
  id: string
  type: string
  name: string
  poster?: string
  season?: number
  episode?: number
  videos?: { season: number; number: number; id: string; title?: string }[]
}

interface StreamInfo {
  url?: string
  subtitles?: { url: string; lang?: string }[]
}

interface EpisodeRef {
  season: number
  number: number
  id: string
  title?: string
}

/* ─── Helpers ─── */
function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${m}:${String(sec).padStart(2, '0')}`
}

function buildLauncherDescription(meta: MetaInfo): string | undefined {
  if (meta.season !== undefined && meta.episode !== undefined) {
    const episodeTitle = meta.videos?.find(
      (v) => v.season === meta.season && v.number === meta.episode,
    )?.title
    return episodeTitle
      ? `S${meta.season}:E${meta.episode} - ${episodeTitle}`
      : `S${meta.season}:E${meta.episode}`
  }
  return undefined
}

/* ─── Component ─── */

export function StreamingPlayerTvView(_props: { model: PlayerScreenModel }) {
  const { profileId } = useParams<{ profileId: string }>()
  const [searchParams] = useSearchParams()
  const searchParamsKey = searchParams.toString()
  const navigate = useNavigate()
  const location = useLocation()

  /* ── Data state ── */
  const [stream, setStream] = useState<StreamInfo | null>(null)
  const [meta, setMeta] = useState<MetaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [nextEpisode, setNextEpisode] = useState<EpisodeRef | null>(null)

  /**
   * startTimeRef holds the resume position fetched from the API.
   * It is written once during init (before loadSource is called) so
   * usePlayerEngine's loadSource closure always sees the correct value.
   */
  const startTimeRef = useRef(0)

  /* ── Player engine ── */
  const lastSavedRef = useRef(0)
  const lastLauncherSyncRef = useRef(0)
  const traktStartedRef = useRef(false)
  const durationRef = useRef(0)

  const handleTimeUpdate = useCallback(
    (t: number, d: number) => {
      if (d > 0) durationRef.current = d

      if (meta && profileId && d > 0 && Math.abs(t - lastSavedRef.current) >= 10) {
        lastSavedRef.current = t
        const pct = t / d
        if (pct > 0.02 && pct < 0.95) {
          const progressPayload = {
            profileId,
            metaId: meta.id,
            metaType: meta.type,
            season: meta.season,
            episode: meta.episode,
            position: t,
            duration: d,
            title: meta.name,
            poster: meta.poster,
          }
          apiFetch('/api/streaming/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(progressPayload),
          }).catch((e: unknown) => {
            log.error('Progress save failed', e)
            if (getAppTarget().isTauri) {
              queueProgress(progressPayload)
            }
          })
        }
      }

      if (meta && profileId && d > 0) {
        const pct = t / d
        const isEligible = pct >= 0.05 && pct < 0.95 && t >= 60
        const sinceLast = Math.abs(t - lastLauncherSyncRef.current)
        if (isEligible && sinceLast >= LAUNCHER_SYNC_INTERVAL) {
          lastLauncherSyncRef.current = t
          void syncContinueWatchingLauncher({
            profileId,
            metaId: meta.id,
            metaType: meta.type,
            title: meta.name,
            description: buildLauncherDescription(meta),
            posterUrl: meta.poster,
            season: meta.season,
            episode: meta.episode,
            playbackPositionSeconds: t,
            durationSeconds: d,
          })
        }
      }

      if (meta && profileId && d > 0 && !traktStartedRef.current) {
        traktStartedRef.current = true
        const isImdb = meta.id.startsWith('tt')
        apiFetch('/api/trakt/scrobble/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId,
            metaType: meta.type,
            imdbId: isImdb ? meta.id : undefined,
            tmdbId: !isImdb ? meta.id.replace(/^tmdb:/, '') : undefined,
            season: meta.season,
            episode: meta.episode,
            progress: Math.round((t / d) * 100),
          }),
        }).catch(() => {})
      }
    },
    [meta, profileId],
  )

  const handleVideoEnded = useCallback(() => {
    if (meta && profileId && traktStartedRef.current) {
      const isImdb = meta.id.startsWith('tt')
      apiFetch('/api/trakt/scrobble/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          metaType: meta.type,
          imdbId: isImdb ? meta.id : undefined,
          tmdbId: !isImdb ? meta.id.replace(/^tmdb:/, '') : undefined,
          season: meta.season,
          episode: meta.episode,
          progress: 100,
        }),
      }).catch(() => {})
      traktStartedRef.current = false
    }

    if (meta && profileId) {
      void removeContinueWatchingLauncher({
        profileId,
        metaId: meta.id,
        season: meta.season,
        episode: meta.episode,
      })
    }

    if (nextEpisode && meta) {
      navigate(
        `/streaming/${profileId}/${meta.type}/${meta.id}/s${nextEpisode.season}e${nextEpisode.number}`,
      )
    }
  }, [nextEpisode, meta, profileId, navigate])

  const handleMetadataLoad = useCallback((d: number) => {
    durationRef.current = d
  }, [])

  const handleError = useCallback((err: Error) => {
    log.error('Playback error', err)
  }, [])

  const seekRef = useRef<((t: number) => Promise<void>) | null>(null)

  const {
    videoRef,
    state,
    seek,
    togglePlayPause,
    loadSource,
    addSubtitleTracks,
    getSubtitleTracks,
    setSubtitleTrack,
    getAudioTracks,
    setAudioTrack,
    engineReady,
  } = usePlayerEngine({
    autoPlay: true,
    onTimeUpdate: handleTimeUpdate,
    onEnded: handleVideoEnded,
    onError: handleError,
    onMetadataLoad: handleMetadataLoad,
    onCanPlay: useCallback(() => {
      if (startTimeRef.current > 0 && seekRef.current) {
        void seekRef.current(startTimeRef.current)
      }
    }, []),
  })

  /* Keep seekRef in sync with the stable seek function */
  useEffect(() => {
    seekRef.current = seek
  }, [seek])

  /* ── Load source when engine + stream are ready ── */
  useEffect(() => {
    if (!engineReady || !stream?.url) return
    void loadSource({ src: stream.url })
  }, [engineReady, stream?.url, loadSource])

  /* ── Push subtitle tracks once both stream subtitles and engine are ready ── */
  useEffect(() => {
    if (!engineReady || !stream?.subtitles?.length) return
    const tracks: SubtitleTrack[] = (stream.subtitles || [])
      .filter((s) => !!s?.url)
      .map((s, i) => ({
        id: s.url,
        src: s.url,
        label: s.lang || 'Unknown',
        language: s.lang || 'und',
        enabled: i === 0,
      }))
    addSubtitleTracks(tracks)
  }, [engineReady, stream?.subtitles, addSubtitleTracks])

  /* ── Parse URL / location state ── */
  useEffect(() => {
    let cancelled = false

    const fetchProgress = async (m: MetaInfo): Promise<number> => {
      try {
        const season = m.season !== undefined ? `&season=${m.season}` : ''
        const ep = m.episode !== undefined ? `&episode=${m.episode}` : ''
        const res = await apiFetch(
          `/api/streaming/progress/${m.type}/${m.id}?profileId=${profileId}${season}${ep}`,
        )
        if (!res.ok) return 0
        const data = await res.json()
        return data.position && !data.isWatched ? (data.position as number) : 0
      } catch {
        return 0
      }
    }

    const fetchSubtitles = async (
      m: MetaInfo,
      s: StreamInfo,
    ): Promise<SubtitleTrack[]> => {
      try {
        const hash = (s as { behaviorHints?: { videoHash?: string } }).behaviorHints?.videoHash
          ? `&videoHash=${(s as { behaviorHints?: { videoHash?: string } }).behaviorHints!.videoHash}`
          : ''
        const res = await apiFetch(
          `/api/streaming/subtitles/${m.type}/${m.id}?profileId=${profileId}${hash}`,
        )
        if (!res.ok) return []
        const data = await res.json()
        if (!Array.isArray(data.subtitles)) return []
        return (data.subtitles as Record<string, unknown>[])
          .filter((sub) => !!sub?.url)
          .map((sub) => ({
            id: String(sub.url),
            src: String(sub.url),
            label: sub.addonName
              ? `${String(sub.lang || 'und')} (${String(sub.addonName)})`
              : String(sub.lang || 'und'),
            language: String(sub.lang || 'und'),
            enabled: false,
          }))
      } catch {
        return []
      }
    }

    const init = async () => {
      try {
        let parsedStream: StreamInfo | null = null
        let parsedMeta: MetaInfo | null = null

        if (location.state?.stream && location.state?.meta) {
          parsedStream = location.state.stream as StreamInfo
          parsedMeta = location.state.meta as MetaInfo
        } else {
          const p = new URLSearchParams(searchParamsKey)
          const streamParam = p.get('stream')
          const metaParam = p.get('meta')
          if (!streamParam || !metaParam) {
            navigate(`/streaming/${profileId}`)
            return
          }
          parsedStream = JSON.parse(streamParam) as StreamInfo
          parsedMeta = JSON.parse(metaParam) as MetaInfo
        }

        if (!parsedStream || !parsedMeta) throw new Error('Invalid stream/meta')

        setStream(parsedStream)
        setMeta(parsedMeta)

        const resumeAt = await fetchProgress(parsedMeta)
        if (cancelled) return
        startTimeRef.current = resumeAt
        lastSavedRef.current = resumeAt
        setLoading(false)

        void fetchSubtitles(parsedMeta, parsedStream).then((tracks) => {
          if (cancelled || !tracks.length) return
          addSubtitleTracks(tracks)
        })
      } catch (e) {
        log.error('Failed to init TV player', e)
        if (cancelled) return
        setPageError('Invalid player parameters')
        setLoading(false)
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [searchParamsKey, profileId, location.state, navigate, addSubtitleTracks])

  /* ── Episode navigation ── */
  useEffect(() => {
    if (
      !meta ||
      meta.type !== 'series' ||
      !meta.videos ||
      meta.season === undefined ||
      meta.episode === undefined
    )
      return
    const sorted = [...meta.videos].sort(
      (a, b) => a.season - b.season || a.number - b.number,
    )
    const idx = sorted.findIndex(
      (v) => v.season === meta.season && v.number === meta.episode,
    )
    setNextEpisode(idx < sorted.length - 1 ? sorted[idx + 1] ?? null : null)
  }, [meta])

  /* ── Player mode ── */
  useLayoutEffect(() => {
    void setTauriPlayerMode(true, 'landscape')
    document.body.classList.add('player-active')
    return () => {
      void setTauriPlayerMode(false, 'auto')
      document.body.classList.remove('player-active')
    }
  }, [])

  /* ── Trakt stop on unmount ── */
  useEffect(() => {
    return () => {
      const d = durationRef.current
      if (meta && profileId && d > 0) {
        const pct = lastSavedRef.current / d
        if (pct >= 0.95) {
          void removeContinueWatchingLauncher({
            profileId,
            metaId: meta.id,
            season: meta.season,
            episode: meta.episode,
          })
        } else if (pct >= 0.05 && lastSavedRef.current >= 60) {
          void syncContinueWatchingLauncher({
            profileId,
            metaId: meta.id,
            metaType: meta.type,
            title: meta.name,
            description: buildLauncherDescription(meta),
            posterUrl: meta.poster,
            season: meta.season,
            episode: meta.episode,
            playbackPositionSeconds: lastSavedRef.current,
            durationSeconds: d,
          })
        }
      }

      if (meta && profileId && traktStartedRef.current && d > 0) {
        const pct = (lastSavedRef.current / d) * 100
        const isImdb = meta.id.startsWith('tt')
        const data = JSON.stringify({
          profileId,
          metaType: meta.type,
          imdbId: isImdb ? meta.id : undefined,
          tmdbId: !isImdb ? meta.id.replace(/^tmdb:/, '') : undefined,
          season: meta.season,
          episode: meta.episode,
          progress: Math.round(pct),
        })
        navigator.sendBeacon(
          resolveBeaconUrl('/api/trakt/scrobble/stop'),
          new Blob([data], { type: 'application/json' }),
        )
      }
      window.dispatchEvent(new CustomEvent('history-updated'))
    }
  }, [meta, profileId])

  /* ─── UI state ─── */
  const [controlsVisible, setControlsVisible] = useState(true)
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false)
  const [audioMenuOpen, setAudioMenuOpen] = useState(false)
  const [nextEpBannerVisible, setNextEpBannerVisible] = useState(false)
  const [nextEpCountdown, setNextEpCountdown] = useState(NEXT_EP_COUNTDOWN_SECONDS)
  const [nextEpDismissed, setNextEpDismissed] = useState(false)

  /* Re-read live tracks on each render cycle so the menus always reflect current state */
  const subtitleTracks: SubtitleTrack[] = getSubtitleTracks()
  const audioTracks: AudioTrack[] = getAudioTracks()

  const hasSubtitles = subtitleTracks.length > 0
  const hasMultipleAudio = audioTracks.length > 1

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextEpTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setControlsVisible(false)
    }, CONTROLS_HIDE_DELAY)
  }, [])

  const hideControls = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setControlsVisible(false)
  }, [])

  /* Reset hide timer on mount */
  useEffect(() => {
    showControls()
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [showControls])

  /* ── Next episode banner countdown ── */
  useEffect(() => {
    const { currentTime, duration } = state
    if (
      !nextEpisode ||
      nextEpDismissed ||
      duration <= 0 ||
      duration - currentTime > NEXT_EP_TRIGGER_SECONDS
    ) {
      if (nextEpBannerVisible && nextEpDismissed) setNextEpBannerVisible(false)
      return
    }

    if (!nextEpBannerVisible) {
      setNextEpBannerVisible(true)
      setNextEpCountdown(NEXT_EP_COUNTDOWN_SECONDS)
    }
  }, [state.currentTime, state.duration, nextEpisode, nextEpDismissed, nextEpBannerVisible])

  useEffect(() => {
    if (!nextEpBannerVisible) return

    nextEpTimerRef.current = setInterval(() => {
      setNextEpCountdown((prev) => {
        if (prev <= 1) {
          if (meta && nextEpisode) {
            navigate(
              `/streaming/${profileId}/${meta.type}/${meta.id}/s${nextEpisode.season}e${nextEpisode.number}`,
            )
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (nextEpTimerRef.current) clearInterval(nextEpTimerRef.current)
    }
  }, [nextEpBannerVisible, meta, nextEpisode, profileId, navigate])

  /* ── Global keydown handler ── */
  const controlsVisibleRef = useRef(controlsVisible)
  useEffect(() => {
    controlsVisibleRef.current = controlsVisible
  }, [controlsVisible])

  const subtitleMenuOpenRef = useRef(subtitleMenuOpen)
  useEffect(() => {
    subtitleMenuOpenRef.current = subtitleMenuOpen
  }, [subtitleMenuOpen])

  const audioMenuOpenRef = useRef(audioMenuOpen)
  useEffect(() => {
    audioMenuOpenRef.current = audioMenuOpen
  }, [audioMenuOpen])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const key = event.key
      const keyCode = event.keyCode ?? event.which

      /* Media keys always work regardless of controls visibility */
      if (
        key === 'MediaPlayPause' ||
        keyCode === 179 ||
        key === 'MediaPlay' ||
        key === 'MediaPause'
      ) {
        event.preventDefault()
        togglePlayPause()
        showControls()
        return
      }
      if (
        key === 'MediaFastForward' ||
        keyCode === 228 ||
        key === 'MediaTrackNext'
      ) {
        event.preventDefault()
        void seek(Math.min(state.currentTime + SEEK_STEP, state.duration))
        showControls()
        return
      }
      if (
        key === 'MediaRewind' ||
        keyCode === 227 ||
        key === 'MediaTrackPrevious'
      ) {
        event.preventDefault()
        void seek(Math.max(state.currentTime - SEEK_STEP, 0))
        showControls()
        return
      }

      const isBack =
        key === 'Escape' ||
        key === 'Esc' ||
        key === 'Backspace' ||
        key === 'BrowserBack' ||
        key === 'GoBack' ||
        key === 'Back' ||
        key === 'AndroidBack' ||
        key === 'NavigateBack' ||
        keyCode === 4 ||
        keyCode === 8 ||
        keyCode === 27

      if (isBack) {
        event.preventDefault()
        /* Close open menus first */
        if (subtitleMenuOpenRef.current) {
          setSubtitleMenuOpen(false)
          showControls()
          return
        }
        if (audioMenuOpenRef.current) {
          setAudioMenuOpen(false)
          showControls()
          return
        }
        if (controlsVisibleRef.current) {
          hideControls()
        } else {
          navigate(-1)
        }
        return
      }

      /* Any other key: show controls (first press only reveals, doesn't trigger action) */
      const isDpad =
        key === 'ArrowLeft' ||
        key === 'ArrowRight' ||
        key === 'ArrowUp' ||
        key === 'ArrowDown' ||
        key === 'Enter' ||
        keyCode === 37 ||
        keyCode === 38 ||
        keyCode === 39 ||
        keyCode === 40 ||
        keyCode === 13

      if (isDpad) {
        if (!controlsVisibleRef.current) {
          event.preventDefault()
          showControls()
          return
        }
        /* Seek via arrow keys when no menu is open and controls are visible */
        if (!subtitleMenuOpenRef.current && !audioMenuOpenRef.current) {
          if (key === 'ArrowLeft' || keyCode === 37) {
            event.preventDefault()
            void seek(Math.max(state.currentTime - SEEK_STEP, 0))
            showControls()
            return
          }
          if (key === 'ArrowRight' || keyCode === 39) {
            event.preventDefault()
            void seek(Math.min(state.currentTime + SEEK_STEP, state.duration))
            showControls()
            return
          }
        }
        /* Up/Down and Enter fall through to TvFocusContext */
        showControls()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    togglePlayPause,
    seek,
    showControls,
    hideControls,
    navigate,
    state.currentTime,
    state.duration,
  ])

  const handleBack = useCallback(() => {
    if (subtitleMenuOpen) { setSubtitleMenuOpen(false); return }
    if (audioMenuOpen) { setAudioMenuOpen(false); return }
    if (controlsVisible) { hideControls(); return }
    navigate(-1)
  }, [subtitleMenuOpen, audioMenuOpen, controlsVisible, hideControls, navigate])

  const handleNavigateNextEp = useCallback(() => {
    if (!meta || !nextEpisode) return
    navigate(
      `/streaming/${profileId}/${meta.type}/${meta.id}/s${nextEpisode.season}e${nextEpisode.number}`,
    )
  }, [meta, nextEpisode, profileId, navigate])

  const progressPct =
    state.duration > 0
      ? Math.min((state.currentTime / state.duration) * 100, 100)
      : 0

  const displayTitle = meta?.name ?? ''
  const displaySubtitle =
    meta?.season !== undefined && meta?.episode !== undefined
      ? `S${meta.season}:E${meta.episode}${
          meta.videos?.find(
            (v) => v.season === meta?.season && v.number === meta?.episode,
          )?.title
            ? ` — ${meta.videos.find((v) => v.season === meta?.season && v.number === meta?.episode)!.title}`
            : ''
        }`
      : undefined

  const nextEpTitle = nextEpisode
    ? nextEpisode.title
      ? `S${nextEpisode.season}:E${nextEpisode.number} — ${nextEpisode.title}`
      : `S${nextEpisode.season}:E${nextEpisode.number}`
    : undefined

  /* ─── Loading / error screens ─── */
  if (loading) {
    return (
      <div className={styles.tvPlayerRoot}>
        <div className={styles.bufferingIndicator}>
          <div className={styles.bufferingSpinner} />
        </div>
      </div>
    )
  }

  if (pageError) {
    return (
      <div className={styles.tvPlayerRoot}>
        <div className={styles.errorState}>
          <div className={styles.errorText}>{pageError}</div>
        </div>
      </div>
    )
  }

  if (!stream || !meta) return null

  return (
    <TvFocusProvider>
      <TvFocusScope
        initialZoneId="tv-player-controls"
        onBack={handleBack}
      >
        <div className={styles.tvPlayerRoot}>
          {/* Hidden video element required by usePlayerEngine */}
          <video
            ref={videoRef}
            className={styles.hiddenVideo}
            playsInline
            aria-hidden="true"
          />

          {/* Transparent video area — receives focus when controls are hidden */}
          <div className={styles.videoArea} />

          {/* Buffering spinner */}
          {state.buffering && !state.paused && (
            <div className={styles.bufferingIndicator}>
              <div className={styles.bufferingSpinner} />
            </div>
          )}

          {/* Controls overlay */}
          <div
            className={`${styles.controlsOverlay}${!controlsVisible ? ` ${styles.hidden}` : ''}`}
            aria-hidden={!controlsVisible}
          >
            {/* Top bar */}
            <div className={styles.topBar}>
              <TvFocusZone
                id="tv-player-back-zone"
                orientation="horizontal"
                nextRight="tv-player-controls"
                nextDown="tv-player-controls"
              >
                <TvFocusItem
                  id="tv-player-back"
                  className={`${styles.tvBtn} ${styles.backBtn}`}
                  onActivate={handleBack}
                  aria-label="Back"
                >
                  <ArrowLeft size={20} />
                  <span>Back</span>
                </TvFocusItem>
              </TvFocusZone>

              <div className={styles.titleArea}>
                <span className={styles.titleText}>{displayTitle}</span>
                {displaySubtitle ? (
                  <span className={styles.subtitleText}>{displaySubtitle}</span>
                ) : null}
              </div>
            </div>

            {/* Progress area */}
            <div className={styles.progressArea}>
              <div
                className={styles.progressBarTrack}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={state.duration}
                aria-valuenow={state.currentTime}
                aria-label="Playback progress"
                tabIndex={-1}
              >
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${progressPct}%` }}
                />
                <div
                  className={styles.progressBarThumb}
                  style={{ left: `${progressPct}%` }}
                />
              </div>
              <div className={styles.timeDisplay}>
                <span>{formatTime(state.currentTime)}</span>
                <span>{formatTime(state.duration)}</span>
              </div>
            </div>

            {/* Bottom bar */}
            <TvFocusZone
              id="tv-player-controls"
              orientation="horizontal"
              nextUp="tv-player-back-zone"
            >
              <div className={styles.bottomBar}>
                {/* Seek -30s */}
                <TvFocusItem
                  id="tv-player-seek-back"
                  className={styles.tvBtn}
                  onActivate={() =>
                    void seek(Math.max(state.currentTime - SEEK_STEP, 0))
                  }
                  aria-label="Seek back 30 seconds"
                >
                  <SkipBack size={24} />
                </TvFocusItem>

                {/* Play / Pause */}
                <TvFocusItem
                  id="tv-player-play-pause"
                  className={`${styles.tvBtn} ${styles.playBtn}`}
                  onActivate={togglePlayPause}
                  aria-label={state.paused ? 'Play' : 'Pause'}
                  autoFocus
                >
                  {state.paused ? <Play size={36} fill="currentColor" /> : <Pause size={36} />}
                </TvFocusItem>

                {/* Seek +30s */}
                <TvFocusItem
                  id="tv-player-seek-fwd"
                  className={styles.tvBtn}
                  onActivate={() =>
                    void seek(
                      Math.min(state.currentTime + SEEK_STEP, state.duration),
                    )
                  }
                  aria-label="Seek forward 30 seconds"
                >
                  <SkipForward size={24} />
                </TvFocusItem>

                {/* Subtitles */}
                {hasSubtitles && (
                  <TvFocusItem
                    id="tv-player-subtitles"
                    className={styles.tvBtn}
                    onActivate={() => {
                      setSubtitleMenuOpen((prev) => !prev)
                      setAudioMenuOpen(false)
                    }}
                    aria-label="Subtitles"
                    aria-expanded={subtitleMenuOpen}
                  >
                    <Subtitles size={22} />
                  </TvFocusItem>
                )}

                {/* Audio track */}
                {hasMultipleAudio && (
                  <TvFocusItem
                    id="tv-player-audio"
                    className={styles.tvBtn}
                    onActivate={() => {
                      setAudioMenuOpen((prev) => !prev)
                      setSubtitleMenuOpen(false)
                    }}
                    aria-label="Audio tracks"
                    aria-expanded={audioMenuOpen}
                  >
                    <Volume2 size={22} />
                  </TvFocusItem>
                )}

                {/* Next episode */}
                {nextEpisode && (
                  <TvFocusItem
                    id="tv-player-next-ep"
                    className={styles.tvBtn}
                    onActivate={handleNavigateNextEp}
                    aria-label="Next episode"
                  >
                    <ChevronRight size={24} />
                  </TvFocusItem>
                )}
              </div>
            </TvFocusZone>
          </div>

          {/* Subtitle menu */}
          {subtitleMenuOpen && (
            <TvFocusScope
              initialZoneId="tv-player-subtitle-menu"
              onBack={() => {
                setSubtitleMenuOpen(false)
                showControls()
              }}
            >
              <div className={styles.menuPanel} role="dialog" aria-label="Subtitles">
                <div className={styles.menuTitle}>Subtitles</div>
                <TvFocusZone id="tv-player-subtitle-menu" orientation="vertical">
                  <TvFocusItem
                    id="tv-sub-none"
                    className={`${styles.menuItem}${
                      !subtitleTracks.some((t) => t.enabled)
                        ? ` ${styles.activeMenuItem}`
                        : ''
                    }`}
                    onActivate={() => {
                      setSubtitleTrack(null)
                      setSubtitleMenuOpen(false)
                      showControls()
                    }}
                    autoFocus
                  >
                    {!subtitleTracks.some((t) => t.enabled) && (
                      <span className={styles.menuItemDot} />
                    )}
                    None
                  </TvFocusItem>
                  {subtitleTracks.map((track, idx) => (
                    <TvFocusItem
                      key={track.id}
                      id={`tv-sub-${idx}`}
                      className={`${styles.menuItem}${track.enabled ? ` ${styles.activeMenuItem}` : ''}`}
                      onActivate={() => {
                        setSubtitleTrack(track.id)
                        setSubtitleMenuOpen(false)
                        showControls()
                      }}
                    >
                      {track.enabled && <span className={styles.menuItemDot} />}
                      {track.label}
                    </TvFocusItem>
                  ))}
                </TvFocusZone>
              </div>
            </TvFocusScope>
          )}

          {/* Audio menu */}
          {audioMenuOpen && (
            <TvFocusScope
              initialZoneId="tv-player-audio-menu"
              onBack={() => {
                setAudioMenuOpen(false)
                showControls()
              }}
            >
              <div className={styles.menuPanel} role="dialog" aria-label="Audio">
                <div className={styles.menuTitle}>Audio Track</div>
                <TvFocusZone id="tv-player-audio-menu" orientation="vertical">
                  {audioTracks.map((track, idx) => (
                    <TvFocusItem
                      key={track.id}
                      id={`tv-audio-${idx}`}
                      className={`${styles.menuItem}${track.enabled ? ` ${styles.activeMenuItem}` : ''}`}
                      onActivate={() => {
                        setAudioTrack(track.id)
                        setAudioMenuOpen(false)
                        showControls()
                      }}
                      autoFocus={idx === 0}
                    >
                      {track.enabled && <span className={styles.menuItemDot} />}
                      {track.label}
                    </TvFocusItem>
                  ))}
                </TvFocusZone>
              </div>
            </TvFocusScope>
          )}

          {/* Next episode banner */}
          {nextEpBannerVisible && nextEpTitle && (
            <TvFocusScope
              initialZoneId="tv-player-next-ep-banner"
              onBack={() => {
                setNextEpBannerVisible(false)
                setNextEpDismissed(true)
                showControls()
              }}
            >
              <div className={styles.nextEpBanner}>
                <div className={styles.nextEpLabel}>Up Next</div>
                <div className={styles.nextEpTitle}>{nextEpTitle}</div>
                <TvFocusZone id="tv-player-next-ep-banner" orientation="horizontal">
                  <div className={styles.nextEpActions}>
                    <TvFocusItem
                      id="tv-next-ep-play"
                      className={styles.nextEpPlayBtn}
                      onActivate={handleNavigateNextEp}
                      aria-label="Play next episode"
                      autoFocus
                    >
                      <Play size={16} fill="currentColor" />
                      Play Now
                    </TvFocusItem>
                    <TvFocusItem
                      id="tv-next-ep-dismiss"
                      className={styles.nextEpDismissBtn}
                      onActivate={() => {
                        setNextEpBannerVisible(false)
                        setNextEpDismissed(true)
                        if (nextEpTimerRef.current) clearInterval(nextEpTimerRef.current)
                      }}
                      aria-label="Dismiss next episode prompt"
                    >
                      Dismiss
                    </TvFocusItem>
                  </div>
                </TvFocusZone>
                <div className={styles.nextEpCountdown}>
                  Playing in {nextEpCountdown}s
                </div>
              </div>
            </TvFocusScope>
          )}
        </div>
      </TvFocusScope>
    </TvFocusProvider>
  )
}

export default StreamingPlayerTvView
