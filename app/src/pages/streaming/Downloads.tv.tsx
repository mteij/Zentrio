import { Download } from 'lucide-react'
import { TvFocusItem, TvGrid, TvSection, TvShelf } from '../../components/tv'
import { sanitizeImgSrc } from '../../lib/url'
import type { DownloadsScreenModel } from './Downloads.model'
import { StreamingTvScaffold } from './StreamingTvScaffold'
import styles from './Downloads.tv.module.css'

export function StreamingDownloadsTvView({ model }: { model: DownloadsScreenModel }) {
  if (!model.canUseOfflineDownloads) {
    return (
      <StreamingTvScaffold
        profileId={model.profileId}
        activeNav="downloads"
        eyebrow="Downloads"
        title="Downloads are off on this TV"
        description="This shared settings profile keeps offline downloads disabled on Android TV to avoid filling limited device storage."
        initialZoneId="downloads-disabled"
        onBack={model.navigation.goBack}
      >
        <TvSection
          title="Offline policy"
          subtitle="Open settings if you want to change the TV download policy."
        >
          <TvShelf zoneId="downloads-disabled" nextLeft="streaming-rail">
            <TvFocusItem
              id="downloads-disabled-settings"
              className={styles.statusCard}
              onActivate={model.navigation.goToSettings}
            >
              <p className={styles.statusTitle}>Open Settings</p>
              <p className={styles.statusMeta}>
                Review shared download policy and storage settings.
              </p>
            </TvFocusItem>
          </TvShelf>
        </TvSection>
      </StreamingTvScaffold>
    )
  }

  return (
    <StreamingTvScaffold
      profileId={model.profileId}
      activeNav="downloads"
      eyebrow="Downloads"
      title="Offline Library"
      description="Quickly resume saved movies and episodes, or monitor downloads still in progress."
      initialZoneId={model.completedMovies[0] ? 'downloads-ready' : 'downloads-progress'}
      onBack={model.navigation.goBack}
    >
      {model.inProgress.length > 0 || model.failed.length > 0 ? (
        <TvSection title="In Progress" subtitle="Current downloads and failed transfers.">
          <TvShelf zoneId="downloads-progress" nextLeft="streaming-rail" nextDown="downloads-ready">
            {[...model.inProgress, ...model.failed].map((record, index) => (
              <TvFocusItem
                key={record.id}
                id={`downloads-progress-${record.id}`}
                index={index}
                className={styles.statusCard}
              >
                <p className={styles.statusTitle}>{record.title}</p>
                <p className={styles.statusMeta}>
                  {record.status} · {Math.round(record.progress)}%
                </p>
              </TvFocusItem>
            ))}
          </TvShelf>
        </TvSection>
      ) : null}

      {model.completedMovies.length > 0 || model.seriesGroups.length > 0 ? (
        <TvSection
          title="Ready to Watch"
          subtitle="Open series groups or play downloaded movies right away."
        >
          <TvGrid
            zoneId="downloads-ready"
            columns={4}
            nextLeft="streaming-rail"
            nextUp="downloads-progress"
          >
            {model.seriesGroups.map(({ mediaId, episodes }, index) => (
              <TvFocusItem
                key={mediaId}
                id={`downloads-series-${mediaId}`}
                index={index}
                className={styles.card}
                onActivate={() => {
                  if (episodes[0]) void model.navigation.goToPlayer(episodes[0])
                }}
              >
                <div
                  className={styles.poster}
                  style={{
                    backgroundImage: `url(${sanitizeImgSrc(episodes[0]?.posterPath || '')})`,
                  }}
                />
                <div className={styles.body}>
                  <p className={styles.title}>{episodes[0]?.title || 'Series'}</p>
                  <p className={styles.meta}>
                    {episodes.length} episode{episodes.length === 1 ? '' : 's'} downloaded
                  </p>
                </div>
              </TvFocusItem>
            ))}

            {model.completedMovies.map((record, index) => (
              <TvFocusItem
                key={record.id}
                id={`downloads-movie-${record.id}`}
                index={index + model.seriesGroups.length}
                className={styles.card}
                onActivate={() => model.navigation.goToPlayer(record)}
              >
                <div
                  className={styles.poster}
                  style={{ backgroundImage: `url(${sanitizeImgSrc(record.posterPath || '')})` }}
                />
                <div className={styles.body}>
                  <p className={styles.title}>{record.title}</p>
                  <p className={styles.meta}>{record.quality} · downloaded</p>
                </div>
              </TvFocusItem>
            ))}
          </TvGrid>
        </TvSection>
      ) : (
        <TvSection
          title="No downloads yet"
          subtitle="Download a movie or series episode to make it appear here."
        >
          <TvShelf zoneId="downloads-empty" nextLeft="streaming-rail">
            <TvFocusItem
              id="downloads-empty-settings"
              className={styles.statusCard}
              onActivate={model.navigation.goToSettings}
            >
              <Download size={26} />
              <p className={styles.statusTitle}>Nothing saved offline yet</p>
              <p className={styles.statusMeta}>
                Use the download action on a stream or open settings to check storage.
              </p>
            </TvFocusItem>
          </TvShelf>
        </TvSection>
      )}
    </StreamingTvScaffold>
  )
}

export default StreamingDownloadsTvView
