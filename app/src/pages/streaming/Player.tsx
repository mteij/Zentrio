/**
 * StreamingPlayer - Video player page
 *
 * Business logic: stream/meta parsing, progress saving, subtitle loading,
 * episode navigation, Trakt scrobbling, "find new stream" cycling.
 *
 * All player UI is handled by <ZentrioPlayer />.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { Layout, SkeletonPlayer } from '../../components'
import { ZentrioPlayer, type EpisodeInfo } from '../../components/player/ZentrioPlayer'
import type { Stream } from '../../services/addons/types'
import { toast } from 'sonner'
import { useExternalPlayer } from '../../hooks/useExternalPlayer'
import styles from '../../styles/Player.module.css'
import { apiFetch } from '../../lib/apiFetch'
import { resolveBeaconUrl, createApiEventSource } from '../../lib/url'
import type { FlatStream } from '../../hooks/useStreamLoader'

/* ─── Immersive mode (Android only) ─── */
const setImmersiveMode = async (enabled: boolean) => {
  if (!(window as any).__TAURI_INTERNALS__) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('plugin:immersive-mode|setImmersiveMode', { enabled })
  } catch {
    // Not on Android or plugin unavailable — silently ignore
  }
}

/* ─── Constants ─── */
const SHORT_VIDEO_THRESHOLD = 120   // seconds — show "find new stream"
const NEXT_EP_COUNTDOWN    = 30    // seconds before end — show next-ep popup

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

type PlayerSubtitleTrack = {
  src: string; label: string; language: string
  type?: string; addonName?: string; default?: boolean
}

function mergeSubtitleTracks(base: PlayerSubtitleTrack[], inc: PlayerSubtitleTrack[]): PlayerSubtitleTrack[] {
  if (!inc.length) return base
  const map = new Map(base.map(t => [t.src, t]))
  inc.forEach(t => { if (t.src && !map.has(t.src)) map.set(t.src, t) })
  return Array.from(map.values())
}

/* ─────────────────────────── FindNewStream hook ─────────────────────────── */
/**
 * Manages loading all available streams and cycling through them,
 * excluding previously-tried URLs (including the current stream).
 * Respects the priority order set by the backend StreamProcessor (user settings).
 */
function useFindNewStream(meta: MetaInfo | null, profileId: string | undefined) {
  const allStreamsRef = useRef<FlatStream[]>([])
  const triedUrlsRef = useRef<Set<string>>(new Set())
  const loadedRef = useRef(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const [isFinding, setIsFinding] = useState(false)

  // Reset when meta/episode changes (e.g. after navigating to a new stream)
  useEffect(() => {
    allStreamsRef.current = []
    triedUrlsRef.current = new Set()
    loadedRef.current = false
    eventSourceRef.current?.close()
    eventSourceRef.current = null
    setIsFinding(false)  // clear any stuck loading state from a previous findNext call
  }, [meta?.id, meta?.season, meta?.episode])

  // Cleanup on unmount
  useEffect(() => {
    return () => { eventSourceRef.current?.close() }
  }, [])

  /**
   * Pre-load all streams in background so they're ready when the user presses
   * "Find New Stream". Called as soon as meta+profileId are ready.
   */
  const preload = useCallback(() => {
    if (!meta || !profileId || loadedRef.current) return
    loadedRef.current = true

    let url = `/api/streaming/streams-live/${meta.type}/${meta.id}?profileId=${profileId}`
    if (meta.season !== undefined && meta.episode !== undefined) {
      url += `&season=${meta.season}&episode=${meta.episode}`
    }

    const es = createApiEventSource(url)
    eventSourceRef.current = es

    es.addEventListener('addon-result', (e) => {
      const data = JSON.parse(e.data)
      if (data.allStreams) allStreamsRef.current = data.allStreams
    })

    es.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data)
      if (data.allStreams) allStreamsRef.current = data.allStreams
      es.close()
    })

    es.addEventListener('error', () => { es.close() })
  }, [meta, profileId])

  /**
   * Find the next best untried stream. Skips URLs already in `triedUrlsRef`.
   * If streams haven't been loaded yet, waits for 'complete' event first.
   * Returns null if no alternatives remain.
   */
  const findNext = useCallback(async (currentUrl: string): Promise<Stream | null> => {
    // Always add current URL to tried set
    triedUrlsRef.current.add(currentUrl)

    setIsFinding(true)

    const pick = () => {
      // Backend already sorted by priority; find first untried
      const candidate = allStreamsRef.current.find(
        (fs) => fs.stream.url && !triedUrlsRef.current.has(fs.stream.url)
      )
      return candidate?.stream ?? null
    }

    // Fast path: streams already loaded
    if (allStreamsRef.current.length > 0) {
      const result = pick()
      setIsFinding(false)
      if (result?.url) triedUrlsRef.current.add(result.url)
      return result
    }

    // Slow path: wait for streams to load (up to 15s)
    return new Promise<Stream | null>((resolve) => {
      const timeout = setTimeout(() => {
        es?.close()
        setIsFinding(false)
        resolve(null)
      }, 15000)

      let url = `/api/streaming/streams-live/${meta!.type}/${meta!.id}?profileId=${profileId}`
      if (meta!.season !== undefined && meta!.episode !== undefined) {
        url += `&season=${meta!.season}&episode=${meta!.episode}`
      }

      const es = createApiEventSource(url)

      es.addEventListener('complete', (e) => {
        const data = JSON.parse(e.data)
        if (data.allStreams) allStreamsRef.current = data.allStreams
        const result = pick()
        clearTimeout(timeout)
        es.close()
        setIsFinding(false)
        if (result?.url) triedUrlsRef.current.add(result.url)
        resolve(result)
      })

      es.addEventListener('error', () => {
        clearTimeout(timeout)
        es.close()
        setIsFinding(false)
        resolve(null)
      })
    })
  }, [meta, profileId])

  return { preload, findNext, isFinding }
}

/* ─────────────────────────── Component ─────────────────────────── */

export const StreamingPlayer = () => {
  const { profileId } = useParams<{ profileId: string }>()
  const [searchParams] = useSearchParams()
  const searchParamsKey = searchParams.toString()
  const navigate = useNavigate()
  const location = useLocation()

  const { openExternal } = useExternalPlayer()

  const [stream, setStream] = useState<Stream | null>(null)
  const [meta, setMeta] = useState<MetaInfo | null>(null)
  const [startTime, setStartTime] = useState(0)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')

  const [subtitleTracks, setSubtitleTracks] = useState<PlayerSubtitleTrack[]>([])

  const [prevEpisode, setPrevEpisode] = useState<EpisodeInfo | null>(null)
  const [nextEpisode, setNextEpisode] = useState<EpisodeInfo | null>(null)

  const [duration, setDuration] = useState(0)
  const lastSavedRef = useRef(0)
  const traktStartedRef = useRef(false)

  /* ─── Find New Stream hook ─── */
  const { preload: preloadStreams, findNext, isFinding } = useFindNewStream(meta, profileId)

  /* ─── Parse URL / location state ─── */
  useEffect(() => {
    let cancelled = false

    const fetchProgress = async (m: MetaInfo): Promise<number> => {
      try {
        const season = m.season !== undefined ? `&season=${m.season}` : ''
        const ep = m.episode !== undefined ? `&episode=${m.episode}` : ''
        const res = await apiFetch(`/api/streaming/progress/${m.type}/${m.id}?profileId=${profileId}${season}${ep}`)
        if (!res.ok) return 0
        const data = await res.json()
        return data.position && !data.isWatched ? data.position : 0
      } catch { return 0 }
    }

    const fetchSubtitles = async (m: MetaInfo, s: Stream): Promise<PlayerSubtitleTrack[]> => {
      try {
        const hash = s.behaviorHints?.videoHash ? `&videoHash=${s.behaviorHints.videoHash}` : ''
        const res = await apiFetch(`/api/streaming/subtitles/${m.type}/${m.id}?profileId=${profileId}${hash}`)
        if (!res.ok) return []
        const data = await res.json()
        if (!Array.isArray(data.subtitles)) return []
        return data.subtitles
          .filter((s: any) => !!s?.url)
          .map((s: any) => ({
            src: s.url,
            label: s.addonName ? `${s.lang} (${s.addonName})` : s.lang,
            language: s.lang || 'und',
            type: s.type || s.format,
            addonName: s.addonName,
          }))
      } catch { return [] }
    }

    const init = async () => {
      try {
        let parsedStream: Stream | null = null
        let parsedMeta: MetaInfo | null = null

        if (location.state?.stream && location.state?.meta) {
          parsedStream = location.state.stream
          parsedMeta = location.state.meta
        } else {
          const p = new URLSearchParams(searchParamsKey)
          const streamParam = p.get('stream')
          const metaParam = p.get('meta')
          if (!streamParam || !metaParam) { navigate(`/streaming/${profileId}`); return }
          parsedStream = JSON.parse(streamParam)
          parsedMeta = JSON.parse(metaParam)
        }

        if (!parsedStream || !parsedMeta) throw new Error('Invalid stream/meta')

        setStream(parsedStream)
        setMeta(parsedMeta)

        const inlineTracks: PlayerSubtitleTrack[] = (parsedStream.subtitles || [])
          .filter((s: any) => !!s?.url)
          .map((s: any, i: number) => ({
            src: s.url, label: s.lang || 'Unknown', language: s.lang || 'und', default: i === 0
          }))
        setSubtitleTracks(inlineTracks)

        const subPromise = fetchSubtitles(parsedMeta, parsedStream).then(tracks => {
          if (cancelled || !tracks.length) return
          setSubtitleTracks(prev => mergeSubtitleTracks(prev, tracks))
        })

        const resumeAt = await fetchProgress(parsedMeta)
        if (cancelled) return
        setStartTime(resumeAt)
        lastSavedRef.current = resumeAt
        setLoading(false)

        void subPromise
      } catch (e) {
        console.error('Failed to init player', e)
        if (cancelled) return
        setPageError('Invalid player parameters')
        setLoading(false)
      }
    }

    init()
    return () => { cancelled = true }
  }, [searchParamsKey, profileId, location.state, navigate])

  /* ─── Preload alternative streams in background once meta is ready ─── */
  useEffect(() => {
    if (meta && profileId) preloadStreams()
  }, [meta, profileId, preloadStreams])

  /* ─── Episode navigation ─── */
  useEffect(() => {
    if (!meta || meta.type !== 'series' || !meta.videos || meta.season === undefined || meta.episode === undefined) return
    const sorted = [...meta.videos].sort((a, b) => a.season - b.season || a.number - b.number)
    const idx = sorted.findIndex(v => v.season === meta.season && v.number === meta.episode)
    setPrevEpisode(idx > 0 ? sorted[idx - 1] : null)
    setNextEpisode(idx < sorted.length - 1 ? sorted[idx + 1] : null)
  }, [meta])

  /* ─── Progress saving + Trakt ─── */
  const handleTimeUpdate = useCallback((t: number, d: number) => {
    if (d > 0) setDuration(d)

    if (meta && profileId && d > 0 && Math.abs(t - lastSavedRef.current) >= 10) {
      lastSavedRef.current = t
      const pct = t / d
      if (pct > 0.02 && pct < 0.95) {
        apiFetch('/api/streaming/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId, metaId: meta.id, metaType: meta.type,
            season: meta.season, episode: meta.episode,
            position: t, duration: d,
            title: meta.name, poster: meta.poster
          })
        }).catch(console.error)
      }
    }

    if (meta && profileId && d > 0 && !traktStartedRef.current) {
      traktStartedRef.current = true
      const isImdb = meta.id.startsWith('tt')
      apiFetch('/api/trakt/scrobble/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId, metaType: meta.type,
          imdbId: isImdb ? meta.id : undefined,
          tmdbId: !isImdb ? meta.id.replace(/^tmdb:/, '') : undefined,
          season: meta.season, episode: meta.episode,
          progress: Math.round((t / d) * 100)
        })
      }).catch(() => {})
    }
  }, [meta, profileId])

  const handleVideoEnded = useCallback(() => {
    if (meta && profileId && traktStartedRef.current) {
      const isImdb = meta.id.startsWith('tt')
      apiFetch('/api/trakt/scrobble/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId, metaType: meta.type,
          imdbId: isImdb ? meta.id : undefined,
          tmdbId: !isImdb ? meta.id.replace(/^tmdb:/, '') : undefined,
          season: meta.season, episode: meta.episode, progress: 100
        })
      }).catch(() => {})
      traktStartedRef.current = false
    }

    if (nextEpisode && meta) {
      handleNavigateEpisode(nextEpisode)
    }
  }, [nextEpisode, meta, profileId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleMetadataLoad = useCallback((d: number) => {
    setDuration(d)
  }, [])

  const handleError = useCallback((err: Error) => {
    console.error('Playback error:', err)
    toast.error('Playback error: ' + err.message)
  }, [])

  const handleNavigateEpisode = useCallback((ep: EpisodeInfo) => {
    if (!meta) return
    navigate(`/streaming/${profileId}/${meta.type}/${meta.id}/s${ep.season}e${ep.number}`)
  }, [meta, profileId, navigate])

  /* ─── Find New Stream ─── */
  const handleFindNewStream = useCallback(async () => {
    if (!stream?.url || !meta || !profileId) return

    const toastId = toast.loading('Finding a better stream...')
    const nextStream = await findNext(stream.url)
    toast.dismiss(toastId)

    if (!nextStream || !nextStream.url) {
      toast.error('No other streams available. Try refreshing sources on the details page.')
      return
    }

    toast.success('Switched to next stream')

    // Navigate to player with the new stream (same meta, reset start time)
    navigate(`/streaming/${profileId}/player`, {
      replace: true,   // replace so Back doesn't loop
      state: {
        stream: nextStream,
        meta: {
          id: meta.id,
          type: meta.type,
          name: meta.name,
          poster: meta.poster,
          season: meta.season,
          episode: meta.episode,
          videos: meta.videos
        }
      }
    })
  }, [stream, meta, profileId, findNext, navigate])

  const handleOpenExternal = useCallback(async () => {
    if (!stream?.url) return { success: false, message: 'No stream URL' }
    const result = await openExternal({ url: stream.url, title: meta?.name })
    if (result.success) toast.success(result.message)
    else toast.error(result.message)
    return result
  }, [openExternal, stream, meta])

  /* ─── Immersive mode: enable on mount, restore on unmount ─── */
  useEffect(() => {
    setImmersiveMode(true)
    // Add player-active class to body for CSS targeting (fallback for browsers without :has() support)
    document.body.classList.add('player-active')
    return () => { 
      setImmersiveMode(false) 
      document.body.classList.remove('player-active')
    }
  }, [])

  /* ─── Trakt stop on unmount ─── */
  useEffect(() => {
    return () => {
      if (meta && profileId && traktStartedRef.current && duration > 0) {
        const pct = (lastSavedRef.current / duration) * 100
        const isImdb = meta.id.startsWith('tt')
        const data = JSON.stringify({
          profileId, metaType: meta.type,
          imdbId: isImdb ? meta.id : undefined,
          tmdbId: !isImdb ? meta.id.replace(/^tmdb:/, '') : undefined,
          season: meta.season, episode: meta.episode, progress: Math.round(pct)
        })
        navigator.sendBeacon(resolveBeaconUrl('/api/trakt/scrobble/stop'), new Blob([data], { type: 'application/json' }))
      }
      window.dispatchEvent(new CustomEvent('history-updated'))
    }
  }, [meta, profileId, duration])

  /* ─── Render ─── */
  if (loading) {
    return (
      <Layout title="Loading..." showHeader={false} showFooter={false}>
        <SkeletonPlayer />
      </Layout>
    )
  }

  if (pageError) {
    return <div className={styles.errorPage}>{pageError}</div>
  }

  if (!stream || !meta) return null

  const displayTitle = meta.name
  const displaySubtitle = meta.season !== undefined && meta.episode !== undefined
    ? `S${meta.season}:E${meta.episode}${
        meta.videos?.find(v => v.season === meta.season && v.number === meta.episode)?.title
          ? ` — ${meta.videos.find(v => v.season === meta.season && v.number === meta.episode)!.title}`
          : ''
      }`
    : undefined

  // Detect if we're on mobile (for immersive mode styling)
  const isMobilePlatform = typeof window !== 'undefined' && 
    (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || 
     ('ontouchstart' in window && window.innerWidth <= 1024))

  return (
    <Layout title={`Playing: ${meta.name}`} showHeader={false} showFooter={false}>
      <div className={`${styles.playerWrapper} ${isMobilePlatform ? styles.playerWrapperImmersive : ''}`}>
        <ZentrioPlayer
          src={stream.url!}
          poster={meta.poster}
          title={displayTitle}
          subtitle={displaySubtitle}
          subtitles={subtitleTracks.map(t => ({
            id: t.src,
            src: t.src,
            label: t.label,
            language: t.language,
            enabled: t.default || false,
            addonName: t.addonName
          }))}
          startTime={startTime}
          autoPlay={true}
          onBack={() => navigate(-1)}
          prevEpisode={prevEpisode}
          nextEpisode={nextEpisode}
          onNavigateEpisode={handleNavigateEpisode}
          nextEpisodeAt={NEXT_EP_COUNTDOWN}
          shortVideoThreshold={SHORT_VIDEO_THRESHOLD}
          onFindNewStream={handleFindNewStream}
          onOpenExternal={handleOpenExternal}
          onTimeUpdate={handleTimeUpdate}
          onMetadataLoad={handleMetadataLoad}
          onEnded={handleVideoEnded}
          onError={handleError}
        />
      </div>
    </Layout>
  )
}
