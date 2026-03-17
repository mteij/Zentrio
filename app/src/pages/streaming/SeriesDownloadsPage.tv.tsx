import { Play, Trash2 } from 'lucide-react'
import { TvActionStrip, TvFocusItem, TvFocusZone, TvSection, TvShelf } from '../../components/tv'
import { sanitizeImgSrc } from '../../lib/url'
import type { SeriesDownloadsScreenModel } from './SeriesDownloadsPage.model'
import { StreamingTvScaffold } from './StreamingTvScaffold'
import styles from './SeriesDownloadsPage.tv.module.css'

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '-'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function SeriesDownloadsTvView({ model }: { model: SeriesDownloadsScreenModel }) {
  if (model.status !== 'ready' || !model.representative) {
    return (
      <StreamingTvScaffold
        profileId={model.profileId}
        activeNav="downloads"
        eyebrow="Downloads"
        title="Series download not found"
        description="This series is no longer available offline for the selected profile."
        initialZoneId="series-downloads-missing"
        onBack={model.navigation.goBack}
      >
        <TvSection title="Nothing to show">
          <TvShelf zoneId="series-downloads-missing" nextLeft="streaming-rail">
            <TvFocusItem id="series-downloads-missing-back" className={`${styles.card} ${styles.emptyCard}`} onActivate={model.navigation.goBack}>
              <p className={styles.cardTitle}>Return to downloads</p>
              <p className={styles.cardMeta}>Go back to the main downloads shelf and choose another title.</p>
            </TvFocusItem>
          </TvShelf>
        </TvSection>
      </StreamingTvScaffold>
    )
  }

  const activeSeason = model.seasons[0]

  return (
    <StreamingTvScaffold
      profileId={model.profileId}
      activeNav="downloads"
      eyebrow="Series Downloads"
      title={model.representative.title}
      description="Resume any saved episode directly from your local library."
      initialZoneId="series-downloads-actions"
      onBack={model.navigation.goBack}
      headerAside={(
        <div className={styles.posterHero}>
          {model.representative.posterPath ? (
            <div className={styles.poster} style={{ backgroundImage: `url(${sanitizeImgSrc(model.representative.posterPath)})` }} />
          ) : (
            <div className={`${styles.poster} ${styles.posterFallback}`}>{model.representative.title[0]}</div>
          )}
          <div className={styles.heroBody}>
            <div className={styles.heroStats}>
              <span>{model.completedCount} of {model.sortedEpisodes.length} downloaded</span>
              <span>{model.seasons.length} season{model.seasons.length === 1 ? '' : 's'}</span>
              {model.totalBytes > 0 ? <span>{formatBytes(model.totalBytes)}</span> : null}
            </div>
            <p className={styles.cardMeta}>Use the remote to jump into an episode or clear the whole local set.</p>
          </div>
        </div>
      )}
    >
      <TvSection title="Actions">
        <TvActionStrip zoneId="series-downloads-actions" nextLeft="streaming-rail" nextDown="series-downloads-episodes">
          {model.playNext ? (
            <TvFocusItem id="series-downloads-play-next" className={styles.card} onActivate={() => void model.navigation.playEpisode(model.playNext!)}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.cardTitle}>Play Next</p>
                  <p className={styles.cardMeta}>
                    S{model.playNext.season} E{model.playNext.episode}
                    {model.playNext.episodeTitle ? ` · ${model.playNext.episodeTitle}` : ''}
                  </p>
                </div>
                <span className={styles.badge}><Play size={16} /></span>
              </div>
            </TvFocusItem>
          ) : null}

          <TvFocusItem id="series-downloads-delete-all" className={styles.card} onActivate={() => void model.actions.handleDeleteAll()}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.cardTitle}>{model.confirmDeleteAll ? 'Confirm Delete All' : 'Delete All Downloads'}</p>
                <p className={styles.cardMeta}>Remove every downloaded episode for this series from local storage.</p>
              </div>
              <span className={styles.badge}><Trash2 size={16} /></span>
            </div>
          </TvFocusItem>
        </TvActionStrip>
      </TvSection>

      {activeSeason ? (
        <TvSection title={`Season ${activeSeason.season}`} subtitle="Episodes are ordered so you can move top-to-bottom with the remote.">
          <TvFocusZone id="series-downloads-episodes" orientation="vertical" nextLeft="streaming-rail" nextUp="series-downloads-actions">
            <div className={styles.episodeList}>
              {activeSeason.episodes.map((episode, index) => (
                <TvFocusItem
                  key={episode.id}
                  id={`series-downloads-episode-${episode.id}`}
                  index={index}
                  className={styles.episodeCard}
                  onActivate={() => void model.navigation.playEpisode(episode)}
                >
                  <div className={styles.episodeIndex}>{episode.episode != null ? `E${episode.episode}` : '-'}</div>
                  <div className={styles.episodeBody}>
                    <p className={styles.episodeTitle}>{episode.episodeTitle || `Season ${episode.season}, Episode ${episode.episode}`}</p>
                    <p className={styles.episodeMeta}>
                      {episode.quality} · {formatBytes(episode.fileSize || episode.downloadedBytes)}
                    </p>
                  </div>
                  <span className={styles.badge}><Play size={16} /></span>
                </TvFocusItem>
              ))}
            </div>
          </TvFocusZone>
        </TvSection>
      ) : null}
    </StreamingTvScaffold>
  )
}

export default SeriesDownloadsTvView
