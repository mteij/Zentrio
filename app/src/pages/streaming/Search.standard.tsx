import { useQuery } from '@tanstack/react-query'
import { Filter, Search, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AnimatedBackground, Layout, SkeletonRow } from '../../components'
import { SearchCatalogRow } from '../../components/features/SearchCatalogRow'
import { useRootScrollPinned } from '../../hooks/useRootScrollPinned'
import { buildAvatarUrl, sanitizeImgSrc } from '../../lib/url'
import type { SearchScreenModel } from './Search.model'
import styles from '../../styles/Streaming.module.css'

export function StreamingSearchStandardView({ model }: { model: SearchScreenModel }) {
  const stickyHeader = useRootScrollPinned({ extraTopPx: 10 })

  // Read profile from cache populated by StreamingLayout — no extra fetch
  const { data: profile } = useQuery<any>({
    queryKey: ['streaming-profile', model.profileId],
    enabled: false,
  })

  const profileAvatar = profile?.avatar ? (
    <img src={sanitizeImgSrc(buildAvatarUrl(profile.avatar, profile.avatar_style || 'bottts-neutral'))} alt="" />
  ) : (
    <User size={18} aria-hidden="true" />
  )

  return (
    <Layout title="Search" showHeader={false} showFooter={false}>
      <AnimatedBackground image={model.firstPreviewImage} fallbackColor="#000" opacity={0.4} />
      <div className={`${styles.streamingLayout} ${styles.searchLayout}`}>
        <div ref={stickyHeader.sentinelRef} className={styles.stickySentinel} aria-hidden="true" />
        <div className={styles.stickyHeaderShell} style={stickyHeader.spacerStyle}>
          <div
            ref={stickyHeader.headerRef}
            className={`${styles.exploreHeader} ${styles.searchTopBar} ${stickyHeader.isPinned ? styles.exploreHeaderPinned : ''}`}
          >
            <div className={styles.searchInputShell} id="streamingSearchInputShell">
              <Search size={18} className={styles.searchInputIcon} />
              <form onSubmit={(event) => { event.preventDefault(); model.actions.handleSearch() }} id="searchForm" className={styles.searchInputForm}>
                <input
                  ref={model.inputRef}
                  type="text"
                  name="q"
                  id="searchInput"
                  placeholder="Search movies & series..."
                  value={model.inputValue}
                  onChange={(event) => model.actions.setInputValue(event.target.value)}
                  autoComplete="off"
                  className={styles.searchInputField}
                />
              </form>
            </div>

            <div className={styles.searchFilterWrap}>
              <div className={styles.exploreToggleGroup}>
                {(['all', 'movie', 'series'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => model.actions.handleFilterChange('type', type)}
                    className={`${styles.exploreToggleBtn} ${model.typeParam === type ? styles.exploreToggleBtnActive : ''}`}
                  >
                    {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'Series'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className={styles.searchMobileFilterBtn}
                aria-label="Open type filter"
                onClick={() => model.actions.setMobileFilterOpen(!model.mobileFilterOpen)}
              >
                <Filter size={16} />
              </button>
              <Link
                to="/profiles"
                className={styles.searchMobileProfileBtn}
                aria-label="Switch profile"
              >
                <div className={styles.streamingMobileProfileAvatar}>
                  {profileAvatar}
                </div>
              </Link>
            </div>
          </div>
        </div>

        {model.mobileFilterOpen ? (
          <>
            <div className={styles.searchMobileFilterBackdrop} onClick={() => model.actions.setMobileFilterOpen(false)} />
            <div className={styles.searchMobileFilterMenu}>
              {(['all', 'movie', 'series'] as const).map((type) => (
                <button
                  key={`mobile-${type}`}
                  type="button"
                  onClick={() => model.actions.handleTypeSelect(type)}
                  className={`${styles.searchMobileFilterOption} ${model.typeParam === type ? styles.searchMobileFilterOptionActive : ''}`}
                >
                  {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'Series'}
                </button>
              ))}
            </div>
          </>
        ) : null}

        <div className={styles.contentContainer}>
          {model.query ? (
            <>
              <h1 className={styles.searchResultsHeading}>Results for &quot;{model.query}&quot;</h1>
              {model.searchStatusText ? <p className={styles.searchStatusText}>{model.searchStatusText}</p> : null}
            </>
          ) : null}

          {!model.query ? (
            <div className={styles.searchEmptyState}>Start typing to search for movies and series...</div>
          ) : model.isCatalogMetadataLoading ? (
            <div className={styles.catalogRows}>
              {Array.from({ length: 3 }).map((_, index) => (
                <SkeletonRow key={`search-skeleton-${index}`} />
              ))}
            </div>
          ) : model.isCatalogMetadataError ? (
            <div className={styles.searchEmptyState}>Search sources could not be loaded right now.</div>
          ) : (
            <>
              <div className={styles.catalogRows}>
                {model.searchCatalogs.map((result) => (
                  <SearchCatalogRow
                    key={`${result.manifestUrl}-${result.catalog.type}-${result.catalog.id}`}
                    addon={result.addon}
                    manifestUrl={result.manifestUrl}
                    catalog={result.catalog}
                    title={result.title}
                    query={model.query}
                    profileId={model.profileId}
                    onStatusChange={model.actions.handleRowStatusChange}
                  />
                ))}
              </div>

              {model.showNoResults ? (
                <div className={styles.searchEmptyState}>No results found for &quot;{model.query}&quot;.</div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default StreamingSearchStandardView
