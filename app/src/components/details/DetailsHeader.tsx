import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, CheckCircle, ChevronLeft, Download, Eye, EyeOff, Info, List, Loader, Play, Youtube } from 'lucide-react'
import { toast } from 'sonner'
import { DropdownMenu } from '../../components/ui/DropdownMenu'
import { useDownloadForMedia } from '../../hooks/useDownloads'
import { downloadService, DownloadQuality } from '../../services/downloads/download-service'
import { useDownloadStore } from '../../stores/downloadStore'
import { getTopStream, readCachedTopStream, resolveTopStream } from '../../lib/topStreamCache'
import styles from './Details.module.css'
import type { MetaDetail } from '../../services/addons/types'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('DetailsHeader')

interface DetailsHeaderProps {
  meta: MetaDetail
  data: any
  profileId: string
  view: 'details' | 'episodes' | 'streams'
  showImdbRatings: boolean
  showAgeRatings: boolean
  onMoviePlay: () => void
  onShowListModal: () => void
  inList: boolean
  onShowInfoModal: () => void
  onToggleWatched: () => void
  onMarkSeriesWatched: (watched: boolean) => void
  canDownload: boolean
  onBackFromStreams?: () => void
  children?: React.ReactNode
}

export function DetailsHeader({
  meta,
  data,
  profileId,
  view,
  showImdbRatings,
  showAgeRatings,
  onMoviePlay,
  onShowListModal,
  inList,
  onShowInfoModal,
  onToggleWatched,
  onMarkSeriesWatched,
  canDownload,
  onBackFromStreams,
  children,
}: DetailsHeaderProps) {
  const navigate = useNavigate()
  const [resolvingDownloadStream, setResolvingDownloadStream] = useState(false)
  const existingDownload = useDownloadForMedia(meta.id)
  const addDownload = useDownloadStore((s) => s.addDownload)

  useEffect(() => {
    if (!canDownload || meta.type !== 'movie' || !profileId) return
    const cached = readCachedTopStream(meta.id)
    if (cached && !cached.stale) return

    void resolveTopStream({
      profileId,
      mediaType: meta.type,
      mediaId: meta.id,
      forceRefresh: Boolean(cached),
    })
  }, [canDownload, meta.id, meta.type, profileId])

  const handleDownload = async (quality?: DownloadQuality) => {
    if (!canDownload || !profileId) return
    const resolvedQuality: DownloadQuality = quality ?? ((localStorage.getItem('download_quality_pref') || 'standard') as DownloadQuality)

    try {
      setResolvingDownloadStream(true)
      const stream = await getTopStream({
        profileId: profileId.toString(),
        mediaType: meta.type,
        mediaId: meta.id,
      })

      if (!stream) {
        toast.error('Could not resolve a stream yet. Please try again in a moment.')
        return
      }

      const id = await downloadService.start({
        profileId: profileId.toString(),
        mediaType: meta.type as 'movie' | 'series',
        mediaId: meta.id,
        title: meta.name,
        posterPath: meta.poster || '',
        streamUrl: stream.url || '',
        addonId: stream.addonId || '',
        quality: resolvedQuality,
        subtitleUrls: stream.subtitles,
      })

      addDownload({
        id,
        profileId: profileId.toString(),
        mediaType: meta.type as 'movie' | 'series',
        mediaId: meta.id,
        title: meta.name,
        posterPath: meta.poster || '',
        status: 'queued',
        progress: 0,
        quality: resolvedQuality,
        filePath: '',
        fileSize: 0,
        downloadedBytes: 0,
        addedAt: Date.now(),
        watchedPercent: 0,
        streamUrl: stream.url || '',
        addonId: stream.addonId || '',
        smartDownload: false,
        autoDelete: false,
      })
      toast.success(`Downloading: ${meta.name}`)
    } catch (e) {
      log.error('download start failed', e)
      toast.error('Failed to start download')
    } finally {
      setResolvingDownloadStream(false)
    }
  }

  const handleBack = () => {
    if (meta.type === 'series' && view === 'streams' && onBackFromStreams) {
      onBackFromStreams()
    } else {
      navigate(-1)
    }
  }

  const seasonCount = meta.type === 'series' && meta.videos
    ? new Set(meta.videos.map((v: any) => v.season).filter(Boolean)).size
    : 0
  const episodeCount = meta.type === 'series' && meta.videos ? meta.videos.length : 0

  const genres = meta.genres
    ?.filter(g => !['PG', 'PG-13', 'R', 'NC-17', 'G', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG',
      'TV-14', 'TV-MA', 'NR', 'UR', '12', '12A', '15', '18', 'U', 'R13', 'R16',
      'R18', 'M', 'MA15+', 'R18+', '6', '9', '16'].includes(g))
    .slice(0, 4)
    .join(' · ')

  const dlStatus = existingDownload?.status
  const ageRating = (meta as any).certification || (meta as any).rating || (meta as any).contentRating
  const backdropImage = meta.poster || meta.background
  const summaryContent = (
    <>
      {genres && <p className={styles.genres}>{genres}</p>}
      {meta.description && (
        <p className={styles.description}>{meta.description}</p>
      )}
    </>
  )

  return (
    <>
      <div className={styles.page}>
        <div
          className={styles.backdrop}
          style={{ backgroundImage: `url(${backdropImage})` }}
        />
        <div className={styles.backdropScrim} />

        <div className={styles.content}>
          <div className={styles.topBar}>
            <button className={styles.backBtn} onClick={handleBack}>
              <ChevronLeft size={20} />
              {meta.type === 'series' && view === 'streams' ? 'Episodes' : 'Back'}
            </button>
          </div>

          <div className={styles.header}>
            <div className={styles.headerAside}>
              <div className={styles.posterWrap}>
                {meta.poster ? (
                  <img src={meta.poster} alt={meta.name} className={styles.poster} />
                ) : (
                  <div className={styles.posterFallback}>{meta.name[0]}</div>
                )}
              </div>
            </div>

            <div className={styles.headerInfo}>
              {meta.logo ? (
                <img src={meta.logo} alt={meta.name} className={styles.logo} />
              ) : (
                <h1 className={styles.title}>{meta.name}</h1>
              )}

              <div className={styles.metaRow}>
                {meta.released && (
                  <span className={styles.metaBadge}>{String(meta.released).split('-')[0]}</span>
                )}
                {meta.runtime && (
                  <span className={styles.metaBadge}>{meta.runtime}</span>
                )}
                {showImdbRatings && meta.imdbRating && (
                  <span className={`${styles.metaBadge} ${styles.metaBadgeImdb}`}>
                    IMDb {meta.imdbRating}
                  </span>
                )}
                {showAgeRatings && ageRating && (
                  <span className={`${styles.metaBadge} ${styles.metaBadgeRating}`}>
                    {ageRating}
                  </span>
                )}
                {seasonCount > 0 && (
                  <span className={styles.metaBadge}>
                    {seasonCount} Season{seasonCount !== 1 ? 's' : ''}
                  </span>
                )}
                {episodeCount > 0 && (
                  <span className={styles.metaBadge}>
                    {episodeCount} Episode{episodeCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className={styles.actions}>
                {meta.type === 'movie' && (
                  <button className={styles.playBtn} onClick={onMoviePlay}>
                    <Play size={17} fill="currentColor" />
                    Play
                  </button>
                )}

                {canDownload && meta.type === 'movie' && (() => {
                  if (dlStatus === 'completed') {
                    return (
                      <button className={`${styles.downloadBtn} ${styles.downloadBtnDone}`} disabled>
                        <CheckCircle size={15} />
                        Downloaded
                      </button>
                    )
                  }

                  if (dlStatus === 'downloading' || dlStatus === 'queued') {
                    return (
                      <button className={`${styles.downloadBtn} ${styles.downloadBtnActive}`} disabled>
                        <Loader size={15} className="animate-spin" />
                        Downloading...
                      </button>
                    )
                  }

                  if (resolvingDownloadStream) {
                    return (
                      <button className={`${styles.downloadBtn} ${styles.downloadBtnActive}`} disabled>
                        <Loader size={15} className="animate-spin" />
                        Resolving...
                      </button>
                    )
                  }

                  return (
                    <button
                      className={styles.downloadBtn}
                      onClick={() => { void handleDownload() }}
                      title="Download for offline viewing"
                    >
                      <Download size={15} />
                      Download
                    </button>
                  )
                })()}

                {meta.trailerStreams && meta.trailerStreams.length > 0 && (
                  <button
                    className={styles.iconBtn}
                    onClick={() => {
                      const trailer = meta.trailerStreams![0]
                      const stream = { ytId: trailer.ytId }
                      const trailerMeta = {
                        id: meta.id,
                        type: meta.type,
                        name: `${meta.name} - Trailer`,
                        poster: meta.poster,
                      }
                      navigate(
                        `/streaming/${profileId}/player?stream=${encodeURIComponent(JSON.stringify(stream))}&meta=${encodeURIComponent(JSON.stringify(trailerMeta))}`
                      )
                    }}
                    title="Watch Trailer"
                  >
                    <Youtube size={17} />
                  </button>
                )}

                <button
                  className={`${styles.iconBtn} ${inList ? styles.iconBtnActive : ''}`}
                  onClick={onShowListModal}
                  title={inList ? 'Manage Lists (Added)' : 'Add to List'}
                >
                  {inList ? <Check size={17} /> : <List size={17} />}
                </button>

                <DropdownMenu
                  items={[
                    ...(meta.app_extras?.cast || meta.director
                      ? [{ label: 'Cast & Crew', icon: Info, onClick: onShowInfoModal }]
                      : []),
                    ...(meta.type === 'movie'
                      ? [{
                          label: data.watchProgress?.isWatched ? 'Mark as unwatched' : 'Mark as watched',
                          icon: data.watchProgress?.isWatched ? EyeOff : Eye,
                          onClick: onToggleWatched,
                        }]
                      : [
                          { label: 'Mark series as watched', icon: Eye, onClick: () => onMarkSeriesWatched(true) },
                          { label: 'Mark series as unwatched', icon: EyeOff, onClick: () => onMarkSeriesWatched(false) },
                        ]),
                  ]}
                />
              </div>

              <div className={`${styles.summaryBlock} ${styles.summaryMobile}`}>
                {summaryContent}
              </div>
            </div>
          </div>

          <div className={`${styles.summaryBlock} ${styles.summaryDesktop}`}>
            {summaryContent}
          </div>

          {children}
        </div>
      </div>
    </>
  )
}
