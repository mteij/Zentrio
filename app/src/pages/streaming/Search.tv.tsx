import { Filter, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { TvFocusItem, TvFocusZone, TvSection, TvShelf } from '../../components/tv'
import type { SearchScreenModel } from './Search.model'
import { StreamingTvScaffold } from './StreamingTvScaffold'
import styles from './Search.tv.module.css'

export function StreamingSearchTvView({ model }: { model: SearchScreenModel }) {
  const navigate = useNavigate()
  const filterItems = [
    { key: 'all' as const, label: 'All titles' },
    { key: 'movie' as const, label: 'Movies only' },
    { key: 'series' as const, label: 'Series only' },
  ]

  return (
    <StreamingTvScaffold
      profileId={model.profileId}
      activeNav="search"
      eyebrow="Search"
      title={model.query ? `"${model.query}"` : 'Find something to watch'}
      description="Type a title, switch the content filter, and browse matching catalogs from your addon lineup."
      initialZoneId="search-filters"
      onBack={() => {
        if (window.history.length > 1) {
          navigate(-1)
          return
        }
        navigate(model.profileId ? `/streaming/${model.profileId}` : '/profiles')
      }}
    >
      <TvSection title="Search Query" subtitle="Focus the field to bring up the TV keyboard.">
        <div className={styles.searchPanel}>
          <form onSubmit={(event) => { event.preventDefault(); model.actions.handleSearch() }}>
            <input
              ref={model.inputRef}
              type="text"
              placeholder="Search movies & series..."
              value={model.inputValue}
              onChange={(event) => model.actions.setInputValue(event.target.value)}
              className={styles.searchInput}
            />
          </form>
        </div>
      </TvSection>

      <TvSection title="Filter" subtitle="Narrow the search before browsing results.">
        <TvFocusZone id="search-filters" orientation="vertical" nextLeft="streaming-rail" nextRight="search-results">
          {filterItems.map((item, index) => (
            <TvFocusItem
              key={item.key}
              id={`search-filter-${item.key}`}
              index={index}
              className={`${styles.filterCard} ${model.typeParam === item.key ? styles.filterActive : ''}`}
              onActivate={() => model.actions.handleTypeSelect(item.key)}
            >
              {item.key === model.typeParam ? <Filter size={18} /> : <Search size={18} />}
              <span>{item.label}</span>
            </TvFocusItem>
          ))}
        </TvFocusZone>
      </TvSection>

      <TvSection title="Results" subtitle={model.searchStatusText || 'Search each catalog for matches.'}>
        {!model.query ? (
          <TvShelf zoneId="search-results" nextLeft="search-filters">
            <TvFocusItem id="search-results-empty" className={styles.resultPanel} onActivate={model.actions.focusInput}>
              <p className={styles.resultTitle}>Start typing to search</p>
              <p className={styles.resultMeta}>Focus the query field above, enter a title, and results will appear here.</p>
            </TvFocusItem>
          </TvShelf>
        ) : model.searchCatalogs.length === 0 ? (
          <TvShelf zoneId="search-results" nextLeft="search-filters">
            <TvFocusItem id="search-results-none" className={styles.resultPanel}>
              <p className={styles.resultTitle}>No search catalogs available</p>
              <p className={styles.resultMeta}>This filter does not currently expose any searchable catalogs.</p>
            </TvFocusItem>
          </TvShelf>
        ) : (
          <TvShelf zoneId="search-results" nextLeft="search-filters">
            {model.searchCatalogs.map((catalog, index) => (
              <TvFocusItem key={catalog.manifestUrl + catalog.catalog.id} id={`search-result-${index}`} index={index} className={styles.resultPanel}>
                <p className={styles.resultTitle}>{catalog.title}</p>
                <p className={styles.resultMeta}>{catalog.addon.name} · {catalog.catalog.type}</p>
              </TvFocusItem>
            ))}
          </TvShelf>
        )}
      </TvSection>
    </StreamingTvScaffold>
  )
}

export default StreamingSearchTvView
