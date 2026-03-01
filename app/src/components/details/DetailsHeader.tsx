// Details Header Component
// Extracted from Details.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Youtube, Check, List, Info, Eye, EyeOff, Download, CheckCircle, Loader } from 'lucide-react'
import { DropdownMenu } from '../../components/ui/DropdownMenu'
import { QualityPicker } from '../downloads/QualityPicker'
import { downloadService, DownloadQuality } from '../../services/downloads/download-service'
import { useDownloadForMedia } from '../../hooks/useDownloads'
import dlStyles from '../downloads/Downloads.module.css'
import styles from '../../styles/Streaming.module.css'
import type { MetaDetail } from '../../services/addons/types'

interface DetailsHeaderProps {
  meta: MetaDetail
  data: any // Using specific type would be better if exported from Details.tsx
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
  children
}: DetailsHeaderProps) {
  const navigate = useNavigate()
  const [showQualityPicker, setShowQualityPicker] = useState(false)
  const existingDownload = useDownloadForMedia(meta.id)

  const handleDownload = async (quality: DownloadQuality) => {
    setShowQualityPicker(false)
    if (!meta || !profileId) return

    // Pull the top stream URL from the page's loaded streams (stored in sessionStorage by StreamSelector)
    const streamJson = sessionStorage.getItem(`top_stream_${meta.id}`)
    if (!streamJson) {
      // Stream not resolved yet; user needs to open the stream selector first
      import('sonner').then(({ toast }) => toast.info('Open a stream first, then download it.'))
      return
    }

    try {
      const stream = JSON.parse(streamJson)
      await downloadService.start({
        profileId: profileId.toString(),
        mediaType: meta.type as 'movie' | 'series',
        mediaId: meta.id,
        title: meta.name,
        posterPath: meta.poster || '',
        streamUrl: stream.url || '',
        addonId: stream.addonId || '',
        quality,
      })
      import('sonner').then(({ toast }) => toast.success(`Downloading: ${meta.name}`))
    } catch (e) {
      console.error('[DetailsHeader] download start failed', e)
      import('sonner').then(({ toast }) => toast.error('Failed to start download'))
    }
  }

  return (
    <>
      <div className={styles.pageAmbientBackground} style={{
        backgroundImage: `url(${meta.background || meta.poster})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}></div>

      <div className={styles.detailsContent}>
        <div className={styles.detailsPoster}>
          {meta.poster ? (
            <img src={meta.poster} alt={meta.name} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {meta.name}
            </div>
          )}
        </div>

        <div className={styles.detailsInfo}>
          {/* Hide metadata only for series when viewing streams (since movies show streams as main page) */}
          {!(meta.type === 'series' && view === 'streams') && (
            <>
              {/* TMDB styled title banner (logo) when available, otherwise text title */}
              {meta.logo ? (
                <img 
                  src={meta.logo} 
                  alt={meta.name} 
                  className={styles.detailsLogo}
                />
              ) : (
                <h1 className={styles.detailsTitle}>{meta.name}</h1>
              )}
              
              <div className={styles.detailsMetaRow}>
                {meta.released && <span className={styles.metaBadge}>{String(meta.released).split('-')[0]}</span>}
                {meta.runtime && <span className={styles.metaBadge}>{meta.runtime}</span>}
                {showImdbRatings && meta.imdbRating && <span className={styles.metaBadge} style={{ background: '#f5c518', color: '#000' }}>IMDb {meta.imdbRating}</span>}
                {/* @ts-expect-error */}
                {showAgeRatings && (meta.certification || meta.rating || meta.contentRating) && <span className={styles.metaBadge} style={{ border: '1px solid #fff' }}>{(meta.certification || meta.rating || meta.contentRating)}</span>}
              </div>

              <div className={styles.detailsActions}>
                {/* Primary Play button */}
                {meta.type === 'movie' && (
                    <button className={`${styles.actionBtn} ${styles.btnPrimaryGlass}`} onClick={onMoviePlay}>
                      <Play size={20} fill="currentColor" />
                      Play
                    </button>
                )}

                {/* Download button — movies only in Phase 1 */}
                {meta.type === 'movie' && (() => {
                  const dlStatus = existingDownload?.status
                  if (dlStatus === 'completed') {
                    return (
                      <button className={`${dlStyles.downloadBtn} ${dlStyles.downloadBtnDownloaded}`} disabled>
                        <CheckCircle size={16} />
                        Downloaded
                      </button>
                    )
                  }
                  if (dlStatus === 'downloading' || dlStatus === 'queued') {
                    return (
                      <button className={`${dlStyles.downloadBtn} ${dlStyles.downloadBtnActive}`} disabled>
                        <Loader size={16} className="animate-spin" />
                        Downloading…
                      </button>
                    )
                  }
                  return (
                    <button
                      className={dlStyles.downloadBtn}
                      onClick={() => setShowQualityPicker(true)}
                      title="Download for offline viewing"
                    >
                      <Download size={16} />
                      Download
                    </button>
                  )
                })()}
                
                {/* Icon buttons for secondary actions */}
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
                        poster: meta.poster
                      }
                      navigate(`/streaming/${profileId}/player?stream=${encodeURIComponent(JSON.stringify(stream))}&meta=${encodeURIComponent(JSON.stringify(trailerMeta))}`)
                    }}
                    title="Watch Trailer"
                  >
                    <Youtube size={20} />
                  </button>
                )}
                
                <button
                  className={styles.iconBtn}
                  onClick={onShowListModal}
                  title={inList ? "Manage Lists (Added)" : "Add to List"}
                >
                  {inList ? <Check size={20} className="text-green-500" /> : <List size={20} />}
                </button>
                
                {/* Three-dot menu for additional actions */}
                <DropdownMenu
                  items={[
                    // Cast & Crew option (if available)
                    ...(meta.app_extras?.cast || meta.director ? [{
                      label: 'Cast & Crew',
                      icon: Info,
                      onClick: onShowInfoModal
                    }] : []),
                    // Watch status options
                    ...(meta.type === 'movie' ? [
                      {
                        label: data.watchProgress?.isWatched ? 'Mark as unwatched' : 'Mark as watched',
                        icon: data.watchProgress?.isWatched ? EyeOff : Eye,
                        onClick: onToggleWatched
                      }
                    ] : [
                      {
                        label: 'Mark series as watched',
                        icon: Eye,
                        onClick: () => onMarkSeriesWatched(true)
                      },
                      {
                        label: 'Mark series as unwatched',
                        icon: EyeOff,
                        onClick: () => onMarkSeriesWatched(false)
                      }
                    ])
                  ]}
                />
              </div>

              {/* Genres inline with description */}
              {meta.genres && meta.genres.length > 0 && (
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginBottom: '12px' }}>
                  {meta.genres
                    .filter(genre => !['PG', 'PG-13', 'R', 'NC-17', 'G', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA', 'NR', 'UR', '12', '12A', '15', '18', 'U', 'R13', 'R16', 'R18', 'M', 'MA15+', 'R18+', '6', '9', '16'].includes(genre))
                    .slice(0, 4)
                    .join(' • ')}
                </p>
              )}

              <p className={styles.detailsDescription}>{meta.description}</p>
            </>
          )}

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
