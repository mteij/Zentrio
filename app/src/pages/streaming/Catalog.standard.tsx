import { ChevronLeft } from 'lucide-react'
import { AnimatedBackground, Layout, LazyImage, LoadErrorState, RatingBadge, SkeletonCard } from '../../components'
import type { CatalogScreenModel } from './Catalog.model'
import styles from '../../styles/Streaming.module.css'

export function StreamingCatalogStandardView({ model }: { model: CatalogScreenModel }) {
  if (model.status === 'loading') {
    return (
      <Layout title="Loading..." showHeader={false} showFooter={false}>
        <button onClick={model.navigation.goBack} className={styles.backBtn}>
          <ChevronLeft size={20} />
          Back
        </button>
        <div className={`${styles.streamingLayout} ${styles.streamingLayoutNoHero}`}>
          <div className={styles.contentContainer}>
            <div className={styles.rowHeader}>
              <div style={{ width: '200px', height: '40px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '8px', position: 'relative', overflow: 'hidden' }}>
                <div className={styles.skeletonShimmer} />
              </div>
            </div>
            <div className={styles.mediaGrid}>
              {Array.from({ length: 20 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
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

      <button onClick={model.navigation.goBack} className={styles.backBtn}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
        </svg>
        Back
      </button>

      <div className={`${styles.streamingLayout} ${styles.streamingLayoutNoHero}`}>
        <div className={styles.contentContainer}>
          <div className={styles.rowHeader}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#fff', margin: 0 }}>{model.title}</h1>
          </div>

          {model.items.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No items found in this catalog.</div>
          ) : (
            <div className={styles.mediaGrid}>
              {model.items.map((item, index) => (
                <a
                  key={`${item.id}-${index}`}
                  href={`/streaming/${model.profileId}/${item.type}/${item.id}`}
                  className={styles.mediaCard}
                >
                  <div className={styles.posterContainer}>
                    {item.poster ? (
                      <LazyImage src={item.poster} alt={item.name} className={styles.posterImage} />
                    ) : (
                      <div className="flex items-center justify-center bg-gray-800 text-gray-400 w-full h-full p-2 text-center text-sm">{item.name}</div>
                    )}
                    {item.imdbRating ? <RatingBadge rating={parseFloat(item.imdbRating)} /> : null}
                    <div className={styles.cardOverlay}>
                      <div className={styles.cardTitle}>{item.name}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {model.hasNextPage ? (
            <div className="h-20 flex items-center justify-center w-full">
              {model.isFetchingNextPage ? (
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500" />
              ) : (
                <button className={styles.seeAllLink} onClick={() => void model.loadMore()}>
                  Load More
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Layout>
  )
}

export default StreamingCatalogStandardView
