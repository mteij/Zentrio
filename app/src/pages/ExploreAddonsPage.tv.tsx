import { LoadErrorState, SkeletonAddonCard } from '../components'
import { TvFocusItem, TvGrid, TvPageScaffold, TvSection, TvShelf } from '../components/tv'
import { sanitizeImgSrc } from '../lib/url'
import type { AddonRecord, ExploreAddonsScreenModel } from './ExploreAddonsPage.model'
import styles from './ExploreAddonsPage.tv.module.css'

function isInstalled(model: ExploreAddonsScreenModel, addon: AddonRecord) {
  return model.installedAddons.find(
    (installed) =>
      installed.id === addon.manifest.id || installed.manifest_url === addon.transportUrl
  )
}

export function ExploreAddonsPageTvView({ model }: { model: ExploreAddonsScreenModel }) {
  if (model.status === 'loading') {
    return (
      <div className="h-screen bg-black flex flex-col px-20 pt-16 gap-8 animate-pulse overflow-hidden">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-24 rounded-full bg-white/10" />
          <div className="h-10 w-72 rounded-lg bg-white/[0.08]" />
        </div>
        <div className="grid grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonAddonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (model.status === 'error') {
    return (
      <LoadErrorState
        message={model.errorMessage || 'Failed to load addons.'}
        onRetry={() => {
          void model.actions.retry()
        }}
        onBack={model.navigation.goBack}
      />
    )
  }

  const visibleAddons =
    model.filteredAddons.length > 0 ? model.filteredAddons : model.recommendedAddons

  return (
    <TvPageScaffold
      eyebrow="Settings"
      title="Community Addons"
      description="Install new catalog, stream, and subtitle sources without leaving the TV experience."
      initialZoneId="addons-filters"
      onBack={model.navigation.goBack}
    >
      <TvSection title="Categories">
        <TvShelf zoneId="addons-filters" nextDown="addons-recommended">
          {model.categories.map((category, index) => (
            <TvFocusItem
              key={category}
              id={`addons-filter-${category}`}
              index={index}
              className={styles.filterChip}
              onActivate={() => model.actions.setSelectedCategory(category)}
            >
              {category === 'all' ? 'All' : category}
            </TvFocusItem>
          ))}
        </TvShelf>
      </TvSection>

      <TvSection title="Recommended">
        <TvGrid
          zoneId="addons-recommended"
          columns={3}
          nextUp="addons-filters"
          nextDown="addons-all"
        >
          {model.recommendedAddons.map((addon, index) => {
            const installed = isInstalled(model, addon)
            return (
              <TvFocusItem
                key={addon.manifest.id}
                id={`addons-recommended-${addon.manifest.id}`}
                index={index}
                className={styles.addonCard}
                onActivate={() =>
                  void (installed
                    ? model.actions.configureAddon(addon)
                    : model.actions.installAddon(addon))
                }
              >
                <div
                  className={styles.logo}
                  style={{ backgroundImage: `url(${sanitizeImgSrc(addon.manifest.logo || '')})` }}
                />
                <p className={styles.addonTitle}>{addon.manifest.name}</p>
                <p className={styles.addonMeta}>{addon.manifest.description}</p>
                <div className={styles.actionRow}>
                  <span className={styles.actionPill}>
                    {installed ? 'Installed' : 'Press to install'}
                  </span>
                  <span className={styles.actionPill}>v{addon.manifest.version}</span>
                </div>
              </TvFocusItem>
            )
          })}
        </TvGrid>
      </TvSection>

      <TvSection title="All Addons" subtitle="The list respects the selected category filter.">
        {visibleAddons.length > 0 ? (
          <TvGrid zoneId="addons-all" columns={3} nextUp="addons-recommended">
            {visibleAddons.map((addon, index) => {
              const installed = isInstalled(model, addon)
              return (
                <TvFocusItem
                  key={`${addon.manifest.id}-${index}`}
                  id={`addons-all-${addon.manifest.id}-${index}`}
                  index={index}
                  className={styles.addonCard}
                  onActivate={() =>
                    void (installed
                      ? model.actions.configureAddon(addon)
                      : model.actions.installAddon(addon))
                  }
                >
                  <div
                    className={styles.logo}
                    style={{ backgroundImage: `url(${sanitizeImgSrc(addon.manifest.logo || '')})` }}
                  />
                  <p className={styles.addonTitle}>{addon.manifest.name}</p>
                  <p className={styles.addonMeta}>{addon.manifest.description}</p>
                  <div className={styles.actionRow}>
                    <span className={styles.actionPill}>{installed ? 'Configure' : 'Install'}</span>
                    <span className={styles.actionPill}>{addon.manifest.types.join(' · ')}</span>
                  </div>
                </TvFocusItem>
              )
            })}
          </TvGrid>
        ) : (
          <TvShelf zoneId="addons-all" nextUp="addons-recommended">
            <TvFocusItem
              id="addons-empty"
              className={`${styles.addonCard} ${styles.emptyCard}`}
              onActivate={model.actions.clearFilters}
            >
              <p className={styles.addonTitle}>No addons match this filter</p>
              <p className={styles.addonMeta}>
                Clear the current category or search filter to browse the full collection again.
              </p>
            </TvFocusItem>
          </TvShelf>
        )}
      </TvSection>
    </TvPageScaffold>
  )
}

export default ExploreAddonsPageTvView
