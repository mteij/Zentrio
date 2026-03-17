import { Info, Play } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { LoadErrorState, LoadingSpinner } from '../../components'
import { TvActionStrip, TvFocusItem, TvMediaShelf } from '../../components/tv'
import { fetchCatalogItems } from '../../lib/catalog-items'
import { sanitizeImgSrc } from '../../lib/url'
import type { HomeScreenModel, HomeTvItem } from './Home.model'
import { StreamingTvScaffold } from './StreamingTvScaffold'
import styles from './Home.tv.module.css'

export function StreamingHomeTvView({ model }: { model: HomeScreenModel }) {
  if (model.status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (model.status === 'error') {
    return (
      <LoadErrorState
        message={model.errorMessage || 'Failed to load TV home.'}
        onRetry={() => {
          void model.retry()
        }}
        isRetrying={model.isRetrying}
        onBack={model.navigation.goBack}
      />
    )
  }

  const hasContinueWatching = model.continueWatchingItems.length > 0
  const hasHero = model.shouldShowHero && !!model.heroItem
  const firstCatalog = model.catalogMetadata[0]
  const firstCatalogZoneId = firstCatalog ? `home-catalog-${firstCatalog.catalog.type}-${firstCatalog.catalog.id}` : undefined
  const initialZoneId = hasHero ? 'home-hero-actions' : hasContinueWatching ? 'home-continue' : firstCatalogZoneId || 'streaming-rail'
  const heroItem = model.heroItem
  const heroKey = heroItem ? `${heroItem.type}-${heroItem.id}` : 'empty'

  return (
    <StreamingTvScaffold
      profileId={model.profileId}
      activeNav="home"
      expandedRail
      title={model.profileName}
      initialZoneId={initialZoneId}
      onBack={() => model.navigation.goToPath('/profiles')}
      hideHeader
    >
      {hasHero && heroItem ? (
        <section className={styles.heroBanner}>
          <AnimatePresence mode="sync" initial={false}>
            <motion.div
              key={`hero-bg-${heroKey}`}
              className={styles.heroBackdrop}
              style={{ backgroundImage: `url(${sanitizeImgSrc(heroItem.background || heroItem.poster || '')})` }}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.01 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
          </AnimatePresence>
          <div className={styles.heroOverlay} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`hero-content-${heroKey}`}
              className={styles.heroContent}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              <div className={styles.heroCopy}>
                <h2 className={styles.heroTitle}>{heroItem.name}</h2>
                {heroItem.description ? <p className={styles.heroDescription}>{heroItem.description}</p> : null}
              </div>
              <TvActionStrip zoneId="home-hero-actions" nextLeft="streaming-rail" nextDown={hasContinueWatching ? 'home-continue' : firstCatalogZoneId}>
                <TvFocusItem
                  id="home-hero-play"
                  className={styles.heroAction}
                  onActivate={() => {
                    if (model.showTrendingHero) {
                      model.navigation.openMeta(heroItem.type, heroItem.id)
                      return
                    }

                    const matchingItem = model.continueWatchingItems.find((item) => item.metaId === heroItem.id)
                    if (matchingItem) {
                      model.navigation.startContinueWatching(matchingItem)
                      return
                    }

                    model.navigation.openMeta(heroItem.type, heroItem.id)
                  }}
                >
                  <Play size={18} fill="currentColor" />
                  <span>Play</span>
                </TvFocusItem>
                <TvFocusItem
                  id="home-hero-info"
                  className={styles.heroActionSecondary}
                  onActivate={() => model.navigation.openMeta(heroItem.type, heroItem.id)}
                >
                  <Info size={18} />
                  <span>Details</span>
                </TvFocusItem>
              </TvActionStrip>
            </motion.div>
          </AnimatePresence>
        </section>
      ) : null}

      {hasContinueWatching ? (
        <TvMediaShelf<HomeTvItem>
          title="Continue Watching"
          zoneId="home-continue"
          items={model.continueWatchingItems}
          showImdbRatings={model.showImdbRatings}
          showAgeRatings={model.showAgeRatings}
          nextLeft="streaming-rail"
          nextUp={hasHero ? 'home-hero-actions' : 'streaming-rail'}
          nextDown={firstCatalogZoneId}
          onActivate={(item) => model.navigation.startContinueWatching(item)}
        />
      ) : null}

      {model.catalogMetadata.map((metadata, index) => {
        const zoneId = `home-catalog-${metadata.catalog.type}-${metadata.catalog.id}`
        const nextUp = index === 0
          ? hasContinueWatching
            ? 'home-continue'
            : hasHero
              ? 'home-hero-actions'
              : 'streaming-rail'
          : `home-catalog-${model.catalogMetadata[index - 1]?.catalog.type}-${model.catalogMetadata[index - 1]?.catalog.id}`
        const nextDown = index < model.catalogMetadata.length - 1
          ? `home-catalog-${model.catalogMetadata[index + 1]?.catalog.type}-${model.catalogMetadata[index + 1]?.catalog.id}`
          : undefined

        return (
          <TvMediaShelf
            key={`${metadata.manifestUrl}-${metadata.catalog.type}-${metadata.catalog.id}`}
            title={metadata.title}
            zoneId={zoneId}
            queryKey={['tv-home-catalog', model.profileId, metadata.manifestUrl, metadata.catalog.type, metadata.catalog.id]}
            queryFn={() => fetchCatalogItems(model.profileId, metadata.manifestUrl, metadata.catalog.type, metadata.catalog.id)}
            showImdbRatings={model.showImdbRatings}
            showAgeRatings={model.showAgeRatings}
            nextLeft="streaming-rail"
            nextUp={nextUp}
            nextDown={nextDown}
            priority={index === 0 ? 'eager' : 'lazy'}
            onActivate={(item) => model.navigation.openMeta(item.type, item.id)}
          />
        )
      })}
    </StreamingTvScaffold>
  )
}

export default StreamingHomeTvView
