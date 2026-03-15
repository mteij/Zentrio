import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Youtube, Check, List, Eye, EyeOff, Download, CheckCircle, Loader, ChevronLeft, Info } from 'lucide-react'
import { toast } from 'sonner'
import { DropdownMenu } from '../../components/ui/DropdownMenu'
import { QualityPicker } from '../downloads/QualityPicker'
import { downloadService, DownloadQuality } from '../../services/downloads/download-service'
import { useDownloadForMedia } from '../../hooks/useDownloads'
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
  /** Called when back is tapped while in series stream view — goes back to episode list */
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
  onBackFromStreams,
  children,
}: DetailsHeaderProps) {
  const navigate = useNavigate()
  const [showQualityPicker, setShowQualityPicker] = useState(false)
  const [resolvingDownloadStream, setResolvingDownloadStream] = useState(false)
  const existingDownload = useDownloadForMedia(meta.id)
  const addDownload = useDownloadStore((s) => s.addDownload)

  // Warm a fresh top stream for movie downloads in the background.
  useEffect(() => {
    if (meta.type !== 'movie' || !profileId) return
    const cached = readCachedTopStream(meta.id)
    if (cached && !cached.stale) return
    void resolveTopStream({
      profileId,
      mediaType: meta.type,
      mediaId: meta.id,
      forceRefresh: Boolean(cached),
    })
  }, [meta.id, meta.type, profileId])

  const handleDownload = async (quality: DownloadQuality) => {
    setShowQualityPicker(false)
    if (!meta || !profileId) return

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
        quality,
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
        quality,
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

  // Season / episode counts for series
  const seasonCount = meta.type === 'series' && meta.videos
    ? new Set(meta.videos.map((v: any) => v.season).filter(Boolean)).size
    : 0
  const episodeCount = meta.type === 'series' && meta.videos ? meta.videos.length : 0

  // Filter out age-rating genres that creep into the genre list
  const genres = meta.genres
    ?.filter(g => !['PG', 'PG-13', 'R', 'NC-17', 'G', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG',
      'TV-14', 'TV-MA', 'NR', 'UR', '12', '12A', '15', '18', 'U', 'R13', 'R16',
      'R18', 'M', 'MA15+', 'R18+', '6', '9', '16'].includes(g))
    .slice(0, 4)
    .join(' · ')

  const dlStatus = existingDownload?.status

  return (
    <>
      {/* Full-page ambient background */}
      <div className={styles.page}>
        <div
          className={styles.backdrop}
          style={{ backgroundImage: `url(${meta.background || meta.poster})` }}
        />
        <div className={styles.backdropScrim} />

        <div className={styles.content}>
          {/* Top bar */}
          <div className={styles.topBar}>
            <button className={styles.backBtn} onClick={handleBack}>
              <ChevronLeft size={20} />
              {meta.type === 'series' && view === 'streams' ? 'Episodes' : 'Back'}
            </button>
          </div>

          {/* Compact header — always visible */}
          <div className={styles.header}>
            {/* Small poster */}
            <div className={styles.posterWrap}>
              {meta.poster ? (
                <img src={meta.poster} alt={meta.name} className={styles.poster} />
              ) : (
                <div className={styles.posterFallback}>{meta.name[0]}</div>
              )}
            </div>

            {/* Info */}
            <div className={styles.headerInfo}>
              {meta.logo ? (
                <img src={meta.logo} alt={meta.name} className={styles.logo} />
              ) : (
                <h1 className={styles.title}>{meta.name}</h1>
              )}

              {/* Metadata badges */}
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
                {/* @ts-expect-error */}
                {showAgeRatings && (meta.certification || meta.rating || meta.contentRating) && (
                  <span className={`${styles.metaBadge} ${styles.metaBadgeRating}`}>
                    {/* @ts-expect-error */}
                    {meta.certification || meta.rating || meta.contentRating}
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

              {/* Action buttons */}
              <div className={styles.actions}>
                {/* Play — movies only (series uses EpisodeList quick-play) */}
                {meta.type === 'movie' && (
                  <button className={styles.playBtn} onClick={onMoviePlay}>
                    <Play size={17} fill="currentColor" />
                    Play
                  </button>
                )}

                {/* Download — movies only in Phase 1 */}
                {meta.type === 'movie' && (() => {
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
                        Downloading…
                      </button>
                    )
                  }
                  if (resolvingDownloadStream) {
                    return (
                      <button className={`${styles.downloadBtn} ${styles.downloadBtnActive}`} disabled>
                        <Loader size={15} className="animate-spin" />
                        Resolving…
                      </button>
                    )
                  }
                  return (
                    <button
                      className={styles.downloadBtn}
                      onClick={() => setShowQualityPicker(true)}
                      title="Download for offline viewing"
                    >
                      <Download size={15} />
                      Download
                    </button>
                  )
                })()}

                {/* Trailer */}
                {meta.trailerStreams && meta.trailerStreams.length > 0 && (
                  <button
                    className={styles.iconBtn}
                    onClick={() => {
                      const trailer = meta.trailerStreams![0]
                      const stream = { ytId: trailer.ytId }
                      const trailerMeta = {
                        id: meta.id,
                        type: meta.type,
                        name: `${meta.name} — Trailer`,
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

                {/* Add to list */}
                <button
                  className={`${styles.iconBtn} ${inList ? styles.iconBtnActive : ''}`}
                  onClick={onShowListModal}
                  title={inList ? 'Manage Lists (Added)' : 'Add to List'}
                >
                  {inList ? <Check size={17} /> : <List size={17} />}
                </button>

                {/* Three-dot menu */}
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

              {/* Genres */}
              {genres && <p className={styles.genres}>{genres}</p>}

              {/* Description */}
              {meta.description && (
                <p className={styles.description}>{meta.description}</p>
              )}
            </div>
          </div>

          {/* Children: EpisodeList or StreamSelector */}
          {children}
        </div>
      </div>

      {/* Quality picker modal */}
      {showQualityPicker && (
        <QualityPicker
          title={meta.name}
          onConfirm={handleDownload}
          onClose={() => setShowQualityPicker(false)}
        />
      )}
    </>
  )
}
