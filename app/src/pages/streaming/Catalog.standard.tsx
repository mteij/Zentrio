import { useEffect, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import {
  AnimatedBackground,
  ContentCard,
  Layout,
  LoadErrorState,
  SkeletonCard,
} from '../../components'
import type { CatalogScreenModel } from './Catalog.model'
import styles from '../../styles/Streaming.module.css'

function getTypeLabel(type: string) {
  if (type === 'movie') return 'Movies'
  if (type === 'series') return 'Series'
  return 'Titles'
}

export function StreamingCatalogStandardView({ model }: { model: CatalogScreenModel }) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadMoreFn = useRef(model.loadMore)

  useEffect(() => {
    loadMoreFn.current = model.loadMore
  })

  useEffect(() => {
    if (!model.hasNextPage) return
    const target = sentinelRef.current
    if (!target) return

    if (!('IntersectionObserver' in window)) {
      const id = globalThis.setInterval(() => void loadMoreFn.current(), 700)
      return () => globalThis.clearInterval(id)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMoreFn.current()
      },
      { rootMargin: '800px 0px', threshold: 0.01 }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [model.hasNextPage])

  if (model.status === 'loading') {
    return (
      <Layout title="Loading..." showHeader={false} showFooter={false}>
        <button
          onClick={model.navigation.goBack}
          className={`${styles.backBtn} ${styles.catalogBackButton}`}
          aria-label="Go back"
        >
          <ChevronLeft size={20} />
          Back
        </button>
        <div className={`${styles.streamingLayout} ${styles.streamingLayoutNoHero}`}>
          <div className={styles.catalogPage}>
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

  const typeLabel = getTypeLabel(model.catalogType)

  return (
    <Layout title={model.title} showHeader={false} showFooter={false}>
      <AnimatedBackground image={model.ambientImage} fallbackColor="#000" opacity={0.45} />

      <button
        onClick={model.navigation.goBack}
        className={`${styles.backBtn} ${styles.catalogBackButton}`}
        aria-label="Go back"
      >
        <ChevronLeft size={20} />
        Back
      </button>

      <div className={`${styles.streamingLayout} ${styles.streamingLayoutNoHero}`}>
        <div className={styles.catalogPage}>
          <section className={styles.catalogGridSection}>
            <div className={styles.catalogSectionHeader}>
              <div>
                <p className={styles.catalogSectionEyebrow}>{typeLabel}</p>
                <h2 className={styles.catalogSectionTitle}>{model.title}</h2>
              </div>
            </div>

            {model.items.length === 0 ? (
              <div className={styles.catalogEmptyState}>
                <p className={styles.catalogEmptyTitle}>Nothing is available here yet</p>
                <p className={styles.catalogEmptyDescription}>
                  Try another collection or come back after the next catalog refresh.
                </p>
              </div>
            ) : (
              <>
                <div className={styles.catalogGrid}>
                  {model.items.map((item, index) => (
                    <ContentCard
                      key={`${item.id}-${index}`}
                      item={item}
                      profileId={model.profileId}
                      showImdbRatings={model.showImdbRatings}
                      showAgeRatings={model.showAgeRatings}
                    />
                  ))}
                </div>

                {model.hasNextPage ? (
                  <div className={styles.catalogLoadMoreRow}>
                    <div ref={sentinelRef} style={{ height: 1, width: '100%' }} />
                    {model.isFetchingNextPage ? (
                      <div className={styles.catalogLoadingPill} aria-live="polite">
                        Loading more…
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </Layout>
  )
}

export default StreamingCatalogStandardView
