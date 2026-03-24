import { Layout, StreamingRow, LazyCatalogRow, SkeletonHero, SkeletonRow, Hero, LoadErrorState } from '../../components'
import type { HomeScreenModel } from './Home.model'
import styles from '../../styles/Streaming.module.css'

export function StreamingHomeStandardView({ model }: { model: HomeScreenModel }) {
  if (model.status === 'loading') {
    return (
      <Layout title="Streaming" showHeader={false} showFooter={false}>
        <div className={styles.streamingLayout}>
          <SkeletonHero />
          <div className={styles.contentContainer}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </div>
      </Layout>
    )
  }

  if (model.status === 'error') {
    return (
      <LoadErrorState
        message={model.errorMessage || 'Failed to load, try again.'}
        onRetry={() => {
          void model.retry()
        }}
        isRetrying={model.isRetrying}
        onBack={model.navigation.goBack}
      />
    )
  }

  return (
    <Layout title="Streaming" showHeader={false} showFooter={false}>
      <div className={`${styles.streamingLayout} ${!model.shouldShowHero ? styles.streamingLayoutNoHero : ''}`}>
        {model.shouldShowHero ? (
          <Hero
            items={model.heroItems}
            profileId={model.profileId}
            showTrending={model.showTrendingHero}
            storageKey="homeHeroIndex"
          />
        ) : null}

        <div className={`${styles.contentContainer} ${!model.shouldShowHero ? styles.contentOffset : ''}`}>
          {model.historyRowItems.length > 0 ? (
            <StreamingRow
              title="Continue Watching"
              items={model.historyRowItems}
              profileId={model.profileId}
              showImdbRatings={model.showImdbRatings}
              showAgeRatings={model.showAgeRatings}
              isContinueWatching
            />
          ) : null}

          {model.catalogMetadata.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No content found. Please install some addons.</div>
          ) : (
            model.catalogMetadata.map((metadata, index) => (
              <LazyCatalogRow
                key={`${metadata.manifestUrl}-${metadata.catalog.type}-${metadata.catalog.id}`}
                metadata={metadata}
                profileId={model.profileId}
                showImdbRatings={model.showImdbRatings}
                showAgeRatings={model.showAgeRatings}
                priority={index < 1 ? 'eager' : 'lazy'}
              />
            ))
          )}
        </div>
      </div>
      {model.showFallbackToast ? (
        <script dangerouslySetInnerHTML={{ __html: `
            document.addEventListener('DOMContentLoaded', () => {
              if (window.addToast) {
                window.addToast('message', 'Default Addon Used', 'No addons were found for this profile, so we are using the default Cinemeta addon to provide content.');
              }
            });
        ` }}
        />
      ) : null}
    </Layout>
  )
}

export default StreamingHomeStandardView
