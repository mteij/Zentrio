import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useDownloads } from '../../hooks/useDownloads'
import { useOfflineDownloadCapability } from '../../hooks/useOfflineDownloadCapability'
import { isTauri } from '../../lib/auth-client'
import { getPlatformCapabilities } from '../../lib/platform-capabilities'
import { downloadService, type DownloadRecord } from '../../services/downloads/download-service'
import { useDownloadStore } from '../../stores/downloadStore'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('Downloads')

function groupSeriesEpisodes(records: DownloadRecord[]): Map<string, DownloadRecord[]> {
  const groups = new Map<string, DownloadRecord[]>()
  for (const record of records) {
    const existing = groups.get(record.mediaId) ?? []
    existing.push(record)
    groups.set(record.mediaId, existing)
  }
  return groups
}

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
    case 'mov':
      return 'video/quicktime'
    case 'm3u8':
      return 'application/vnd.apple.mpegurl'
    case 'ts':
      return 'video/mp2t'
    default:
      return 'video/mp4'
  }
}

export interface DownloadsScreenModel {
  profileId: string
  platformIsTv: boolean
  canUseOfflineDownloads: boolean
  showStorage: boolean
  inProgress: DownloadRecord[]
  completed: DownloadRecord[]
  failed: DownloadRecord[]
  completedMovies: DownloadRecord[]
  seriesGroups: Array<{ mediaId: string; episodes: DownloadRecord[] }>
  hasContent: boolean
  backdropPoster?: string
  navigation: {
    goBack: () => void
    goToSettings: () => void
    goToSeries: (mediaId: string) => void
    goToPlayer: (record: DownloadRecord) => void
  }
  actions: {
    setShowStorage: (value: boolean) => void
    clearAll: () => void
    removeDownload: (id: string) => void
    deleteDownload: (id: string) => Promise<void>
  }
}

export function useDownloadsScreenModel(): DownloadsScreenModel {
  const { profileId } = useParams<{ profileId: string }>()
  const navigate = useNavigate()
  const { inProgress, completed, failed } = useDownloads(profileId)
  const { removeDownload, setDownloads } = useDownloadStore()
  const [showStorage, setShowStorage] = useState(false)
  const { isAvailable: canUseOfflineDownloads } = useOfflineDownloadCapability(profileId)
  const platform = getPlatformCapabilities()

  const completedMovies = useMemo(() => completed.filter((record) => record.mediaType === 'movie'), [completed])
  const seriesGroups = useMemo(
    () => Array.from(groupSeriesEpisodes(completed.filter((record) => record.mediaType === 'series')).entries()).map(([mediaId, episodes]) => ({ mediaId, episodes })),
    [completed],
  )

  const backdropPoster = completed[0]?.posterPath ?? inProgress[0]?.posterPath ?? failed[0]?.posterPath

  return {
    profileId: profileId || '',
    platformIsTv: platform.isTv,
    canUseOfflineDownloads,
    showStorage,
    inProgress,
    completed,
    failed,
    completedMovies,
    seriesGroups,
    hasContent: inProgress.length > 0 || completed.length > 0 || failed.length > 0,
    backdropPoster,
    navigation: {
      goBack: () => {
        if (window.history.length > 1) {
          navigate(-1)
          return
        }
        navigate(profileId ? `/streaming/${profileId}` : '/profiles')
      },
      goToSettings: () => navigate('/settings'),
      goToSeries: (mediaId) => navigate(`/streaming/${profileId}/downloads/${mediaId}`),
      goToPlayer: async (record) => {
        try {
          let resolvedFileUrl = `file://${record.filePath}`
          let subtitles: Array<{ url: string; lang: string }> = []

          if (isTauri()) {
            const { convertFileSrc } = await import('@tauri-apps/api/core')
            resolvedFileUrl = convertFileSrc(record.filePath)

            if (record.subtitlePaths && record.subtitlePaths.length > 0) {
              subtitles = record.subtitlePaths.map((subtitle) => ({
                url: convertFileSrc(subtitle.path),
                lang: subtitle.lang,
              }))
            }
          }

          navigate(`/streaming/${profileId}/player`, {
            state: {
              stream: {
                url: resolvedFileUrl,
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
            },
          })
        } catch (error) {
          log.error('play download error', error)
          toast.error('Failed to open downloaded file')
        }
      },
    },
    actions: {
      setShowStorage,
      clearAll: () => setDownloads([]),
      removeDownload,
      deleteDownload: async (id) => {
        try {
          await downloadService.delete(id)
          removeDownload(id)
        } catch (error) {
          log.error('delete error', error)
          toast.error('Failed to delete download')
        }
      },
    },
  }
}
