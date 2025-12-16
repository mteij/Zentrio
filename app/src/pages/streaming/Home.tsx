import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Play, Info } from 'lucide-react'
import { Layout, Navbar, StreamingRow, LoadingSpinner } from '../../components'
import { MetaPreview } from '../../services/addons/types'
import { WatchHistoryItem } from '../../services/database'
import styles from '../../styles/Streaming.module.css'

interface CatalogSection {
  title: string
  items: MetaPreview[]
  seeAllUrl?: string
}

interface DashboardData {
  catalogs: CatalogSection[]
  history: WatchHistoryItem[]
  trending: MetaPreview[]
  showFallbackToast: boolean
  profile: any
}

const fetchDashboard = async (profileId: string) => {
  const res = await fetch(`/api/streaming/dashboard?profileId=${profileId}`)
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

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', profileId],
    queryFn: () => fetchDashboard(profileId!),
    enabled: !!profileId,
    retry: (failureCount, error) => {
      if (error.message === 'Unauthorized') return false
      return failureCount < 2
    }
  })

  if (error?.message === 'Unauthorized') {
    navigate('/')
    return null
  }

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-gray-400">{error?.message || 'Failed to load content'}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-purple-600 rounded hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const { catalogs, history, trending, showFallbackToast, profile } = data
  const showImdbRatings = profile?.settings?.show_imdb_ratings !== false
  const showHero = true

  // Find featured items (prioritize trending, then first items from first catalog or history)
  let featuredItems: (MetaPreview | WatchHistoryItem)[] = []
  
  if (trending && trending.length > 0) {
    featuredItems = trending
  } else if (catalogs.length > 0 && catalogs[0].items.length > 0) {
    featuredItems = catalogs[0].items.slice(0, 5)
  } else if (history.length > 0) {
    featuredItems = history.slice(0, 5)
  }

  const featuredItem = featuredItems.length > 0 ? featuredItems[0] : null
  const shouldShowHero = showHero && featuredItem && ((featuredItem as any).background || featuredItem.poster)

  return (
    <Layout title="Streaming" showHeader={false} showFooter={false}>
      <Navbar profileId={parseInt(profileId!)} activePage="home" profile={profile} />
      
      <div className={`${styles.streamingLayout} ${!showHero ? styles.streamingLayoutNoHero : ''}`}>
        {shouldShowHero && (
          <>
            <div className={styles.pageAmbientBackground} id="ambientBackground" style={{
              backgroundImage: `url(${(featuredItem as any).background || featuredItem?.poster})`
            }}></div>
            
            <div className={styles.heroSection} id="heroSection" data-items={JSON.stringify(featuredItems)}>
              <div className={styles.heroBackdrop} id="heroBackdrop">
                {(featuredItem as any).background ? (
                  <img src={(featuredItem as any).background} alt="Hero Background" id="heroImage" />
                ) : featuredItem?.poster ? (
                  <img src={featuredItem.poster} alt="Hero Background" id="heroImage" style={{ filter: 'blur(20px)', transform: 'scale(1.1)' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#141414' }} id="heroImage"></div>
                )}
              </div>
              <div className={styles.heroOverlay}></div>
              <div className={styles.heroContent}>
              <div className={styles.heroInfo} id="heroInfo">
                {trending && trending.length > 0 && (
                  <div className={styles.trendingChip} id="trendingChip">
                    <TrendingUp size={16} />
                    <span id="trendingText">#1 Trending Today</span>
                  </div>
                )}
                <h1 className={styles.heroTitle} id="heroTitle">{(featuredItem as any).title || (featuredItem as any).name}</h1>
                <p className={styles.heroDescription} id="heroDescription">{(featuredItem as any).description || 'Start watching now on Zentrio.'}</p>
                <div className={styles.heroActions}>
                  <a href={`/streaming/${profileId}/${(featuredItem as any).meta_type || (featuredItem as any).type}/${(featuredItem as any).meta_id || (featuredItem as any).id}`} className={`${styles.btnHero} ${styles.btnPlay}`} id="heroPlayBtn">
                    <Play size={24} fill="currentColor" />
                    Play Now
                  </a>
                  <a href={`/streaming/${profileId}/${(featuredItem as any).meta_type || (featuredItem as any).type}/${(featuredItem as any).meta_id || (featuredItem as any).id}`} className={`${styles.btnHero} ${styles.btnMore}`} id="heroMoreBtn">
                    <Info size={24} />
                    More Info
                  </a>
                </div>
              </div>
              </div>
            </div>
          </>
        )}

        <div className={styles.contentContainer} style={{ marginTop: shouldShowHero ? '-100px' : '40px' }}>
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
                imdbRating: (h as any).imdbRating
              }))}
              profileId={profileId!}
              showImdbRatings={showImdbRatings}
            />
          )}

          {catalogs.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No catalogs found.</div>
          ) : (
            catalogs.map((section, idx) => (
              <StreamingRow
                key={idx}
                title={section.title}
                items={section.items}
                profileId={profileId!}
                showImdbRatings={showImdbRatings}
                seeAllUrl={section.seeAllUrl}
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
