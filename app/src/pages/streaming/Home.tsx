import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { Layout, StreamingRow, LazyCatalogRow, SkeletonHero, SkeletonRow, Hero, LoadErrorState } from '../../components'
import { MetaPreview } from '../../services/addons/types'
import { WatchHistoryItem } from '../../services/database'
import styles from '../../styles/Streaming.module.css'
import { apiFetch } from '../../lib/apiFetch'
import { useAuthStore } from '../../stores/authStore'

interface CatalogMetadata {
  addon: { id: string; name: string; logo?: string }
  manifestUrl: string
  catalog: { type: string; id: string; name?: string }
  title: string
  seeAllUrl: string
}

interface DashboardData {
  catalogMetadata: CatalogMetadata[]
  history: WatchHistoryItem[]
  // Enriched hero item for Continue Watching (so it matches Top 10/trending banners)
  continueWatchingHero?: MetaPreview | null
  trending: MetaPreview[]
  showFallbackToast: boolean
  profile: any
}

const fetchDashboard = async (profileId: string) => {
  console.log('[Home] fetchDashboard called for:', profileId);
  const res = await apiFetch(`/api/streaming/dashboard?profileId=${profileId}`)
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Unauthorized')
    }
    throw new Error('Failed to load dashboard')
  }
  return res.json() as Promise<DashboardData>
}

export const StreamingHome = () => {
  const { profileId } = useParams<{ profileId: string }>()
  const navigate = useNavigate()

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['dashboard', profileId],
    queryFn: () => fetchDashboard(profileId!),
    enabled: !!profileId,
    staleTime: 1000 * 60 * 5, // 5 minutes - cache dashboard data
    gcTime: 1000 * 60 * 30, // 30 minutes - keep in memory
    retry: (failureCount, error) => {
      if (error.message === 'Unauthorized') return false
      return failureCount < 2
    },
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData
  })

  useEffect(() => {
    const handleHistoryUpdate = () => {
      refetch()
    }
    
    window.addEventListener('history-updated', handleHistoryUpdate)
    return () => window.removeEventListener('history-updated', handleHistoryUpdate)
  }, [refetch])

  // Determine Hero Items
  // Requirement: Banner from first entry in continue watching if available, otherwise Top 10
  const heroConfig = useMemo(() => {
    if (!data) return { items: [], showTrending: false }
    const { continueWatchingHero, history, trending } = data

    // Prefer server-enriched Continue Watching hero so it matches Top 10 banners
    if (continueWatchingHero) {
      return {
        items: [continueWatchingHero],
        showTrending: false
      }
    }
    
    // Fallback (legacy): use first continue watching item (may miss banner fields)
    if (history.length > 0) {
      return {
        items: [history[0]] as unknown as MetaPreview[],
        showTrending: false
      }
    }
    
    if (trending && trending.length > 0) {
      return { items: trending, showTrending: true }
    }

    return { items: [], showTrending: false }
  }, [data])

  // Handle unauthorized redirect
  useEffect(() => {
    if (error?.message === 'Unauthorized') {
      console.log('[Home] 401 Unauthorized received, logging out locally...');
      useAuthStore.getState().logout();
      navigate('/')
    }
  }, [error, navigate])

  if (error?.message === 'Unauthorized') {
    return null
  }

  if (isLoading) {
    return (
      <Layout title="Streaming" showHeader={false} showFooter={false}>
        <div className={styles.streamingLayout}>
          <SkeletonHero />
          <div className={styles.contentContainer}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </div>
      </Layout>
    )
  }

  if (error || !data) {
    const errorMessage = error?.message && error.message !== 'Failed to load dashboard'
      ? error.message
      : 'Failed to load, try again.'

    const handleGoBack = () => {
      if (window.history.length > 1) {
        navigate(-1)
        return
      }
      navigate('/profiles')
    }

    return (
      <LoadErrorState
        message={errorMessage}
        onRetry={() => {
          void refetch()
        }}
        isRetrying={isFetching}
        onBack={handleGoBack}
      />
    )
  }

  const { catalogMetadata, history, showFallbackToast, profile } = data
  const showImdbRatings = profile?.settings?.show_imdb_ratings !== false

  const shouldShowHero = heroConfig.items.length > 0

  return (
    <Layout title="Streaming" showHeader={false} showFooter={false}>
      
      <div className={`${styles.streamingLayout} ${!shouldShowHero ? styles.streamingLayoutNoHero : ''}`}>
        {shouldShowHero && (
          <Hero 
            items={heroConfig.items} 
            profileId={profileId!} 
            showTrending={heroConfig.showTrending}
            storageKey="homeHeroIndex" 
          />
        )}

        <div className={`${styles.contentContainer} ${!shouldShowHero ? styles.contentOffset : ''}`}>
          {history.length > 0 && (
            <StreamingRow
              title="Continue Watching"
              items={history.map(h => ({
                id: h.meta_id,
                type: h.meta_type,
                name: h.title || '',
                poster: h.poster,
                background: (h as any).background,
                logo: (h as any).logo,
                description: (h as any).description,
                releaseInfo: (h as any).releaseInfo,
                imdbRating: (h as any).imdbRating,
                progressPercent: (h as any).progressPercent,
                episodeDisplay: (h as any).episodeDisplay,
                lastStream: (h as any).lastStream,
                season: h.season,
                episode: h.episode
              }))}
              profileId={profileId!}
              showImdbRatings={showImdbRatings}
              isContinueWatching={true}
            />
          )}

          {catalogMetadata.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No content found. Please install some addons.</div>
          ) : (
            catalogMetadata.map((metadata, idx) => (
              <LazyCatalogRow
                key={`${metadata.manifestUrl}-${metadata.catalog.type}-${metadata.catalog.id}`}
                metadata={metadata}
                profileId={profileId!}
                showImdbRatings={showImdbRatings}
                priority={idx < 1 ? 'eager' : 'lazy'}
              />
            ))
          )}
        </div>
      </div>
      {showFallbackToast && (
        <script dangerouslySetInnerHTML={{__html: `
            document.addEventListener('DOMContentLoaded', () => {
              if (window.addToast) {
                window.addToast('message', 'Default Addon Used', 'No addons were found for this profile, so we are using the default Cinemeta addon to provide content.');
              }
            });
        `}} />
      )}
    </Layout>
  )
}
