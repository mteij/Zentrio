import { Check, Star } from 'lucide-react'
import { LoadErrorState, LoadingSpinner } from '../../components'
import { TvFocusItem, TvGrid, TvSection, TvShelf } from '../../components/tv'
import { sanitizeImgSrc } from '../../lib/url'
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

export function StreamingCatalogTvView({ model }: { model: CatalogScreenModel }) {
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
      eyebrow="Catalog"
      title={model.title}
      description="Browse the full set of items in this catalog with a grid built for remote navigation."
      initialZoneId="catalog-grid"
      onBack={model.navigation.goBack}
    >
      <TvSection title={model.title} subtitle={`${model.items.length} loaded item${model.items.length === 1 ? '' : 's'}`}>
        <TvGrid zoneId="catalog-grid" columns={5} nextLeft="streaming-rail" initialItemId={model.items[0] ? `catalog-${model.items[0].id}` : 'catalog-load-more'}>
          {model.items.map((item, index) => {
            const ageRating = model.showAgeRatings ? getAgeRating(item) : null
            const imdbRating = model.showImdbRatings ? getImdbRating(item) : null

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
                </div>
                <div className={styles.body}>
                  <p className={styles.title}>{item.name}</p>
                </div>
              </TvFocusItem>
            )
          })}
        </TvGrid>
      </TvSection>

      {model.hasNextPage ? (
        <TvSection title="More Results" subtitle="Load another batch of items from this catalog.">
          <TvShelf zoneId="catalog-load-more" nextLeft="streaming-rail" nextUp="catalog-grid">
            <TvFocusItem
              id="catalog-load-more"
              className={styles.loadMore}
              onActivate={() => void model.loadMore()}
            >
              {model.isFetchingNextPage ? 'Loading more...' : 'Load More'}
            </TvFocusItem>
          </TvShelf>
        </TvSection>
      ) : null}
    </StreamingTvScaffold>
  )
}

export default StreamingCatalogTvView
