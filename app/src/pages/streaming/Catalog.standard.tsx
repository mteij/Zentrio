import { ChevronLeft, Clapperboard, Film, Layers3, Tv } from 'lucide-react'
import { AnimatedBackground, Layout, LazyImage, LoadErrorState, RatingBadge, SkeletonCard } from '../../components'
import type { MetaPreview } from '../../services/addons/types'
import type { CatalogScreenModel } from './Catalog.model'
import styles from '../../styles/Streaming.module.css'

function getCollectionLabel(type: string) {
  if (type === 'movie') return 'Movie Collection'
  if (type === 'series') return 'Series Collection'
  return 'Collection'
}

function getTypeLabel(type: string) {
  if (type === 'movie') return 'Movies'
  if (type === 'series') return 'Series'
  return 'Titles'
}

function getTypeIcon(type: string) {
  if (type === 'movie') return Film
  if (type === 'series') return Tv
  return Clapperboard
}

function getItemCountLabel(count: number, type: string) {
  const singular = type === 'movie' ? 'movie' : type === 'series' ? 'series' : 'title'
  const plural = type === 'movie' ? 'movies' : type === 'series' ? 'series' : 'titles'
  return `${count} ${count === 1 ? singular : plural}`
}

function extractYear(value?: string | null) {
  if (!value) return null
  const match = value.match(/\b(19|20)\d{2}\b/)
  return match ? match[0] : null
}

function getReleaseLabel(item: MetaPreview) {
  return item.releaseInfo || item.year || extractYear(item.released) || null
}

function getYearRange(items: MetaPreview[]) {
  const years = items
    .map((item) => Number.parseInt(getReleaseLabel(item) || '', 10))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => a - b)

  if (years.length === 0) return null
  if (years[0] === years[years.length - 1]) return String(years[0])
  return `${years[0]}-${years[years.length - 1]}`
}

function buildCatalogDescription(model: CatalogScreenModel, featuredItem?: MetaPreview) {
  const countLabel = getItemCountLabel(model.items.length, model.catalogType)

  if (featuredItem?.description) {
    return featuredItem.description
  }

  return `Browse ${countLabel} currently loaded in ${model.title}. This collection is optimized for quick scanning on touch, mouse, and keyboard.`
}

export function StreamingCatalogStandardView({ model }: { model: CatalogScreenModel }) {
  const collectionLabel = getCollectionLabel(model.catalogType)
  const typeLabel = getTypeLabel(model.catalogType)
  const typeIcon = getTypeIcon(model.catalogType)
  const featuredItem = model.items[0]
  const yearRange = getYearRange(model.items)
  const countLabel = getItemCountLabel(model.items.length, model.catalogType)
  const featuredMeta = featuredItem ? [getReleaseLabel(featuredItem), featuredItem.type === 'series' ? 'Series' : featuredItem.type === 'movie' ? 'Movie' : null].filter(Boolean).join(' / ') : null
  const catalogDescription = buildCatalogDescription(model, featuredItem)
  const TypeIcon = typeIcon

  if (model.status === 'loading') {
    return (
      <Layout title="Loading..." showHeader={false} showFooter={false}>
        <button onClick={model.navigation.goBack} className={`${styles.backBtn} ${styles.catalogBackButton}`} aria-label="Go back">
          <ChevronLeft size={20} />
          Back
        </button>
        <div className={`${styles.streamingLayout} ${styles.streamingLayoutNoHero}`}>
          <div className={styles.catalogPage}>
            <section className={styles.catalogHero}>
              <div className={styles.catalogHeroScrim} />
              <div className={styles.catalogHeroContent}>
                <div className={styles.catalogHeroTopline}>
                  <div className={styles.catalogHeroBadge}>
                    <div style={{ width: '110px', height: '12px', position: 'relative', overflow: 'hidden', borderRadius: '999px' }}>
                      <div className={styles.skeletonShimmer} />
                    </div>
                  </div>
                  <div className={styles.catalogHeroBadge}>
                    <div style={{ width: '72px', height: '12px', position: 'relative', overflow: 'hidden', borderRadius: '999px' }}>
                      <div className={styles.skeletonShimmer} />
                    </div>
                  </div>
                </div>
                <div style={{ width: 'min(480px, 100%)', height: '56px', position: 'relative', overflow: 'hidden', borderRadius: '12px' }}>
                  <div className={styles.skeletonShimmer} />
                </div>
                <div style={{ width: 'min(620px, 100%)', height: '84px', position: 'relative', overflow: 'hidden', borderRadius: '16px' }}>
                  <div className={styles.skeletonShimmer} />
                </div>
                <div className={styles.catalogHeroStats}>
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className={styles.catalogStatCard}>
                      <div style={{ width: '84px', height: '11px', position: 'relative', overflow: 'hidden', borderRadius: '999px' }}>
                        <div className={styles.skeletonShimmer} />
                      </div>
                      <div style={{ width: '120px', height: '18px', position: 'relative', overflow: 'hidden', borderRadius: '999px' }}>
                        <div className={styles.skeletonShimmer} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <section className={styles.catalogGridSection}>
              <div className={styles.catalogSectionHeader}>
                <div>
                  <p className={styles.catalogSectionEyebrow}>Collection</p>
                  <h2 className={styles.catalogSectionTitle}>Loading titles</h2>
                </div>
              </div>
              <div className={styles.catalogGrid}>
                {Array.from({ length: 20 }).map((_, index) => (
                  <SkeletonCard key={index} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </Layout>
    )
  }

  if (model.status === 'error') {
    return (
      <LoadErrorState
        message={model.errorMessage || 'Failed to load catalog'}
        onRetry={() => {
          void model.retry()
        }}
        isRetrying={model.isRetrying}
        onBack={model.navigation.goBack}
      />
    )
  }

  return (
    <Layout title={model.title} showHeader={false} showFooter={false}>
      <AnimatedBackground image={model.ambientImage} fallbackColor="#000" opacity={0.45} />

      <button onClick={model.navigation.goBack} className={`${styles.backBtn} ${styles.catalogBackButton}`} aria-label="Go back">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        Back
      </button>

      <div className={`${styles.streamingLayout} ${styles.streamingLayoutNoHero}`}>
        <div className={styles.catalogPage}>
          <section className={styles.catalogHero}>
            {featuredItem?.background || featuredItem?.poster ? (
              <div
                className={styles.catalogHeroArtwork}
                style={{ backgroundImage: `url(${featuredItem.background || featuredItem.poster})` }}
                aria-hidden="true"
              />
            ) : null}
            <div className={styles.catalogHeroScrim} />
            <div className={styles.catalogHeroContent}>
              <div className={styles.catalogHeroTopline}>
                <span className={styles.catalogHeroBadge}>Collection</span>
                <span className={styles.catalogHeroBadge}>{countLabel}</span>
              </div>

              <div className={styles.catalogHeroIntro}>
                <div className={styles.catalogTitleBlock}>
                  <h1 className={styles.catalogHeroTitle}>{model.title}</h1>
                  <p className={styles.catalogHeroDescription}>{catalogDescription}</p>
                </div>

                {featuredItem ? (
                  <div className={styles.catalogFeaturedCard}>
                    <p className={styles.catalogFeaturedEyebrow}>Featured in this collection</p>
                    <h2 className={styles.catalogFeaturedTitle}>{featuredItem.name}</h2>
                    {featuredMeta ? <p className={styles.catalogFeaturedMeta}>{featuredMeta}</p> : null}
                    {featuredItem.description ? <p className={styles.catalogFeaturedDescription}>{featuredItem.description}</p> : null}
                  </div>
                ) : null}
              </div>

              <div className={styles.catalogHeroStats}>
                <div className={styles.catalogStatCard}>
                  <span className={styles.catalogStatLabel}>Surface</span>
                  <strong className={styles.catalogStatValue}>{collectionLabel}</strong>
                </div>
                <div className={styles.catalogStatCard}>
                  <span className={styles.catalogStatLabel}>Loaded now</span>
                  <strong className={styles.catalogStatValue}>{countLabel}</strong>
                </div>
                {yearRange ? (
                  <div className={styles.catalogStatCard}>
                    <span className={styles.catalogStatLabel}>Years</span>
                    <strong className={styles.catalogStatValue}>{yearRange}</strong>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className={styles.catalogGridSection}>
            <div className={styles.catalogSectionHeader}>
              <div>
                <p className={styles.catalogSectionEyebrow}>Browse</p>
                <h2 className={styles.catalogSectionTitle}>{model.title}</h2>
              </div>
              <div className={styles.catalogSectionMeta}>
                <span className={styles.catalogSectionMetaPill}>
                  <TypeIcon size={14} aria-hidden="true" />
                  {typeLabel}
                </span>
                {yearRange ? <span className={styles.catalogSectionMetaPill}>{yearRange}</span> : null}
              </div>
            </div>

            {model.items.length === 0 ? (
              <div className={styles.catalogEmptyState}>
                <p className={styles.catalogEmptyTitle}>Nothing is available here yet</p>
                <p className={styles.catalogEmptyDescription}>Try another collection or come back after the next catalog refresh.</p>
              </div>
            ) : (
              <div className={styles.catalogGrid}>
                {model.items.map((item, index) => {
                  const itemMeta = [getReleaseLabel(item), item.type === 'series' ? 'Series' : item.type === 'movie' ? 'Movie' : null].filter(Boolean).join(' / ')

                  return (
                    <a
                      key={`${item.id}-${index}`}
                      href={`/streaming/${model.profileId}/${item.type}/${item.id}`}
                      className={styles.catalogGridCard}
                      aria-label={`Open ${item.name}`}
                    >
                      <div className={styles.catalogPosterShell}>
                        {item.poster ? (
                          <LazyImage src={item.poster} alt={item.name} className={styles.catalogPosterImage} />
                        ) : (
                          <div className={styles.catalogPosterFallback}>{item.name}</div>
                        )}
                        {model.showImdbRatings && item.imdbRating ? <RatingBadge rating={parseFloat(item.imdbRating)} /> : null}
                      </div>
                      <div className={styles.catalogCardBody}>
                        <h3 className={styles.catalogCardTitle}>{item.name}</h3>
                        {itemMeta ? <p className={styles.catalogCardMeta}>{itemMeta}</p> : null}
                      </div>
                    </a>
                  )
                })}
              </div>
            )}

            {model.hasNextPage ? (
              <div className={styles.catalogLoadMoreRow}>
                {model.isFetchingNextPage ? (
                  <div className={styles.catalogLoadingPill} aria-live="polite">
                    Loading more titles...
                  </div>
                ) : (
                  <button className={styles.catalogLoadMoreButton} onClick={() => void model.loadMore()}>
                    <Layers3 size={16} aria-hidden="true" />
                    Load More
                  </button>
                )}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </Layout>
  )
}

export default StreamingCatalogStandardView
