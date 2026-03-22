import { Check, Clapperboard, Film, Star, Tv } from 'lucide-react'
import { LoadErrorState, LoadingSpinner } from '../../components'
import { TvActionStrip, TvFocusItem, TvGrid, TvSection, TvShelf } from '../../components/tv'
import { sanitizeImgSrc } from '../../lib/url'
import type { MetaPreview } from '../../services/addons/types'
import type { CatalogScreenModel } from './Catalog.model'
import { StreamingTvScaffold } from './StreamingTvScaffold'
import styles from './Catalog.tv.module.css'

function getAgeRating(item: any): string | null {
  const direct = item.ageRating || item.certification || item.rating || item.contentRating
  if (typeof direct === 'string') return direct

  if (typeof item.info?.certification === 'string') return item.info.certification
  if (typeof item.info?.rating === 'string') return item.info.rating

  return null
}

function getImdbRating(item: any): number | null {
  const parsed = Number.parseFloat(item.imdbRating)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

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

export function StreamingCatalogTvView({ model }: { model: CatalogScreenModel }) {
  const featuredItem = model.items[0]
  const collectionLabel = getCollectionLabel(model.catalogType)
  const typeLabel = getTypeLabel(model.catalogType)
  const TypeIcon = getTypeIcon(model.catalogType)
  const countLabel = getItemCountLabel(model.items.length, model.catalogType)
  const yearRange = getYearRange(model.items)
  const heroDescription = featuredItem?.description
    || `Browse ${countLabel} loaded in ${model.title}. The layout is tuned for fast remote scanning with a prominent featured title and a dense grid below.`
  const initialZoneId = featuredItem ? 'catalog-hero-actions' : model.items[0] ? `catalog-${model.items[0].id}-0` : 'catalog-load-more'

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
    <StreamingTvScaffold
      profileId={model.profileId}
      eyebrow="Collection"
      title={model.title}
      description="Browse the full set of items in this catalog with a grid built for remote navigation."
      initialZoneId={initialZoneId}
      onBack={model.navigation.goBack}
      hideHeader
    >
      <section className={styles.heroBanner}>
        {featuredItem?.background || featuredItem?.poster ? (
          <div
            className={styles.heroBackdrop}
            style={{ backgroundImage: `url(${sanitizeImgSrc(featuredItem.background || featuredItem.poster || '')})` }}
            aria-hidden="true"
          />
        ) : null}
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <div className={styles.heroMetaRow}>
            <span className={styles.heroEyebrow}>Collection</span>
            <span className={styles.heroMetaChip}>
              <TypeIcon size={16} aria-hidden="true" />
              {collectionLabel}
            </span>
            <span className={styles.heroMetaChip}>{countLabel}</span>
            {yearRange ? <span className={styles.heroMetaChip}>{yearRange}</span> : null}
          </div>

          <div className={styles.heroBody}>
            <div className={styles.heroCopy}>
              <h1 className={styles.heroTitle}>{model.title}</h1>
              <p className={styles.heroDescription}>{heroDescription}</p>
            </div>

            {featuredItem ? (
              <div className={styles.heroSpotlight}>
                <p className={styles.heroSpotlightEyebrow}>Featured title</p>
                <h2 className={styles.heroSpotlightTitle}>{featuredItem.name}</h2>
                <p className={styles.heroSpotlightMeta}>
                  {[getReleaseLabel(featuredItem), featuredItem.type === 'series' ? 'Series' : featuredItem.type === 'movie' ? 'Movie' : null]
                    .filter(Boolean)
                    .join(' / ')}
                </p>
              </div>
            ) : null}
          </div>

          {featuredItem ? (
            <TvActionStrip zoneId="catalog-hero-actions" nextLeft="streaming-rail" nextDown="catalog-grid">
              <TvFocusItem id="catalog-hero-open" className={styles.heroAction} onActivate={() => model.navigation.openItem(featuredItem)}>
                Open Featured
              </TvFocusItem>
              {model.hasNextPage ? (
                <TvFocusItem id="catalog-hero-load-more" className={styles.heroActionSecondary} onActivate={() => void model.loadMore()}>
                  Load More
                </TvFocusItem>
              ) : null}
            </TvActionStrip>
          ) : null}
        </div>
      </section>

      <TvSection title={model.title} subtitle={`${countLabel}${yearRange ? ` / ${yearRange}` : ''}`}>
        <TvGrid
          zoneId="catalog-grid"
          columns={5}
          nextLeft="streaming-rail"
          nextUp={featuredItem ? 'catalog-hero-actions' : 'streaming-rail'}
          initialItemId={model.items[0] ? `catalog-${model.items[0].id}-0` : 'catalog-load-more'}
        >
          {model.items.map((item, index) => {
            const ageRating = model.showAgeRatings ? getAgeRating(item) : null
            const imdbRating = model.showImdbRatings ? getImdbRating(item) : null
            const itemMeta = [getReleaseLabel(item), item.type === 'series' ? 'Series' : item.type === 'movie' ? 'Movie' : null]
              .filter(Boolean)
              .join(' / ')

            return (
              <TvFocusItem
                key={`${item.id}-${index}`}
                id={`catalog-${item.id}-${index}`}
                index={index}
                className={styles.card}
                onActivate={() => model.navigation.openItem(item)}
              >
                <div className={styles.posterShell}>
                  {item.poster ? (
                    <img src={sanitizeImgSrc(item.poster)} alt={item.name} className={styles.poster} loading="lazy" />
                  ) : (
                    <div className={styles.poster} aria-hidden="true" />
                  )}
                  <div className={styles.posterBadges}>
                    {(item as any).isWatched ? (
                      <span className={`${styles.posterBadge} ${styles.watchedBadge}`} aria-label="Watched">
                        <Check size={13} strokeWidth={3} />
                      </span>
                    ) : null}
                    {ageRating ? <span className={styles.posterBadge}>{ageRating}</span> : null}
                  </div>
                  {imdbRating ? (
                    <span className={`${styles.posterBadge} ${styles.ratingBadge}`} aria-label={`IMDb ${imdbRating.toFixed(1)}`}>
                      <Star size={13} fill="currentColor" />
                      <span>{imdbRating.toFixed(1)}</span>
                    </span>
                  ) : null}
                  <div className={styles.posterActionOverlay} aria-hidden="true">
                    <span className={`${styles.posterActionPill} ${styles.posterActionPrimary}`}>Open</span>
                    <span className={styles.posterActionPill}>{typeLabel}</span>
                  </div>
                </div>
                <div className={styles.body}>
                  <p className={styles.title}>{item.name}</p>
                  {itemMeta ? <p className={styles.meta}>{itemMeta}</p> : null}
                </div>
              </TvFocusItem>
            )
          })}
        </TvGrid>
      </TvSection>

      {model.hasNextPage ? (
        <TvSection title="More Results" subtitle="Load another batch without leaving the collection.">
          <TvShelf zoneId="catalog-load-more" nextLeft="streaming-rail" nextUp="catalog-grid">
            <TvFocusItem
              id="catalog-load-more"
              className={styles.loadMore}
              onActivate={() => void model.loadMore()}
            >
              {model.isFetchingNextPage ? 'Loading more titles...' : 'Load More'}
            </TvFocusItem>
          </TvShelf>
        </TvSection>
      ) : null}
    </StreamingTvScaffold>
  )
}

export default StreamingCatalogTvView
