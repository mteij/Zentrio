import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TrendingUp, Play, Info } from 'lucide-react'
import { Layout, Navbar, StreamingRow, SkeletonHero, SkeletonRow } from '../../components'
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

  // State for cycling through featured items - must be before any returns
  // Initialize from sessionStorage or use a placeholder (-1 means "needs initialization")
  const [featuredIndex, setFeaturedIndex] = useState(() => {
    const stored = sessionStorage.getItem('heroFeaturedIndex')
    return stored !== null ? parseInt(stored, 10) : -1 // -1 means pick random on first data load
  })

  // Get featured items from data (or empty array if no data yet)
  const featuredItems = useMemo(() => {
    if (!data) return []
    const { catalogs, history, trending } = data
    if (trending && trending.length > 0) {
      return trending
    } else if (catalogs.length > 0 && catalogs[0].items.length > 0) {
      return catalogs[0].items.slice(0, 10)
    } else if (history.length > 0) {
      return history.slice(0, 10)
    }
    return []
  }, [data])

  // Generate random index excluding current
  const getRandomIndex = useCallback((currentIdx: number, length: number) => {
    if (length <= 1) return 0
    let newIdx = Math.floor(Math.random() * (length - 1))
    if (newIdx >= currentIdx) newIdx++
    return newIdx
  }, [])

  // Initialize with random index on first data load, or validate stored index
  useEffect(() => {
    if (featuredItems.length === 0) return
    
    if (featuredIndex === -1 || featuredIndex >= featuredItems.length) {
      // Pick a random index on first load or if stored index is invalid
      const randomIdx = Math.floor(Math.random() * featuredItems.length)
      setFeaturedIndex(randomIdx)
      sessionStorage.setItem('heroFeaturedIndex', randomIdx.toString())
    }
  }, [featuredItems.length, featuredIndex])

  // Persist index changes to sessionStorage
  useEffect(() => {
    if (featuredIndex >= 0) {
      sessionStorage.setItem('heroFeaturedIndex', featuredIndex.toString())
    }
  }, [featuredIndex])

  // Cycle through items randomly every minute
  useEffect(() => {
    if (featuredItems.length <= 1) return

    const interval = setInterval(() => {
      setFeaturedIndex(prev => getRandomIndex(prev, featuredItems.length))
    }, 60000) // 1 minute

    return () => clearInterval(interval)
  }, [featuredItems.length, getRandomIndex])

  // Handle unauthorized redirect
  useEffect(() => {
    if (error?.message === 'Unauthorized') {
      navigate('/')
    }
  }, [error, navigate])

  if (error?.message === 'Unauthorized') {
    return null
  }

  if (isLoading) {
    return (
      <Layout title="Streaming" showHeader={false} showFooter={false}>
        <Navbar profileId={parseInt(profileId!)} activePage="home" />
        <div className={styles.streamingLayout}>
          <SkeletonHero />
          <div className={styles.contentContainer} style={{ marginTop: '-100px' }}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </div>
      </Layout>
    )
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

  // Ensure index is valid (in case items change)
  const currentIndex = featuredIndex >= featuredItems.length ? 0 : featuredIndex
  const featuredItem = featuredItems.length > 0 ? featuredItems[currentIndex] : null
  const shouldShowHero = showHero && featuredItem && ((featuredItem as any).background || featuredItem.poster)

  return (
    <Layout title="Streaming" showHeader={false} showFooter={false}>
      <Navbar profileId={parseInt(profileId!)} activePage="home" profile={profile} />
      
      <div className={`${styles.streamingLayout} ${!showHero ? styles.streamingLayoutNoHero : ''}`}>
        {shouldShowHero && (
          <>
            <AnimatePresence mode="sync">
              <motion.div 
                key={`ambient-${currentIndex}`}
                className={styles.pageAmbientBackground} 
                id="ambientBackground" 
                style={{
                  backgroundImage: `url(${(featuredItem as any).background || featuredItem?.poster})`
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              />
            </AnimatePresence>
            
            <div className={styles.heroSection} id="heroSection" data-items={JSON.stringify(featuredItems)}>
              <div className={styles.heroBackdrop} id="heroBackdrop">
                <AnimatePresence mode="sync">
                  {(featuredItem as any).background ? (
                    <motion.img 
                      key={`hero-bg-${currentIndex}`}
                      src={(featuredItem as any).background} 
                      alt="Hero Background" 
                      id="heroImage"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.2, ease: "easeInOut" }}
                      style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : featuredItem?.poster ? (
                    <motion.img 
                      key={`hero-poster-${currentIndex}`}
                      src={featuredItem.poster} 
                      alt="Hero Background" 
                      id="heroImage" 
                      style={{ filter: 'blur(20px)', transform: 'scale(1.1)', position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.2, ease: "easeInOut" }}
                    />
                  ) : (
                    <motion.div 
                      key={`hero-empty-${currentIndex}`}
                      style={{ width: '100%', height: '100%', background: '#141414', position: 'absolute' }} 
                      id="heroImage"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1.2, ease: "easeInOut" }}
                    />
                  )}
                </AnimatePresence>
              </div>
              <div className={styles.heroOverlay}></div>
              <div className={styles.heroContent}>
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={`hero-info-${currentIndex}`}
                    className={styles.heroInfo} 
                    id="heroInfo"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  >
                    {trending && trending.length > 0 && (
                      <div className={styles.trendingChip} id="trendingChip">
                        <TrendingUp size={16} />
                        <span id="trendingText">#{currentIndex + 1} Trending Today</span>
                      </div>
                    )}
                    <h1 className={styles.heroTitle} id="heroTitle">{(featuredItem as any).title || (featuredItem as any).name}</h1>
                    <p className={styles.heroDescription} id="heroDescription">{(featuredItem as any).description || 'Start watching now on Zentrio.'}</p>
                    <div className={styles.heroActions}>
                      <a href={`/streaming/${profileId}/${(featuredItem as any).meta_type || (featuredItem as any).type}/${(featuredItem as any).meta_id || (featuredItem as any).id}`} className={`${styles.btnHero} ${styles.btnPlay}`} id="heroPlayBtn">
                        <Play size={24} fill="currentColor" />
                        Play Now
                      </a>
                    </div>
                  </motion.div>
                </AnimatePresence>
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
