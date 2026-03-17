import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useDownloads } from '../../hooks/useDownloads'
import { isTauri } from '../../lib/auth-client'
import { downloadService, type DownloadRecord } from '../../services/downloads/download-service'
import { useDownloadStore } from '../../stores/downloadStore'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('SeriesDownloadsScreenModel')

function inferMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'mp4':
    case 'm4v':
      return 'video/mp4'
    case 'webm':
      return 'video/webm'
    case 'mkv':
      return 'video/x-matroska'
    default:
      return 'video/mp4'
  }
}

async function buildPlaybackState(record: DownloadRecord) {
  let url = `file://${record.filePath}`
  let subtitles: Array<{ url: string; lang: string }> = []

  if (isTauri()) {
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    url = convertFileSrc(record.filePath)
    if (record.subtitlePaths?.length) {
      subtitles = record.subtitlePaths.map((subtitle) => ({
        url: convertFileSrc(subtitle.path),
        lang: subtitle.lang,
      }))
    }
  }

  return {
    stream: {
      url,
      ytId: '',
      type: inferMimeType(record.filePath),
      subtitles: subtitles.length > 0 ? subtitles : undefined,
    },
    meta: {
      id: record.mediaId,
      type: record.mediaType,
      name: record.title,
      poster: record.posterPath,
      season: record.season,
      episode: record.episode,
    },
  }
}

export interface SeriesDownloadsSeasonGroup {
  season: number
  episodes: DownloadRecord[]
}

export interface SeriesDownloadsScreenModel {
  status: 'loading' | 'ready' | 'missing'
  profileId: string
  mediaId: string
  deletingAll: boolean
  confirmDeleteAll: boolean
  representative?: DownloadRecord
  sortedEpisodes: DownloadRecord[]
  seasons: SeriesDownloadsSeasonGroup[]
  completedCount: number
  totalBytes: number
  playNext?: DownloadRecord
  navigation: {
    goBack: () => void
    playEpisode: (record: DownloadRecord) => Promise<void>
  }
  actions: {
    setConfirmDeleteAll: (value: boolean) => void
    handleDeleteAll: () => Promise<void>
    deleteEpisode: (id: string) => Promise<void>
  }
}

export function useSeriesDownloadsScreenModel(): SeriesDownloadsScreenModel {
  const { profileId, mediaId } = useParams<{ profileId: string; mediaId: string }>()
  const navigate = useNavigate()
  const removeDownload = useDownloadStore((state) => state.removeDownload)
  const downloads = useDownloadStore((state) => state.downloads)
  const [deletingAll, setDeletingAll] = useState(false)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)

  useDownloads(profileId)

  const sortedEpisodes = useMemo(() => {
    return downloads
      .filter((record) => record.profileId === profileId && record.mediaId === mediaId)
      .sort((a, b) => {
        const seasonA = a.season ?? 0
        const seasonB = b.season ?? 0
        if (seasonA !== seasonB) {
          return seasonA - seasonB
        }
        return (a.episode ?? 0) - (b.episode ?? 0)
      })
  }, [downloads, mediaId, profileId])

  const representative = sortedEpisodes[0]
  const completedEpisodes = sortedEpisodes.filter((episode) => episode.status === 'completed')
  const playNext = completedEpisodes.find((episode) => (episode.watchedPercent ?? 0) < 90)
  const totalBytes = sortedEpisodes.reduce((sum, episode) => sum + (episode.fileSize || episode.downloadedBytes || 0), 0)

  const seasons = useMemo<SeriesDownloadsSeasonGroup[]>(() => {
    const seasonMap = new Map<number, DownloadRecord[]>()
    for (const episode of sortedEpisodes) {
      const season = episode.season ?? 0
      const bucket = seasonMap.get(season) ?? []
      bucket.push(episode)
      seasonMap.set(season, bucket)
    }

    return Array.from(seasonMap.entries())
      .sort(([seasonA], [seasonB]) => seasonA - seasonB)
      .map(([season, episodes]) => ({ season, episodes }))
  }, [sortedEpisodes])

  const playEpisode = async (record: DownloadRecord) => {
    try {
      const playbackState = await buildPlaybackState(record)
      navigate(`/streaming/${profileId}/player`, { state: playbackState })
    } catch (error) {
      log.error('play episode error', error)
      toast.error('Failed to open downloaded file')
    }
  }

  const deleteEpisode = async (id: string) => {
    try {
      await downloadService.delete(id)
      removeDownload(id)
    } catch (error) {
      log.error('delete episode error', error)
      toast.error('Failed to delete download')
    }
  }

  const handleDeleteAll = async () => {
    if (!confirmDeleteAll) {
      setConfirmDeleteAll(true)
      return
    }

    setDeletingAll(true)
    try {
      for (const episode of sortedEpisodes) {
        try {
          await downloadService.delete(episode.id)
        } catch {
          // Best-effort cleanup.
        }
        removeDownload(episode.id)
      }
      navigate(`/streaming/${profileId}/downloads`, { replace: true })
    } catch (error) {
      log.error('delete all error', error)
      toast.error('Failed to delete downloads')
    } finally {
      setDeletingAll(false)
      setConfirmDeleteAll(false)
    }
  }

  if (!profileId || !mediaId) {
    return {
      status: 'missing',
      profileId: profileId || '',
      mediaId: mediaId || '',
      deletingAll,
      confirmDeleteAll,
      sortedEpisodes: [],
      seasons: [],
      completedCount: 0,
      totalBytes: 0,
      navigation: {
        goBack: () => navigate(`/streaming/${profileId || ''}/downloads`),
        playEpisode,
      },
      actions: {
        setConfirmDeleteAll,
        handleDeleteAll,
        deleteEpisode,
      },
    }
  }

  if (sortedEpisodes.length === 0) {
    return {
      status: 'missing',
      profileId,
      mediaId,
      deletingAll,
      confirmDeleteAll,
      sortedEpisodes: [],
      seasons: [],
      completedCount: 0,
      totalBytes: 0,
      navigation: {
        goBack: () => navigate(`/streaming/${profileId}/downloads`, { replace: true }),
        playEpisode,
      },
      actions: {
        setConfirmDeleteAll,
        handleDeleteAll,
        deleteEpisode,
      },
    }
  }

  return {
    status: 'ready',
    profileId,
    mediaId,
    deletingAll,
    confirmDeleteAll,
    representative,
    sortedEpisodes,
    seasons,
    completedCount: completedEpisodes.length,
    totalBytes,
    playNext,
    navigation: {
      goBack: () => navigate(`/streaming/${profileId}/downloads`),
      playEpisode,
    },
    actions: {
      setConfirmDeleteAll,
      handleDeleteAll,
      deleteEpisode,
    },
  }
}
