import { Check, Star } from 'lucide-react'
import { TvFocusItem, TvFocusZone, TvGrid, TvMediaShelf, TvSection } from '../../components/tv'
import { apiFetchJson } from '../../lib/apiFetch'
import { sanitizeImgSrc } from '../../lib/url'
import type { ExploreScreenModel } from './Explore.model'
import { StreamingTvScaffold } from './StreamingTvScaffold'
import styles from './Explore.tv.module.css'

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

function ExploreCard({
  id,
  index,
  item,
  showImdbRatings,
  showAgeRatings,
  onActivate,
}: {
  id: string
  index: number
  item: any
  showImdbRatings: boolean
  showAgeRatings: boolean
  onActivate: () => void
}) {
  const imdbRating = showImdbRatings ? getImdbRating(item) : null
  const ageRating = showAgeRatings ? getAgeRating(item) : null

  return (
    <TvFocusItem id={id} index={index} className={styles.card} onActivate={onActivate} aria-label={item.name}>
      <div className={styles.posterShell}>
        {item.poster ? (
          <img src={sanitizeImgSrc(item.poster)} alt={item.name} className={styles.poster} loading="lazy" />
        ) : (
          <div className={styles.poster} aria-hidden="true" />
        )}
        <div className={styles.posterBadges}>
          {item.isWatched ? (
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
}

export function StreamingExploreTvView({ model }: { model: ExploreScreenModel }) {
  const heading = model.isFilteredView
    ? model.activeGenre || (model.activeType === 'movie' ? 'Movies' : model.activeType === 'series' ? 'Series' : 'Explore')
    : 'Explore'

  const topRows = model.viewMode === 'all'
    ? [
        { zoneId: 'explore-top-movies', title: 'Top 10 Movies Today', items: model.trendingMovies },
        { zoneId: 'explore-top-series', title: 'Top 10 Series Today', items: model.trendingSeries },
      ].filter((row) => row.items.length > 0)
    : model.viewMode === 'movie'
      ? [{ zoneId: 'explore-top-movies', title: 'Top 10 Movies Today', items: model.trendingMovies }].filter((row) => row.items.length > 0)
      : [{ zoneId: 'explore-top-series', title: 'Top 10 Series Today', items: model.trendingSeries }].filter((row) => row.items.length > 0)

  const firstRowZoneId = topRows[0]?.zoneId
  const firstGenreZoneId = model.rowGenres[0] ? `explore-genre-row-${model.rowGenres[0].replace(/\s+/g, '-').toLowerCase()}` : undefined
  const initialZoneId = model.isFilteredView ? 'explore-grid' : 'explore-filters'

  return (
    <StreamingTvScaffold
      profileId={model.profileId}
      activeNav="explore"
      eyebrow="Explore"
      title={heading}
      initialZoneId={initialZoneId}
      onBack={model.isFilteredView ? model.actions.clearFilters : () => window.history.back()}
    >
      <TvSection title="Type">
        <TvFocusZone id="explore-filters" orientation="vertical" nextRight={model.isFilteredView ? 'explore-grid' : firstRowZoneId || firstGenreZoneId}>
          {(['all', 'movie', 'series'] as const).map((mode, index) => (
            <TvFocusItem
              key={mode}
              id={`explore-mode-${mode}`}
              index={index}
              className={`${styles.filterCard} ${model.viewMode === mode ? styles.filterActive : ''}`}
              onActivate={() => model.actions.setViewMode(mode)}
            >
              <span>{mode === 'all' ? 'All Content' : mode === 'movie' ? 'Movies' : 'TV Shows'}</span>
            </TvFocusItem>
          ))}
        </TvFocusZone>
      </TvSection>

      {!model.isFilteredView ? (
        <>
          {topRows.map((row, index) => {
            const previousZoneId = index === 0 ? 'explore-filters' : topRows[index - 1]?.zoneId
            const nextZoneId = index < topRows.length - 1
              ? topRows[index + 1]?.zoneId
              : firstGenreZoneId

            return (
              <TvMediaShelf
                key={row.zoneId}
                title={row.title}
                zoneId={row.zoneId}
                items={row.items}
                showImdbRatings={model.showImdbRatings}
                showAgeRatings={model.showAgeRatings}
                nextLeft="streaming-rail"
                nextUp={previousZoneId}
                nextDown={nextZoneId}
                priority={index === 0 ? 'eager' : 'lazy'}
                onActivate={(item) => model.actions.openItem(item)}
              />
            )
          })}

          {model.rowGenres.map((genre, index) => {
            const zoneId = `explore-genre-row-${genre.replace(/\s+/g, '-').toLowerCase()}`
            const typeParam = model.viewMode === 'all' ? 'movie,series' : model.viewMode
            const nextUp = index === 0
              ? topRows[topRows.length - 1]?.zoneId || 'explore-filters'
              : `explore-genre-row-${model.rowGenres[index - 1].replace(/\s+/g, '-').toLowerCase()}`
            const nextDown = index < model.rowGenres.length - 1
              ? `explore-genre-row-${model.rowGenres[index + 1].replace(/\s+/g, '-').toLowerCase()}`
              : undefined

            return (
              <TvMediaShelf
                key={zoneId}
                title={genre}
                zoneId={zoneId}
                queryKey={['tv-explore-genre', model.profileId, model.viewMode, genre]}
                queryFn={async () => {
                  const data = await apiFetchJson<{ items: any[] }>(
                    `/api/streaming/catalog?profileId=${model.profileId}&type=${typeParam}&genre=${encodeURIComponent(genre)}&skip=0`,
                  )
                  return data.items || []
                }}
                showImdbRatings={model.showImdbRatings}
                showAgeRatings={model.showAgeRatings}
                nextLeft="streaming-rail"
                nextUp={nextUp}
                nextDown={nextDown}
                priority={index < 2 && topRows.length === 0 ? 'eager' : 'lazy'}
                onActivate={(item) => model.actions.openItem(item)}
              />
            )
          })}
        </>
      ) : (
        <TvSection title="Results">
          <TvGrid zoneId="explore-grid" columns={5} nextLeft="streaming-rail">
            {model.filteredItems.map((item, index) => (
              <ExploreCard
                key={`${item.id}-${index}`}
                id={`explore-grid-${item.id}-${index}`}
                index={index}
                item={item}
                showImdbRatings={model.showImdbRatings}
                showAgeRatings={model.showAgeRatings}
                onActivate={() => model.actions.openItem(item)}
              />
            ))}
            {model.hasMore ? (
              <TvFocusItem
                id="explore-load-more"
                index={model.filteredItems.length}
                className={styles.genreChip}
                onActivate={() => void model.actions.loadMore()}
              >
                Load More
              </TvFocusItem>
            ) : null}
          </TvGrid>
        </TvSection>
      )}
    </StreamingTvScaffold>
  )
}

export default StreamingExploreTvView
