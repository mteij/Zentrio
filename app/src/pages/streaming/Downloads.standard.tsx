import { useQuery } from '@tanstack/react-query'
import { Download, Settings2, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DownloadCard } from '../../components/downloads/DownloadCard'
import { DownloadProgress } from '../../components/downloads/DownloadProgress'
import { SeriesGroup } from '../../components/downloads/SeriesGroup'
import { StoragePanel } from '../../components/downloads/StoragePanel'
import { buildAvatarUrl, sanitizeImgSrc } from '../../lib/url'
import type { DownloadsScreenModel } from './Downloads.model'
import styles from '../../components/downloads/Downloads.module.css'
import layoutStyles from '../../styles/Streaming.module.css'

export function StreamingDownloadsStandardView({ model }: { model: DownloadsScreenModel }) {
  // Read profile from cache populated by StreamingLayout (no extra fetch)
  const { data: profile } = useQuery<any>({
    queryKey: ['streaming-profile', model.profileId],
    enabled: false,
  })

  const profileAvatar = profile?.avatar ? (
    <img src={sanitizeImgSrc(buildAvatarUrl(profile.avatar, profile.avatar_style || 'bottts-neutral'))} alt="" />
  ) : (
    <User size={18} aria-hidden="true" />
  )

  if (model.platformIsTv && !model.canUseOfflineDownloads) {
    return (
      <div className={`${layoutStyles.streamingLayout} ${styles.downloadsPage}`}>
        <div className={styles.emptyState}>
          <Download size={56} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>Downloads are off on this TV</p>
          <p className={styles.emptyDesc}>
            This shared settings profile keeps offline downloads disabled on Android TV to avoid filling limited device storage.
          </p>
          <button className={styles.downloadsDoneBtn} onClick={model.navigation.goToSettings}>
            Open Settings
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {model.backdropPoster ? (
        <div className={layoutStyles.pageAmbientBackground} style={{ backgroundImage: `url(${model.backdropPoster})` }} />
      ) : null}
      <div className={`${layoutStyles.streamingLayout} ${styles.downloadsPage}`}>
        {/* Mobile-only sticky glass header */}
        <div className={styles.downloadsMobileBar}>
          <button
            className={styles.downloadsGearBtn}
            onClick={() => model.actions.setShowStorage(true)}
          >
            <Settings2 size={15} />
            Storage
          </button>
          <div style={{ flex: 1 }} />
          <Link
            to="/profiles"
            className={layoutStyles.streamingMobileProfileButton}
            aria-label="Switch profile"
            title="Switch Profile"
          >
            <div className={layoutStyles.streamingMobileProfileAvatar}>
              {profileAvatar}
            </div>
          </Link>
        </div>

        {/* Desktop header */}
        <div className={styles.downloadsHeader}>
          <h1 className={styles.downloadsTitle}>Downloads</h1>
          <button
            className={styles.downloadsGearBtn}
            onClick={() => model.actions.setShowStorage(true)}
          >
            <Settings2 size={15} />
            Storage &amp; Settings
          </button>
        </div>

        {!model.hasContent ? (
          <div className={styles.emptyState}>
            <Download size={56} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No downloads yet</p>
            <p className={styles.emptyDesc}>
              Tap the download icon on any movie or series to save it for offline viewing.
            </p>
          </div>
        ) : null}

        {(model.inProgress.length > 0 || model.failed.length > 0) ? (
          <>
            <div className={styles.sectionHeader}>
              In Progress
              <span className={styles.sectionCount}>{model.inProgress.length + model.failed.length}</span>
            </div>
            <div className={styles.progressList}>
              {[...model.inProgress, ...model.failed].map((record) => (
                <DownloadProgress key={record.id} record={record} onDelete={model.actions.removeDownload} />
              ))}
            </div>
          </>
        ) : null}

        {(model.completedMovies.length > 0 || model.seriesGroups.length > 0) ? (
          <>
            <div className={styles.sectionHeader}>
              Ready to Watch
              <span className={styles.sectionCount}>{model.completed.length}</span>
            </div>

            <div className={styles.cardList}>
              {model.seriesGroups.map(({ mediaId, episodes }) => (
                <SeriesGroup
                  key={mediaId}
                  episodes={episodes}
                  profileId={model.profileId}
                  onDelete={model.actions.removeDownload}
                />
              ))}

              {model.completedMovies.map((record) => (
                <DownloadCard
                  key={record.id}
                  record={record}
                  profileId={model.profileId}
                  onDelete={model.actions.removeDownload}
                />
              ))}
            </div>
          </>
        ) : null}

        {model.showStorage && model.profileId ? (
          <StoragePanel
            profileId={model.profileId}
            onClose={() => model.actions.setShowStorage(false)}
            onClear={model.actions.clearAll}
          />
        ) : null}
      </div>
    </>
  )
}

export default StreamingDownloadsStandardView
