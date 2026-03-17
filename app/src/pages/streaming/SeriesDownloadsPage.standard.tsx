import { ChevronLeft, Play, Trash2 } from 'lucide-react'
import type { SeriesDownloadsScreenModel } from './SeriesDownloadsPage.model'
import styles from '../../components/downloads/SeriesDownloads.module.css'

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '-'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function SeriesDownloadsStandardView({ model }: { model: SeriesDownloadsScreenModel }) {
  if (model.status !== 'ready' || !model.representative) {
    return null
  }

  return (
    <div className={styles.page}>
      {model.representative.posterPath ? (
        <div className={styles.backdrop} style={{ backgroundImage: `url(${model.representative.posterPath})` }} />
      ) : null}
      <div className={styles.backdropScrim} />

      <div className={styles.content}>
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={model.navigation.goBack}>
            <ChevronLeft size={20} />
            <span>Downloads</span>
          </button>
          <button
            className={`${styles.deleteAllBtn} ${model.confirmDeleteAll ? styles.deleteAllBtnConfirm : ''}`}
            onClick={() => void model.actions.handleDeleteAll()}
            disabled={model.deletingAll}
          >
            <Trash2 size={15} />
            {model.confirmDeleteAll ? 'Confirm delete all' : 'Delete all'}
          </button>
        </div>

        <div className={styles.header}>
          <div className={styles.headerPosterWrap}>
            {model.representative.posterPath ? (
              <img src={model.representative.posterPath} alt={model.representative.title} className={styles.headerPoster} />
            ) : (
              <div className={styles.headerPosterFallback}>{model.representative.title[0]}</div>
            )}
          </div>

          <div className={styles.headerInfo}>
            <h1 className={styles.headerTitle}>{model.representative.title}</h1>
            <div className={styles.headerStats}>
              <span>{model.completedCount} of {model.sortedEpisodes.length} downloaded</span>
              <span className={styles.headerDot}>·</span>
              <span>{model.seasons.length} season{model.seasons.length === 1 ? '' : 's'}</span>
              {model.totalBytes > 0 ? (
                <>
                  <span className={styles.headerDot}>·</span>
                  <span>{formatBytes(model.totalBytes)}</span>
                </>
              ) : null}
            </div>

            {model.completedCount > 0 ? (
              <div className={styles.headerProgressBar}>
                <div
                  className={styles.headerProgressFill}
                  style={{ width: `${(model.completedCount / model.sortedEpisodes.length) * 100}%` }}
                />
              </div>
            ) : null}

            {model.playNext ? (
              <button className={styles.playNextBtn} onClick={() => void model.navigation.playEpisode(model.playNext!)}>
                <Play size={16} fill="currentColor" />
                <span>
                  Play Next
                  {model.playNext.season != null && model.playNext.episode != null ? (
                    <span className={styles.playNextEp}> · S{model.playNext.season} E{model.playNext.episode}</span>
                  ) : null}
                  {model.playNext.episodeTitle ? (
                    <span className={styles.playNextEpTitle}> - {model.playNext.episodeTitle}</span>
                  ) : null}
                </span>
              </button>
            ) : null}
          </div>
        </div>

        <div className={styles.seasonList}>
          {model.seasons.map((seasonGroup) => (
            <div key={seasonGroup.season} className={styles.seasonSection}>
              <div className={styles.seasonHeader}>
                <span className={styles.seasonTitle}>Season {seasonGroup.season}</span>
                <span className={styles.seasonMeta}>
                  {seasonGroup.episodes.filter((episode) => episode.status === 'completed').length}/{seasonGroup.episodes.length} downloaded
                </span>
              </div>
              <div className={styles.seasonEpisodes}>
                {seasonGroup.episodes.map((episode) => (
                  <button
                    key={episode.id}
                    className={styles.episodeRow}
                    onClick={() => void model.navigation.playEpisode(episode)}
                  >
                    <div className={styles.episodeNum}>
                      {episode.episode != null ? `E${episode.episode}` : '-'}
                    </div>
                    <div className={styles.episodeInfo}>
                      <div className={styles.episodeTitle}>
                        {episode.episodeTitle || `Season ${episode.season}, Episode ${episode.episode}`}
                      </div>
                      <div className={styles.episodeMeta}>
                        <span className={styles.episodeQuality}>{episode.quality}</span>
                        <span className={styles.episodeSize}>{formatBytes(episode.fileSize || episode.downloadedBytes)}</span>
                      </div>
                    </div>
                    <div className={styles.episodeActions}>
                      <span className={styles.episodeBtn}>
                        <Play size={15} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SeriesDownloadsStandardView
