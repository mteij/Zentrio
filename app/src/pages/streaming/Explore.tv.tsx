import { useQuery } from '@tanstack/react-query'
import { Compass, Film, Info, Layers3, Sparkles, Tv } from 'lucide-react'
import { TvActionStrip, TvFocusItem, TvGrid, TvMediaShelf, TvSection, TvShelf } from '../../components/tv'
import { scrollTvPageTop } from '../../components/tv/scrollTvPageTop'
import { apiFetch, apiFetchJson } from '../../lib/apiFetch'
import { sanitizeImgSrc } from '../../lib/url'
import type { MetaPreview } from '../../services/addons/types'
import type { ExploreScreenModel } from './Explore.model'
import { StreamingTvScaffold } from './StreamingTvScaffold'
import styles from './Explore.tv.module.css'

interface TraktRecommendation {
  id: string
  type: 'movie' | 'series'
  name: string
  year?: number
  imdb_id?: string
  poster?: string
  background?: string
  imdbRating?: string
  description?: string
  ageRating?: string
}

function getAgeRating(item: MetaPreview & { certification?: string; rating?: string; contentRating?: string; info?: { certification?: unknown; rating?: unknown } }): string | null {
  const direct = item.ageRating || item.certification || item.rating || item.contentRating
  if (typeof direct === 'string') return direct
  if (typeof item.info?.certification === 'string') return item.info.certification
  if (typeof item.info?.rating === 'string') return item.info.rating
  return null
}

function getImdbRating(item: MetaPreview): number | null {
  const parsed = Number.parseFloat(item.imdbRating || '')
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function ExploreGridCard({
  id,
  index,
  item,
  showImdbRatings,
  showAgeRatings,
  onActivate,
}: {
  id: string
  index: number
  item: MetaPreview
  showImdbRatings: boolean
  showAgeRatings: boolean
  onActivate: () => void
}) {
  const imdbRating = showImdbRatings ? getImdbRating(item) : null
  const ageRating = showAgeRatings ? getAgeRating(item as MetaPreview & { certification?: string; rating?: string; contentRating?: string; info?: { certification?: unknown; rating?: unknown } }) : null

  return (
    <TvFocusItem id={id} index={index} className={styles.gridCard} onActivate={onActivate} aria-label={item.name}>
      <div className={styles.posterShell}>
        {item.poster ? (
          <img src={sanitizeImgSrc(item.poster)} alt={item.name} className={styles.poster} loading="lazy" />
        ) : (
          <div className={styles.poster} aria-hidden="true" />
        )}
        <div className={styles.posterBadges}>
          {ageRating ? <span className={styles.posterBadge}>{ageRating}</span> : null}
        </div>
        {imdbRating ? (
          <span className={`${styles.posterBadge} ${styles.ratingBadge}`} aria-label={`IMDb ${imdbRating.toFixed(1)}`}>
            <Sparkles size={12} />
            <span>{imdbRating.toFixed(1)}</span>
          </span>
        ) : null}
        <div className={styles.posterActionOverlay} aria-hidden="true">
          <span className={`${styles.posterActionPill} ${styles.posterActionPrimary}`}>
            <Info size={12} />
            <span>Details</span>
          </span>
        </div>
      </div>
      <div className={styles.body}>
        <p className={styles.title}>{item.name}</p>
        {item.releaseInfo || item.year ? <p className={styles.meta}>{item.releaseInfo || item.year}</p> : null}
      </div>
    </TvFocusItem>
  )
}

export function StreamingExploreTvView({ model }: { model: ExploreScreenModel }) {
  const activeBrowseMode = model.isFilteredView
    ? (model.activeType === 'movie' || model.activeType === 'series' ? model.activeType : 'all')
    : model.viewMode

  const { data: movieRecommendations } = useQuery({
    queryKey: ['tv-trakt-recommendations', model.profileId, 'movies'],
    queryFn: async () => {
      const res = await apiFetch(`/api/trakt/recommendations?profileId=${model.profileId}&type=movies&limit=20`)
      const json = await res.json()
      return json.data as { items: TraktRecommendation[]; connected: boolean }
    },
    enabled: !model.isFilteredView && activeBrowseMode !== 'series',
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  })

  const { data: showRecommendations } = useQuery({
    queryKey: ['tv-trakt-recommendations', model.profileId, 'shows'],
    queryFn: async () => {
      const res = await apiFetch(`/api/trakt/recommendations?profileId=${model.profileId}&type=shows&limit=20`)
      const json = await res.json()
      return json.data as { items: TraktRecommendation[]; connected: boolean }
    },
    enabled: !model.isFilteredView && activeBrowseMode !== 'movie',
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  })

  const recommendationRows = [
    ...(movieRecommendations?.connected && movieRecommendations.items.length > 0
      ? [{
          zoneId: 'explore-rec-movies',
          title: 'Recommended Movies',
          items: movieRecommendations.items.map((item) => ({
            id: item.imdb_id || item.id,
            type: item.type,
            name: item.name,
            releaseInfo: item.year?.toString(),
            poster: item.poster,
            background: item.background,
            imdbRating: item.imdbRating,
            ageRating: item.ageRating,
            description: item.description,
          })),
        }]
      : []),
    ...(showRecommendations?.connected && showRecommendations.items.length > 0
      ? [{
          zoneId: 'explore-rec-shows',
          title: 'Recommended Shows',
          items: showRecommendations.items.map((item) => ({
            id: item.imdb_id || item.id,
            type: item.type,
            name: item.name,
            releaseInfo: item.year?.toString(),
            poster: item.poster,
            background: item.background,
            imdbRating: item.imdbRating,
            ageRating: item.ageRating,
            description: item.description,
          })),
        }]
      : []),
  ]

  const topRows = activeBrowseMode === 'all'
    ? [
        { zoneId: 'explore-top-movies', title: 'Top 10 Movies Today', items: model.trendingMovies },
        { zoneId: 'explore-top-series', title: 'Top 10 Series Today', items: model.trendingSeries },
      ].filter((row) => row.items.length > 0)
    : activeBrowseMode === 'movie'
      ? [{ zoneId: 'explore-top-movies', title: 'Top 10 Movies Today', items: model.trendingMovies }].filter((row) => row.items.length > 0)
      : [{ zoneId: 'explore-top-series', title: 'Top 10 Series Today', items: model.trendingSeries }].filter((row) => row.items.length > 0)

  const shortcutGenres = [...model.displayGenres].sort((a, b) => a.localeCompare(b))

  const contentRows = [
    ...topRows.map((row) => ({ ...row, kind: 'static' as const })),
    ...(!model.isFilteredView && shortcutGenres.length > 0
      ? [{ zoneId: 'explore-genre-shortcuts-row', title: 'Browse Genres', kind: 'genres' as const, genres: shortcutGenres }]
      : []),
    ...recommendationRows.map((row) => ({ ...row, kind: 'static' as const })),
    ...(!model.isFilteredView
      ? model.rowGenres.map((genre, index) => ({
          zoneId: `explore-genre-row-${genre.replace(/\s+/g, '-').toLowerCase()}`,
          title: genre,
          kind: 'query' as const,
          genre,
          priority: index < 2 && topRows.length === 0 ? 'eager' as const : 'lazy' as const,
        }))
      : []),
  ]

  const firstContentZoneId = model.isFilteredView ? 'explore-grid' : contentRows[0]?.zoneId

  const handleModeActivate = (mode: 'all' | 'movie' | 'series') => {
    if (model.isFilteredView) {
      model.actions.updateFilter('type', mode === 'all' ? '' : mode)
      return
    }

    model.actions.setViewMode(mode)
  }

  return (
    <>
      <StreamingTvScaffold
        profileId={model.profileId}
        activeNav="explore"
        title={model.isFilteredView ? (model.activeGenre || (activeBrowseMode === 'movie' ? 'Movies' : activeBrowseMode === 'series' ? 'Series' : 'Explore')) : 'Explore'}
        initialZoneId="explore-mode-strip"
        hideHeader
        onBack={model.isFilteredView ? model.actions.clearFilters : () => window.history.back()}
      >
        <div className={styles.exploreControls}>
          <TvActionStrip
            zoneId="explore-mode-strip"
            nextLeft="streaming-rail"
            nextDown={model.isFilteredView ? 'explore-filter-actions' : firstContentZoneId}
          >
            {([
              { key: 'all' as const, label: 'All', icon: Layers3 },
              { key: 'movie' as const, label: 'Movies', icon: Film },
              { key: 'series' as const, label: 'Series', icon: Tv },
            ]).map((mode) => {
              const Icon = mode.icon
              const isActive = activeBrowseMode === mode.key
              return (
                <TvFocusItem
                  key={mode.key}
                  id={`explore-mode-${mode.key}`}
                  className={`${styles.modeChip} ${isActive ? styles.modeChipActive : ''}`}
                  onFocus={() => scrollTvPageTop()}
                  onActivate={() => handleModeActivate(mode.key)}
                >
                  <Icon size={16} />
                  <span>{mode.label}</span>
                </TvFocusItem>
              )
            })}
          </TvActionStrip>

          {model.isFilteredView ? (
            <TvActionStrip
              zoneId="explore-filter-actions"
              nextLeft="streaming-rail"
              nextUp="explore-mode-strip"
              nextDown="explore-grid"
            >
              <TvFocusItem id="explore-clear-filters" className={styles.actionChip} onFocus={() => scrollTvPageTop()} onActivate={model.actions.clearFilters}>
                <Compass size={16} />
                <span>Back to Explore</span>
              </TvFocusItem>
              {model.activeGenre ? (
                <TvFocusItem
                  id="explore-clear-genre"
                  className={styles.actionChip}
                  onFocus={() => scrollTvPageTop()}
                  onActivate={() => model.actions.updateFilter('genre', '')}
                >
                  <span>Clear Genre</span>
                </TvFocusItem>
              ) : null}
            </TvActionStrip>
          ) : null}
        </div>

        {model.isFilteredView ? (
          <TvSection title={model.activeGenre || (activeBrowseMode === 'movie' ? 'Movies' : activeBrowseMode === 'series' ? 'Series' : 'Results')}>
            {model.loading ? (
              <TvShelf zoneId="explore-grid" nextLeft="streaming-rail" nextUp="explore-filter-actions">
                {Array.from({ length: 5 }).map((_, index) => (
                  <TvFocusItem key={`explore-grid-skeleton-${index}`} id={`explore-grid-skeleton-${index}`} index={index} className={styles.gridSkeletonCard}>
                    <span className={styles.gridSkeletonPoster} aria-hidden="true" />
                    <span className={styles.gridSkeletonLine} aria-hidden="true" />
                  </TvFocusItem>
                ))}
              </TvShelf>
            ) : model.filteredItems.length > 0 ? (
              <TvGrid zoneId="explore-grid" columns={5} nextLeft="streaming-rail" nextUp="explore-filter-actions">
                {model.filteredItems.map((item, index) => (
                  <ExploreGridCard
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
                  <TvFocusItem id="explore-load-more" index={model.filteredItems.length} className={styles.loadMoreCard} onActivate={() => void model.actions.loadMore()}>
                    Load More
                  </TvFocusItem>
                ) : null}
              </TvGrid>
            ) : (
              <TvShelf zoneId="explore-grid" nextLeft="streaming-rail" nextUp="explore-filter-actions">
                <TvFocusItem id="explore-empty" className={styles.emptyStateCard} onActivate={model.actions.clearFilters}>
                  <p className={styles.emptyStateTitle}>No titles found</p>
                </TvFocusItem>
              </TvShelf>
            )}
          </TvSection>
        ) : (
          <>
            {contentRows.map((row, index) => {
              const nextUp = index === 0 ? 'explore-mode-strip' : contentRows[index - 1]?.zoneId
              const nextDown = index < contentRows.length - 1 ? contentRows[index + 1]?.zoneId : undefined

              if (row.kind === 'static') {
                return (
                  <TvMediaShelf
                    key={row.zoneId}
                    profileId={model.profileId}
                    title={row.title}
                    zoneId={row.zoneId}
                    items={row.items}
                    showImdbRatings={model.showImdbRatings}
                    showAgeRatings={model.showAgeRatings}
                    nextLeft="streaming-rail"
                    nextUp={nextUp}
                    nextDown={nextDown}
                    onActivate={(item) => model.actions.openItem(item as MetaPreview)}
                  />
                )
              }

              if (row.kind === 'genres') {
                return (
                  <div key={row.zoneId} className={styles.genreShelfSection}>
                    <TvSection title={row.title}>
                      <TvShelf
                        zoneId={row.zoneId}
                        nextLeft="streaming-rail"
                        nextUp={nextUp}
                        nextDown={nextDown}
                      >
                        {row.genres.map((genre, genreIndex) => (
                          <TvFocusItem
                            key={genre}
                            id={`explore-genre-shortcut-${genre.replace(/\s+/g, '-').toLowerCase()}`}
                            index={genreIndex}
                            className={styles.genreShelfCard}
                            onFocus={() => scrollTvPageTop()}
                            onActivate={() => model.actions.updateFilter('genre', genre)}
                          >
                            <span className={styles.genreShelfTitle}>{genre}</span>
                          </TvFocusItem>
                        ))}
                      </TvShelf>
                    </TvSection>
                  </div>
                )
              }

              const typeParam = activeBrowseMode === 'all' ? 'movie,series' : activeBrowseMode
              return (
                <TvMediaShelf
                  key={row.zoneId}
                  profileId={model.profileId}
                  title={row.title}
                  zoneId={row.zoneId}
                  queryKey={['tv-explore-genre', model.profileId, activeBrowseMode, row.genre]}
                  queryFn={async () => {
                    const data = await apiFetchJson<{ items: MetaPreview[] }>(
                      `/api/streaming/catalog?profileId=${model.profileId}&type=${typeParam}&genre=${encodeURIComponent(row.genre)}&skip=0`,
                    )
                    return data.items || []
                  }}
                  showImdbRatings={model.showImdbRatings}
                  showAgeRatings={model.showAgeRatings}
                  nextLeft="streaming-rail"
                  nextUp={nextUp}
                  nextDown={nextDown}
                  priority={row.priority}
                  onActivate={(item) => model.actions.openItem(item as MetaPreview)}
                />
              )
            })}
          </>
        )}
      </StreamingTvScaffold>
    </>
  )
}

export default StreamingExploreTvView
