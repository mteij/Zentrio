import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronDown, Film, Layers3, Search, Tv, User } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatedBackground, Hero, Layout, LazyImage, RatingBadge, SkeletonCard, SkeletonHero, SkeletonRow, StreamingRow } from '../../components'
import { TraktRecommendationsRow } from '../../components/streaming/TraktRecommendationsRow'
import { apiFetchJson } from '../../lib/apiFetch'
import { buildAvatarUrl, sanitizeImgSrc } from '../../lib/url'

import { MetaPreview } from '../../services/addons/types'
import type { ExploreScreenModel } from './Explore.model'
import styles from '../../styles/Streaming.module.css'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('ExplorePage')

// -- Internal GenreRow Component --
interface GenreRowProps {
  genre: string
  profileId: string
  showImdbRatings: boolean
  showAgeRatings: boolean
  type?: 'movie' | 'series' | 'all'
}

const GenreRow = memo(({ genre, profileId, showImdbRatings, showAgeRatings, type }: GenreRowProps) => {
  const rowRef = useRef<HTMLDivElement | null>(null)
  const queryClient = useQueryClient()

  const [isNearViewport, setIsNearViewport] = useState(() =>
    !!queryClient.getQueryData(['explore-genre', profileId, genre, type])
  )

  useEffect(() => {
    if (!isNearViewport && queryClient.getQueryData(['explore-genre', profileId, genre, type])) {
      setIsNearViewport(true)
    }
  }, [type, genre, profileId, queryClient, isNearViewport])

  useEffect(() => {
    if (isNearViewport) return
    const el = rowRef.current
    if (!el) return

    if (!('IntersectionObserver' in window)) {
      setIsNearViewport(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsNearViewport(true)
          observer.disconnect()
        }
      },
      { rootMargin: '220px 0px', threshold: 0.01 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [isNearViewport])

  const { data, isLoading } = useQuery({
    queryKey: ['explore-genre', profileId, genre, type],
    queryFn: async () => {
      const typeParam = type && type !== 'all' ? type : 'movie,series'
      return apiFetchJson<{ items: MetaPreview[] }>(`/api/streaming/catalog?profileId=${profileId}&type=${typeParam}&genre=${encodeURIComponent(genre)}&skip=0`)
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 120,
    refetchOnWindowFocus: false,
    enabled: isNearViewport,
    placeholderData: keepPreviousData,
  })

  if (!isNearViewport || isLoading) {
    return <div ref={rowRef}><SkeletonRow /></div>
  }

  if (!data?.items || data.items.length === 0) {
    return <div ref={rowRef} />
  }

  const seeAllBase = `/explore/${profileId}?genre=${encodeURIComponent(genre)}`
  const seeAllUrl = type && type !== 'all' ? `${seeAllBase}&type=${type}` : seeAllBase

  return (
    <div ref={rowRef}>
      <StreamingRow
        title={genre}
        items={data.items}
        profileId={profileId}
        showImdbRatings={showImdbRatings}
        showAgeRatings={showAgeRatings}
        seeAllUrl={seeAllUrl}
      />
    </div>
  )
})

GenreRow.displayName = 'GenreRow'

// -- Main Explore Component --
export const StreamingExplore = ({ model }: { model: ExploreScreenModel }) => {
  const [genreMenuOpen, setGenreMenuOpen] = useState(false)
  const genreMenuRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()

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

  // Keep a stable ref to loadMore to avoid observer churn
  const loadMoreFnRef = useRef(model.actions.loadMore)
  useEffect(() => { loadMoreFnRef.current = model.actions.loadMore })

  // Close genre menu on outside click / Escape
  useEffect(() => {
    if (!genreMenuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (genreMenuRef.current && !genreMenuRef.current.contains(event.target as Node)) {
        setGenreMenuOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGenreMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [genreMenuOpen])

  // Close menu when view mode or filtered state changes
  useEffect(() => {
    setGenreMenuOpen(false)
  }, [model.isFilteredView, model.viewMode])

  // Infinite scroll for genre filtered view
  useEffect(() => {
    if (!model.isFilteredView || !model.hasMore) return
    const target = loadMoreRef.current
    if (!target) return

    if (!('IntersectionObserver' in window)) {
      const id = globalThis.setInterval(() => { void loadMoreFnRef.current() }, 700)
      return () => globalThis.clearInterval(id)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMoreFnRef.current()
      },
      { rootMargin: '700px 0px', threshold: 0.01 }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [model.isFilteredView, model.hasMore])

  // Top-level loading skeleton (non-filtered initial load only)
  if (!model.isFilteredView && model.loading) {
    return (
      <Layout title="Explore" showHeader={false} showFooter={false}>
        <div className={styles.streamingLayout}>
          <SkeletonHero />
          <div className={styles.contentContainer}>
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </div>
      </Layout>
    )
  }

  const featuredItem = model.filteredItems[0]
  const activeTypeMode = (model.activeType && model.activeType !== 'all' ? model.activeType : 'all') as 'all' | 'movie' | 'series'

  // ── GENRE / FILTERED VIEW ──
  if (model.isFilteredView) {
    const genreTitle = model.activeGenre || (activeTypeMode === 'movie' ? 'Movies' : activeTypeMode === 'series' ? 'Series' : 'Explore')

    return (
      <Layout title={genreTitle} showHeader={false} showFooter={false}>
        <AnimatedBackground
          image={featuredItem?.background || featuredItem?.poster}
          opacity={0.38}
        />

        {/* Filter dock – back button + genre name + type toggle */}
        <div className={styles.exploreFiltersDock}>
          <div className={styles.exploreFiltersBar}>
            <button
              type="button"
              onClick={model.actions.clearFilters}
              className={styles.exploreBackBtn}
              aria-label="Go Back"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className={styles.exploreFilteredTitle}>{genreTitle}</h1>

            <div className={styles.exploreToggleGroup}>
              {(['all', 'movie', 'series'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => model.actions.updateFilter('type', m === 'all' ? '' : m)}
                  className={`${styles.exploreToggleBtn} ${activeTypeMode === m ? styles.exploreToggleBtnActive : ''}`}
                >
                  {m === 'all' ? 'All' : m === 'movie' ? 'Movies' : 'Series'}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={styles.exploreMobileSearchBtn}
              aria-label="Search movies and series"
              onClick={() => navigate(`/streaming/${model.profileId}/search`, { state: { focusSearch: true } })}
            >
              <Search size={18} aria-hidden="true" />
            </button>
            <Link
              to="/profiles"
              className={styles.exploreMobileProfileBtn}
              aria-label={profile?.name ? `Switch profile. Current: ${profile.name}` : 'Switch profile'}
            >
              <div className={styles.streamingMobileProfileAvatar}>{profileAvatar}</div>
            </Link>
          </div>
        </div>
        <div className={styles.exploreFiltersSpacer} aria-hidden="true" />

        <div className={`${styles.contentContainer} ${styles.contentOffset}`}>
          <div className={styles.catalogPage}>
            <section className={styles.catalogGridSection}>
              <div className={styles.catalogSectionHeader}>
                <div>
                  <p className={styles.catalogSectionEyebrow}>Genre</p>
                  <h2 className={styles.catalogSectionTitle}>{genreTitle}</h2>
                </div>
                {model.filteredItems.length > 0 && (
                  <div className={styles.catalogSectionMeta}>
                    <span className={styles.catalogSectionMetaPill}>
                      {activeTypeMode === 'movie' ? <Film size={14} aria-hidden="true" /> : activeTypeMode === 'series' ? <Tv size={14} aria-hidden="true" /> : <Layers3 size={14} aria-hidden="true" />}
                      {activeTypeMode === 'movie' ? 'Movies' : activeTypeMode === 'series' ? 'Series' : 'All'}
                    </span>
                    {model.hasMore ? (
                      <span className={styles.catalogSectionMetaPill}>{model.filteredItems.length}+ titles</span>
                    ) : (
                      <span className={styles.catalogSectionMetaPill}>{model.filteredItems.length} titles</span>
                    )}
                  </div>
                )}
              </div>

              {model.loading && model.filteredItems.length === 0 ? (
                <div className={styles.catalogGrid}>
                  {Array.from({ length: 20 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : model.filteredItems.length > 0 ? (
                <>
                  <div className={styles.catalogGrid}>
                    {model.filteredItems.map((item, index) => {
                      const meta = [item.releaseInfo || item.year, item.type === 'series' ? 'Series' : item.type === 'movie' ? 'Movie' : null].filter(Boolean).join(' · ')
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
                            {model.showImdbRatings && item.imdbRating ? (
                              <RatingBadge rating={parseFloat(item.imdbRating)} />
                            ) : null}
                          </div>
                          <div className={styles.catalogCardBody}>
                            <h3 className={styles.catalogCardTitle}>{item.name}</h3>
                            {meta ? <p className={styles.catalogCardMeta}>{meta}</p> : null}
                          </div>
                        </a>
                      )
                    })}
                  </div>

                  {model.hasMore ? (
                    <div className={styles.catalogLoadMoreRow}>
                      <div ref={loadMoreRef} style={{ height: 1, width: '100%' }} />
                      <div className={styles.catalogLoadingPill} aria-live="polite">Loading more titles…</div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className={styles.catalogEmptyState}>
                  <p className={styles.catalogEmptyTitle}>Nothing found for this genre</p>
                  <p className={styles.catalogEmptyDescription}>
                    Try a different type filter or go back to explore more.
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </Layout>
    )
  }

  // ── EXPLORE VIEW (not filtered) ──
  const { showHero, rowGenres, displayGenres } = model

  return (
    <Layout title="Explore" showHeader={false} showFooter={false}>
      <div className={styles.streamingLayout} style={{ minHeight: '100vh' }}>
        <div className={styles.exploreFiltersDock}>
          <div className={styles.exploreFiltersBar}>
            <div className={styles.exploreFiltersTopRow}>
              <div className={styles.exploreToggleGroup}>
                {(['all', 'movie', 'series'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => model.actions.setViewMode(m)}
                    className={`${styles.exploreToggleBtn} ${model.viewMode === m ? styles.exploreToggleBtnActive : ''}`}
                  >
                    {m === 'all' ? 'All' : m === 'movie' ? 'Movies' : 'Series'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.exploreMobileSearchBtn}
                aria-label="Search movies and series"
                onClick={() => navigate(`/streaming/${model.profileId}/search`, { state: { focusSearch: true } })}
              >
                <Search size={18} aria-hidden="true" />
              </button>
              <Link
                to="/profiles"
                className={styles.exploreMobileProfileBtn}
                aria-label={profile?.name ? `Switch profile. Current: ${profile.name}` : 'Switch profile'}
              >
                <div className={styles.streamingMobileProfileAvatar}>{profileAvatar}</div>
              </Link>
            </div>

            <div className={styles.exploreGenreSelect} ref={genreMenuRef}>
              <button
                type="button"
                className={`${styles.exploreGenreTrigger} ${genreMenuOpen ? styles.exploreGenreTriggerOpen : ''}`}
                onClick={() => setGenreMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={genreMenuOpen}
                aria-label="Filter by genre"
              >
                <span className={styles.exploreGenreTriggerValue}>Genres</span>
                <ChevronDown className={`${styles.exploreGenreTriggerIcon} ${genreMenuOpen ? styles.exploreGenreTriggerIconOpen : ''}`} />
              </button>

              {genreMenuOpen ? (
                <div className={styles.exploreGenreMenu} role="menu" aria-label="Genre filters">
                  <div className={styles.exploreGenreMenuList}>
                    <button
                      type="button"
                      className={`${styles.exploreGenreMenuItem} ${styles.exploreGenreMenuItemFeatured}`}
                      onClick={() => { setGenreMenuOpen(false); model.actions.updateFilter('genre', '') }}
                      role="menuitem"
                    >
                      All genres
                    </button>
                    {displayGenres.map((genre) => (
                      <button
                        key={genre}
                        type="button"
                        className={styles.exploreGenreMenuItem}
                        onClick={() => { setGenreMenuOpen(false); model.actions.updateFilter('genre', genre) }}
                        role="menuitem"
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className={styles.exploreGenreSelectMobile}>
                <select
                  className={styles.exploreGenreSelectInput}
                  onChange={(e) => model.actions.updateFilter('genre', e.target.value)}
                  value=""
                  aria-label="Filter by genre"
                >
                  <option value="" disabled>Genres</option>
                  {displayGenres.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <ChevronDown className={styles.exploreGenreIcon} />
              </div>
            </div>
          </div>
        </div>

        {!showHero ? (
          <div className={styles.exploreFiltersSpacer} aria-hidden="true" />
        ) : null}

        {showHero && (
          <Hero
            items={model.trending}
            profileId={model.profileId}
            showTrending={true}
            storageKey="exploreHeroIndex"
          />
        )}

        <div className={`${styles.contentContainer} ${!showHero ? styles.contentOffset : ''}`}>
          {model.viewMode === 'all' && (
            <>
              {model.trendingMovies.length > 0 && (
                <StreamingRow
                  title="Top 10 Movies Today"
                  items={model.trendingMovies}
                  profileId={model.profileId}
                  showImdbRatings={model.showImdbRatings}
                  showAgeRatings={model.showAgeRatings}
                  isRanked={true}
                />
              )}
              {model.trendingSeries.length > 0 && (
                <StreamingRow
                  title="Top 10 Series Today"
                  items={model.trendingSeries}
                  profileId={model.profileId}
                  showImdbRatings={model.showImdbRatings}
                  showAgeRatings={model.showAgeRatings}
                  isRanked={true}
                />
              )}
            </>
          )}

          {model.viewMode === 'movie' && model.trendingMovies.length > 0 && (
            <StreamingRow
              title="Top 10 Movies Today"
              items={model.trendingMovies}
              profileId={model.profileId}
              showImdbRatings={model.showImdbRatings}
              showAgeRatings={model.showAgeRatings}
              isRanked={true}
            />
          )}

          {model.viewMode === 'series' && model.trendingSeries.length > 0 && (
            <StreamingRow
              title="Top 10 Series Today"
              items={model.trendingSeries}
              profileId={model.profileId}
              showImdbRatings={model.showImdbRatings}
              showAgeRatings={model.showAgeRatings}
              isRanked={true}
            />
          )}

          {model.viewMode === 'all' && (
            <>
              <TraktRecommendationsRow profileId={model.profileId} type="movies" showImdbRatings={model.showImdbRatings} showAgeRatings={model.showAgeRatings} />
              <TraktRecommendationsRow profileId={model.profileId} type="shows" showImdbRatings={model.showImdbRatings} showAgeRatings={model.showAgeRatings} />
            </>
          )}
          {model.viewMode === 'movie' && (
            <TraktRecommendationsRow profileId={model.profileId} type="movies" showImdbRatings={model.showImdbRatings} showAgeRatings={model.showAgeRatings} />
          )}
          {model.viewMode === 'series' && (
            <TraktRecommendationsRow profileId={model.profileId} type="shows" showImdbRatings={model.showImdbRatings} showAgeRatings={model.showAgeRatings} />
          )}

          {rowGenres.map((genre) => (
            <GenreRow
              key={genre}
              genre={genre}
              profileId={model.profileId}
              showImdbRatings={model.showImdbRatings}
              showAgeRatings={model.showAgeRatings}
              type={model.viewMode === 'all' ? undefined : model.viewMode}
            />
          ))}
        </div>
      </div>
    </Layout>
  )
}
