import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAutoPlay } from '../../hooks/useAutoPlay'
import { useOfflineDownloadCapability } from '../../hooks/useOfflineDownloadCapability'
import { useStreamLoader, type FlatStream } from '../../hooks/useStreamLoader'
import {
  useStreamDisplaySettings,
  type StreamDisplaySettings,
} from '../../hooks/useStreamDisplaySettings'
import { apiFetch } from '../../lib/apiFetch'
import { isTauri } from '../../lib/auth-client'
import { downloadService, DownloadQuality } from '../../services/downloads/download-service'
import { useDownloadStore } from '../../stores/downloadStore'
import type { MetaDetail } from '../../services/addons/types'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('DetailsScreenModel')

interface StreamingDetailsData {
  meta: MetaDetail
  inLibrary: boolean
  watchProgress?: {
    position: number
    duration: number
    progressPercent: number
    isWatched: boolean
  }
  seriesProgress?: Record<
    string,
    {
      position: number
      duration: number
      progressPercent: number
      isWatched: boolean
    }
  >
  lastWatchedEpisode?: {
    season: number
    episode: number
  }
}

export interface DetailsEpisodeItem {
  id: string
  season: number
  episode: number
  title: string
  thumbnail?: string
  description?: string
  watchedPercent?: number
  isWatched?: boolean
}

export interface DetailsStreamItem {
  id: string
  title: string
  subtitle?: string
  description?: string
  url?: string
  addonId?: string
  addonName?: string
  parsed?: {
    resolution?: string
    encode?: string[]
    audioTags?: string[]
    audioChannels?: string[]
    visualTags?: string[]
    sourceType?: string
    seeders?: number
    size?: number
    languages?: string[]
    isCached?: boolean
  }
}

export interface DetailsCastMember {
  name: string
  character?: string
  photo?: string
}

export interface DetailsScreenModel {
  status: 'loading' | 'ready' | 'error'
  profileId: string
  metaType: string
  metaId: string
  errorMessage?: string
  canDownload: boolean
  view: 'overview' | 'episodes' | 'sources'
  selectedSeason?: number
  selectedEpisode?: DetailsEpisodeItem
  data?: StreamingDetailsData
  seasons: number[]
  episodes: DetailsEpisodeItem[]
  streams: DetailsStreamItem[]
  isLoadingStreams: boolean
  isStreamsComplete: boolean
  // library / watchlist
  inList: boolean
  genres: string[]
  cast: DetailsCastMember[]
  director: string[]
  streamDisplaySettings: StreamDisplaySettings
  navigation: {
    goBack: () => void
    playStream: (streamUrl?: string) => void
  }
  actions: {
    retry: () => Promise<void>
    setView: (view: 'overview' | 'episodes' | 'sources') => void
    selectSeason: (season: number) => void
    selectEpisode: (episode: DetailsEpisodeItem, autoPlay?: boolean) => void
    playPrimary: () => void
    refreshStreams: () => void
    toggleWatched: (season?: number, episode?: number) => Promise<void>
    toggleSeasonWatched: (season: number, watched: boolean) => Promise<void>
    markSeriesWatched: (watched: boolean) => Promise<void>
    toggleList: () => Promise<void>
    downloadStream: (streamIndex: number) => Promise<void>
  }
}

function buildStreamLabel(flatStream: FlatStream, index: number): DetailsStreamItem {
  const { stream, addon, parsed } = flatStream
  const title = stream.title || stream.name || `Source ${index + 1}`
  const description = stream.description || undefined

  // Build subtitle from parsed data (or fall back to text scan) for classic/fallback display
  const parts: string[] = []
  if (parsed?.resolution) {
    parts.push(parsed.resolution.toUpperCase())
  } else {
    const lower =
      `${stream.name || ''} ${stream.title || ''} ${stream.description || ''}`.toLowerCase()
    if (lower.includes('4k') || lower.includes('2160p')) parts.push('4K')
    else if (lower.includes('1080p')) parts.push('1080p')
    else if (lower.includes('720p')) parts.push('720p')
  }
  if (parsed?.isCached) parts.push('Cached')

  return {
    id: `${index}-${stream.url || title}`,
    title,
    subtitle: parts.join(' · ') || undefined,
    description,
    url: stream.url,
    addonId: addon?.id,
    addonName: addon?.name,
    parsed: parsed ? { ...parsed } : undefined,
  }
}

export function useDetailsScreenModel(): DetailsScreenModel {
  const { profileId, type, id } = useParams<{ profileId: string; type: string; id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { startAutoPlay } = useAutoPlay()
  const { isAvailable: canDownload } = useOfflineDownloadCapability(profileId)
  const downloadStore = useDownloadStore()
  const [data, setData] = useState<StreamingDetailsData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [view, setView] = useState<'overview' | 'episodes' | 'sources'>('overview')
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)
  const [selectedEpisode, setSelectedEpisode] = useState<DetailsEpisodeItem | null>(null)
  const [inList, setInList] = useState(false)
  const autoPlayRef = useRef(false)
  // Capture autoPlay state once on mount so navigate() in loadDetails doesn't re-trigger the effect
  const initialAutoPlayRef = useRef(location.state?.autoPlay as boolean | undefined)
  const initialLocationStateRef = useRef(location.state as Record<string, unknown> | null)

  const {
    streams,
    filteredStreams,
    isLoading: isLoadingStreams,
    isComplete: isStreamsComplete,
    loadStreams: loadStreamsProgressive,
    refreshStreams,
  } = useStreamLoader()

  const seasons = useMemo(() => {
    if (!data?.meta?.videos) return []
    const unique = Array.from(
      new Set(data.meta.videos.map((video: any) => video.season || 0))
    ).sort((a, b) => a - b)
    return unique.length > 1 ? unique.filter((season) => season !== 0) : unique
  }, [data?.meta?.videos])

  const episodes = useMemo<DetailsEpisodeItem[]>(() => {
    if (!data?.meta?.videos || selectedSeason == null) return []
    return data.meta.videos
      .filter((video: any) => (video.season || 0) === selectedSeason)
      .sort((a: any, b: any) => (a.number || a.episode || 0) - (b.number || b.episode || 0))
      .map((video: any) => {
        const episodeNumber = video.number || video.episode || 0
        const progressKey = `${selectedSeason}-${episodeNumber}`
        const progress = data.seriesProgress?.[progressKey]

        return {
          id: video.id || `${selectedSeason}-${episodeNumber}`,
          season: selectedSeason,
          episode: episodeNumber,
          title: video.title || `Episode ${episodeNumber}`,
          thumbnail: video.thumbnail,
          description: video.overview || video.description,
          watchedPercent: progress?.progressPercent,
          isWatched: progress?.isWatched,
        }
      })
  }, [data?.meta?.videos, data?.seriesProgress, selectedSeason])

  const rawStreamSource = useMemo(
    () => (filteredStreams.length > 0 ? filteredStreams : streams),
    [filteredStreams, streams]
  )

  const streamItems = useMemo(
    () => rawStreamSource.map((item, index) => buildStreamLabel(item, index)),
    [rawStreamSource]
  )

  const streamDisplaySettings = useStreamDisplaySettings(profileId)

  const genres = useMemo<string[]>(() => {
    if (!data?.meta?.genres) return []
    return data.meta.genres
      .filter((g: string) => !g.match(/^\d+(\+)?$/) && g.length < 30)
      .slice(0, 5)
  }, [data?.meta?.genres])

  const cast = useMemo<DetailsCastMember[]>(() => {
    const rawCast = (data?.meta as any)?.app_extras?.cast || []
    return rawCast.slice(0, 12).map((c: any) => ({
      name: c.name || '',
      character: c.character,
      photo: c.photo,
    }))
  }, [data?.meta])

  const director = useMemo<string[]>(() => {
    const raw = (data?.meta as any)?.director
    if (!raw) return []
    return Array.isArray(raw) ? raw : [raw]
  }, [data?.meta])

  const playStream = useCallback(
    (streamUrl?: string) => {
      if (!profileId || !data?.meta) return

      const selectedStream =
        rawStreamSource
          .map((item) => item.stream)
          .find((candidate) => candidate.url === streamUrl) || rawStreamSource[0]?.stream

      if (!selectedStream?.url) {
        toast.error('No playable stream is ready yet')
        return
      }

      const meta = {
        id: data.meta.id,
        type: data.meta.type,
        name: data.meta.name,
        poster: data.meta.poster,
        season: selectedEpisode?.season,
        episode: selectedEpisode?.episode,
      }

      navigate(
        `/streaming/${profileId}/player?stream=${encodeURIComponent(JSON.stringify(selectedStream))}&meta=${encodeURIComponent(JSON.stringify(meta))}`
      )
    },
    [
      data?.meta,
      rawStreamSource,
      navigate,
      profileId,
      selectedEpisode?.episode,
      selectedEpisode?.season,
    ]
  )

  const loadStreams = useCallback(
    (season?: number, episode?: number, autoPlay = false) => {
      autoPlayRef.current = autoPlay
      if (!type || !id || !profileId) return
      loadStreamsProgressive(type, id, profileId, season, episode)
    },
    [id, loadStreamsProgressive, profileId, type]
  )

  const checkListStatus = useCallback(async () => {
    const checkId = data?.meta?.id || id
    if (!profileId || !checkId) return
    try {
      const res = await apiFetch(
        `/api/lists/check/${encodeURIComponent(checkId)}?profileId=${profileId}&t=${Date.now()}`
      )
      if (res.ok) {
        const result = (await res.json()) as { listIds: number[] }
        setInList(result.listIds.length > 0)
      }
    } catch (e) {
      log.error('Failed to check list status', e)
    }
  }, [data?.meta?.id, id, profileId])

  const loadDetails = useCallback(async () => {
    if (!profileId || !type || !id) {
      navigate('/profiles')
      return
    }

    setStatus('loading')
    setErrorMessage('')

    try {
      const searchParams = new URLSearchParams(window.location.search)
      const metaFallback = searchParams.get('metaFallback')
      let url = `/api/streaming/details/${type}/${id}?profileId=${profileId}`
      if (metaFallback) {
        url += `&metaFallback=${metaFallback}`
      }

      const response = await apiFetch(url)
      if (!response.ok) {
        throw new Error('Failed to load content')
      }

      const detailsData = (await response.json()) as StreamingDetailsData
      setData(detailsData)

      // Consume the initial autoPlay state exactly once; clear the ref so re-runs are no-ops
      const capturedAutoPlay = initialAutoPlayRef.current
      const capturedLocationState = initialLocationStateRef.current
      initialAutoPlayRef.current = undefined
      initialLocationStateRef.current = null

      if (detailsData.meta.type === 'series' && detailsData.meta.videos) {
        const availableSeasons = Array.from(
          new Set(detailsData.meta.videos.map((video: any) => video.season || 0))
        ).sort((a, b) => a - b)
        const filteredSeasons =
          availableSeasons.length > 1
            ? availableSeasons.filter((season) => season !== 0)
            : availableSeasons
        const initialSeason =
          detailsData.lastWatchedEpisode?.season &&
          filteredSeasons.includes(detailsData.lastWatchedEpisode.season)
            ? detailsData.lastWatchedEpisode.season
            : filteredSeasons[0]

        setSelectedSeason(initialSeason)
        setView('episodes')

        if (capturedAutoPlay) {
          navigate('.', { replace: true, state: { ...capturedLocationState, autoPlay: false } })
          const targetSeason =
            (capturedLocationState?.season as number | undefined) || initialSeason
          const targetEpisode =
            (capturedLocationState?.episode as number | undefined) ||
            detailsData.lastWatchedEpisode?.episode ||
            1
          const selected = {
            id: `${targetSeason}-${targetEpisode}`,
            season: targetSeason,
            episode: targetEpisode,
            title:
              (capturedLocationState?.title as string | undefined) || `Episode ${targetEpisode}`,
          }
          setSelectedEpisode(selected)
          setView('sources')
          loadStreams(targetSeason, targetEpisode, true)
        }
      } else {
        setView('overview')
        loadStreams(undefined, undefined, Boolean(capturedAutoPlay))
        if (capturedAutoPlay) {
          navigate('.', { replace: true, state: { ...capturedLocationState, autoPlay: false } })
        }
      }

      setStatus('ready')
    } catch (error) {
      log.error('details load error', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load content')
      setStatus('error')
    }
  }, [id, loadStreams, navigate, profileId, type])

  useEffect(() => {
    void loadDetails()
  }, [loadDetails])

  // Check list status once meta is loaded
  useEffect(() => {
    if (data?.meta?.id) {
      void checkListStatus()
    }
  }, [checkListStatus, data?.meta?.id])

  useEffect(() => {
    if (!autoPlayRef.current) return
    const playableStream = streams[0]?.stream
    if (playableStream?.url) {
      autoPlayRef.current = false
      toast.dismiss('autoplay-loading')
      playStream(playableStream.url)
      return
    }

    if (isStreamsComplete && streams.length === 0) {
      autoPlayRef.current = false
      toast.dismiss('autoplay-loading')
      toast.error('No streams were found for auto-play')
      setView(data?.meta.type === 'series' ? 'episodes' : 'overview')
    }
  }, [data?.meta.type, isStreamsComplete, playStream, streams])

  const handleSelectEpisode = (episode: DetailsEpisodeItem, autoPlay = false) => {
    setSelectedEpisode(episode)
    setView('sources')
    loadStreams(episode.season, episode.episode, autoPlay)
  }

  const handlePlayPrimary = () => {
    if (!data?.meta) return

    if (data.meta.type === 'movie') {
      if (streamItems[0]?.url) {
        playStream(streamItems[0].url)
        return
      }
      loadStreams(undefined, undefined, true)
      return
    }

    if (selectedEpisode) {
      handleSelectEpisode(selectedEpisode, true)
      return
    }

    if (episodes[0]) {
      handleSelectEpisode(episodes[0], true)
      return
    }

    startAutoPlay({
      profileId: profileId || '',
      meta: {
        id: data.meta.id,
        type: data.meta.type,
        name: data.meta.name,
        poster: data.meta.poster,
      },
    })
  }

  const handleToggleWatched = useCallback(
    async (season?: number, episode?: number) => {
      if (!data || !profileId) return
      const isMovie = data.meta.type === 'movie'
      const currentlyWatched = isMovie
        ? data.watchProgress?.isWatched
        : season != null && episode != null
          ? data.seriesProgress?.[`${season}-${episode}`]?.isWatched
          : false
      const newWatched = !currentlyWatched

      // Optimistic update
      if (isMovie) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                watchProgress: {
                  ...(prev.watchProgress || {
                    position: 0,
                    duration: 0,
                    progressPercent: 0,
                    isWatched: false,
                  }),
                  isWatched: newWatched,
                },
              }
            : prev
        )
      } else if (season != null && episode != null) {
        const key = `${season}-${episode}`
        setData((prev) =>
          prev
            ? {
                ...prev,
                seriesProgress: {
                  ...(prev.seriesProgress || {}),
                  [key]: {
                    ...(prev.seriesProgress?.[key] || {
                      position: 0,
                      duration: 0,
                      progressPercent: 0,
                      isWatched: false,
                    }),
                    isWatched: newWatched,
                  },
                },
              }
            : prev
        )
      }

      try {
        const res = await apiFetch('/api/streaming/mark-watched', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: parseInt(profileId),
            metaId: id,
            metaType: data.meta.type,
            season,
            episode,
            watched: newWatched,
          }),
        })
        const result = (await res.json()) as { traktSynced?: boolean }
        const label = season != null && episode != null ? `S${season}:E${episode}` : data.meta.name
        toast.success(
          newWatched
            ? `Marked ${label} as watched${result.traktSynced ? ' (synced to Trakt)' : ''}`
            : `Marked ${label} as unwatched`,
          { duration: 3000 }
        )
      } catch (e) {
        log.error('toggleWatched failed', e)
        toast.error('Failed to update watched status')
      }
    },
    [data, id, profileId]
  )

  const handleToggleSeasonWatched = useCallback(
    async (season: number, watched: boolean) => {
      if (!data || !profileId || !data.meta.videos) return
      const episodeNumbers = data.meta.videos
        .filter((v: any) => v.season === season)
        .map((v: any) => v.number || v.episode)

      const updatedProgress = { ...(data.seriesProgress || {}) }
      episodeNumbers.forEach((ep: number) => {
        const key = `${season}-${ep}`
        updatedProgress[key] = {
          ...(updatedProgress[key] || {
            position: 0,
            duration: 0,
            progressPercent: 0,
            isWatched: false,
          }),
          isWatched: watched,
        }
      })
      setData((prev) => (prev ? { ...prev, seriesProgress: updatedProgress } : prev))

      try {
        const res = await apiFetch('/api/streaming/mark-season-watched', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: parseInt(profileId),
            metaId: id,
            metaType: 'series',
            season,
            watched,
            episodes: episodeNumbers,
          }),
        })
        const result = (await res.json()) as { traktSynced?: boolean }
        toast.success(
          `Season ${season} ${watched ? 'marked as watched' : 'unmarked'}${result.traktSynced ? ' (synced to Trakt)' : ''}`,
          { duration: 3000 }
        )
      } catch (e) {
        log.error('toggleSeasonWatched failed', e)
        toast.error('Failed to update season watched status')
      }
    },
    [data, id, profileId]
  )

  const handleMarkSeriesWatched = useCallback(
    async (watched: boolean) => {
      if (!data || !profileId) return

      try {
        const allEpisodes = (data.meta.videos || []).map((v: any) => ({
          season: v.season,
          episode: v.number || v.episode,
        }))
        const res = await apiFetch('/api/streaming/mark-series-watched', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileId: parseInt(profileId),
            metaId: id,
            watched,
            allEpisodes,
          }),
        })
        const result = (await res.json()) as { traktSynced?: boolean; episodesUpdated?: number }

        const updatedProgress = { ...(data.seriesProgress || {}) }
        allEpisodes.forEach((ep) => {
          const key = `${ep.season}-${ep.episode}`
          updatedProgress[key] = {
            ...(updatedProgress[key] || {
              position: 0,
              duration: 0,
              progressPercent: 0,
              isWatched: false,
            }),
            isWatched: watched,
          }
        })
        setData((prev) => (prev ? { ...prev, seriesProgress: updatedProgress } : prev))

        toast.success(
          `Series ${watched ? 'marked as watched' : 'unmarked'} (${result.episodesUpdated ?? allEpisodes.length} episodes)${result.traktSynced ? ' — synced to Trakt' : ''}`,
          { duration: 3000 }
        )
      } catch (e) {
        log.error('markSeriesWatched failed', e)
        toast.error('Failed to update series watched status')
      }
    },
    [data, id, profileId]
  )

  const handleToggleList = useCallback(async () => {
    if (!data?.meta || !profileId) return
    try {
      if (inList) {
        // Find which lists contain this item and remove from all
        const checkRes = await apiFetch(
          `/api/lists/check/${encodeURIComponent(data.meta.id)}?profileId=${profileId}`
        )
        if (checkRes.ok) {
          const { listIds } = (await checkRes.json()) as { listIds: number[] }
          await Promise.all(
            listIds.map((listId) =>
              apiFetch(`/api/lists/${listId}/items/${encodeURIComponent(data.meta.id)}`, {
                method: 'DELETE',
              })
            )
          )
        }
        setInList(false)
        toast.success('Removed from watchlist', { duration: 2500 })
      } else {
        // Find or use first list
        const listsRes = await apiFetch(`/api/lists?profileId=${profileId}`)
        if (!listsRes.ok) throw new Error('Failed to load lists')
        const { lists } = (await listsRes.json()) as { lists: Array<{ id: number; name: string }> }

        let targetListId: number
        if (lists.length > 0) {
          targetListId = lists[0].id
        } else {
          // Create a default watchlist
          const createRes = await apiFetch('/api/lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId: parseInt(profileId), name: 'Watchlist' }),
          })
          if (!createRes.ok) throw new Error('Failed to create watchlist')
          const { list } = (await createRes.json()) as { list: { id: number } }
          targetListId = list.id
        }

        await apiFetch(`/api/lists/${targetListId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metaId: data.meta.id,
            type: data.meta.type,
            title: data.meta.name,
            poster: data.meta.poster,
            imdbRating: data.meta.imdbRating,
          }),
        })
        setInList(true)
        toast.success(`Added to ${lists[0]?.name || 'Watchlist'}`, { duration: 2500 })
      }
    } catch (e) {
      log.error('toggleList failed', e)
      toast.error('Failed to update watchlist')
    }
  }, [data?.meta, inList, profileId])

  const handleDownloadStream = useCallback(
    async (streamIndex: number) => {
      if (!isTauri() || !canDownload || !data?.meta || !profileId) return
      const rawItem = rawStreamSource[streamIndex]
      if (!rawItem?.stream?.url) {
        toast.error('No downloadable URL for this stream')
        return
      }
      const { stream } = rawItem
      const addonId = rawItem.addon?.id || ''
      const quality = (localStorage.getItem('download_quality_pref') ||
        'standard') as DownloadQuality
      const isSeries = data.meta.type === 'series' && selectedEpisode != null

      const existing = downloadStore.downloads.find((d) => {
        if (d.mediaId !== data.meta.id) return false
        if (isSeries)
          return d.season === selectedEpisode!.season && d.episode === selectedEpisode!.episode
        return true
      })

      if (existing && ['queued', 'downloading', 'paused'].includes(existing.status)) {
        toast.info('Already downloading this item')
        return
      }

      if (existing?.status === 'completed') {
        toast('Already downloaded. Replace with this stream?', {
          action: { label: 'Replace', onClick: () => void startDownload() },
          duration: 6000,
        })
        return
      }

      async function startDownload() {
        if (existing) {
          try {
            await downloadService.delete(existing.id)
            downloadStore.removeDownload(existing.id)
          } catch {
            /* ignore */
          }
        }
        try {
          const dlId = await downloadService.start({
            profileId: profileId!,
            mediaType: data!.meta.type as 'movie' | 'series',
            mediaId: data!.meta.id,
            ...(isSeries
              ? {
                  episodeId: `${data!.meta.id}:${selectedEpisode!.season}:${selectedEpisode!.episode}`,
                  episodeTitle: selectedEpisode!.title,
                  season: selectedEpisode!.season,
                  episode: selectedEpisode!.episode,
                }
              : {}),
            title: data!.meta.name,
            posterPath: data!.meta.poster || '',
            streamUrl: stream.url || '',
            addonId,
            quality,
            subtitleUrls: (stream as any).subtitles,
          })
          downloadStore.addDownload({
            id: dlId,
            profileId: profileId!,
            mediaType: data!.meta.type as 'movie' | 'series',
            mediaId: data!.meta.id,
            ...(isSeries
              ? {
                  episodeId: `${data!.meta.id}:${selectedEpisode!.season}:${selectedEpisode!.episode}`,
                  episodeTitle: selectedEpisode!.title,
                  season: selectedEpisode!.season,
                  episode: selectedEpisode!.episode,
                }
              : {}),
            title: data!.meta.name,
            posterPath: data!.meta.poster || '',
            status: 'queued',
            progress: 0,
            quality,
            filePath: '',
            fileSize: 0,
            downloadedBytes: 0,
            addedAt: Date.now(),
            watchedPercent: 0,
            streamUrl: stream.url || '',
            addonId,
            smartDownload: false,
            autoDelete: false,
          })
          const label = isSeries
            ? `${data!.meta.name} S${selectedEpisode!.season}:E${selectedEpisode!.episode}`
            : data!.meta.name
          toast.success(`Downloading: ${label}`)
        } catch (e) {
          log.error('download start failed', e)
          toast.error('Failed to start download')
        }
      }

      await startDownload()
    },
    [canDownload, data, downloadStore, profileId, rawStreamSource, selectedEpisode]
  )

  return {
    status,
    profileId: profileId || '',
    metaType: type || '',
    metaId: id || '',
    errorMessage,
    canDownload,
    view,
    selectedSeason: selectedSeason ?? undefined,
    selectedEpisode: selectedEpisode ?? undefined,
    data: data || undefined,
    seasons,
    episodes,
    streams: streamItems,
    isLoadingStreams,
    isStreamsComplete,
    inList,
    genres,
    cast,
    director,
    streamDisplaySettings,
    navigation: {
      goBack: () => navigate(-1),
      playStream,
    },
    actions: {
      retry: loadDetails,
      setView,
      selectSeason: (season) => {
        setSelectedSeason(season)
        setView('episodes')
      },
      selectEpisode: handleSelectEpisode,
      playPrimary: handlePlayPrimary,
      refreshStreams: () => {
        if (selectedEpisode) {
          refreshStreams()
          return
        }
        loadStreams(undefined, undefined, false)
      },
      toggleWatched: handleToggleWatched,
      toggleSeasonWatched: handleToggleSeasonWatched,
      markSeriesWatched: handleMarkSeriesWatched,
      toggleList: handleToggleList,
      downloadStream: handleDownloadStream,
    },
  }
}
