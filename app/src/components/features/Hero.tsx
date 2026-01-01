import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { useNavigate } from 'react-router-dom'

import { AnimatePresence, motion } from 'framer-motion'
import { TrendingUp, Play, Info } from 'lucide-react'
import { MetaPreview } from '../../services/addons/types'
import { useAutoPlay } from '../../hooks/useAutoPlay'
import { getPackId } from '../../services/addons/stream-service'
import { LazyImage } from '../ui/LazyImage'
import styles from '../../styles/Streaming.module.css'

interface HeroProps {
  items: MetaPreview[]
  profileId: string
  showTrending?: boolean
  storageKey?: string // Key to save index in sessionStorage (optional)
}

export const Hero = memo(function Hero({ items, profileId, showTrending = false, storageKey = 'heroFeaturedIndex' }: HeroProps) {
  const navigate = useNavigate()
  const { startAutoPlay } = useAutoPlay()
  // State for cycling through featured items
  // Initialize from sessionStorage or use a placeholder (-1 means "needs initialization")
  const [featuredIndex, setFeaturedIndex] = useState(() => {
    if (!storageKey) return 0
    const stored = sessionStorage.getItem(storageKey)
    return stored !== null ? parseInt(stored, 10) : -1 
  })

  // Generate random index excluding current
  const getRandomIndex = useCallback((currentIdx: number, length: number) => {
    if (length <= 1) return 0
    let newIdx = Math.floor(Math.random() * (length - 1))
    if (newIdx >= currentIdx) newIdx++
    return newIdx
  }, [])

  // Initialize with random index on first data load, or validate stored index
  useEffect(() => {
    if (items.length === 0) return
    
    if (featuredIndex === -1 || featuredIndex >= items.length) {
      if (storageKey) {
        // Pick a random index on first load or if stored index is invalid
        const randomIdx = Math.floor(Math.random() * items.length)
        setFeaturedIndex(randomIdx)
        sessionStorage.setItem(storageKey, randomIdx.toString())
      } else {
        setFeaturedIndex(0)
      }
    }
  }, [items.length, featuredIndex, storageKey])

  // Persist index changes to sessionStorage
  useEffect(() => {
    if (storageKey && featuredIndex >= 0) {
      sessionStorage.setItem(storageKey, featuredIndex.toString())
    }
  }, [featuredIndex, storageKey])

  // Cycle through items randomly every minute
  useEffect(() => {
    if (items.length <= 1) return
    
    // Don't cycle if it's continue watching (single item usually, or specific intent)
    // But if items > 1 and not strict continue watching?
    // User requested "Continue Watching Banner", which implies single item or static top one.
    // Existing logic cycles. If items.length is 1 (common for continue watch top pick), it won't cycle.
    
    const interval = setInterval(() => {
      setFeaturedIndex(prev => getRandomIndex(prev, items.length))
    }, 60000) // 1 minute

    return () => clearInterval(interval)
  }, [items.length, getRandomIndex])

  // Ensure index is valid (in case items change)
  const currentIndex = featuredIndex >= items.length ? 0 : (featuredIndex < 0 ? 0 : featuredIndex)
  const featuredItem = items.length > 0 ? items[currentIndex] : null
  const shouldShowHero = featuredItem && ((featuredItem as any).background || featuredItem.poster)

  if (!shouldShowHero || !featuredItem) return null

  // Ensure we have properties even if type definitions are loose
  const itemTitle = (featuredItem as any).title || (featuredItem as any).name
  const itemDesc = (featuredItem as any).description || 'Start watching now on Zentrio.'
  const itemBg = (featuredItem as any).background
  const itemPoster = featuredItem.poster
  const itemType = (featuredItem as any).meta_type || (featuredItem as any).type
  const itemId = (featuredItem as any).meta_id || (featuredItem as any).id
  
  // Dynamic Button Logic
  let playButtonText = "Play Now"
  if (!showTrending) {
    const season = (featuredItem as any).season
    const episode = (featuredItem as any).episode
    if (season != null && episode != null && season !== -1 && episode !== -1) {
        playButtonText = `S${season}:E${episode}`
    } else {
        playButtonText = "Continue"
    }
  }

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault()
    
    const season = (featuredItem as any).season
    const episode = (featuredItem as any).episode
    const lastStream = (featuredItem as any).lastStream
    
    // Use unified auto-play hook with pack matching
    startAutoPlay({
      profileId,
      meta: {
        id: itemId,
        type: itemType,
        name: itemTitle,
        poster: itemPoster
      },
      season,
      episode,
      lastStream,
      preferredPackId: lastStream ? getPackId(lastStream) : null
    })
  }

  // Calculate rank for interlaced lists (count items of same type up to current index)
  const correctRank = items.slice(0, currentIndex + 1).filter(i => {
      const t = (i as any).meta_type || (i as any).type
      return t === itemType
  }).length

  return (
    <>
      <AnimatePresence mode="sync">
        <motion.div
          key={`ambient-${currentIndex}`}
          className={styles.pageAmbientBackground}
          id="ambientBackground"
          style={{
            backgroundImage: `url(${itemBg || itemPoster})`
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </AnimatePresence>
      
      <div className={styles.heroSection} id="heroSection">
        <div className={styles.heroBackdrop} id="heroBackdrop">
          <AnimatePresence mode="sync">
            {itemBg ? (
              <motion.div
                key={`hero-bg-${currentIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
              >
                <LazyImage
                  src={itemBg}
                  alt="Hero Background"
                  priority={true}
                  blurAmount={0}
                  style={{ width: '100%', height: '100%' }}
                />
              </motion.div>
            ) : itemPoster ? (
              <motion.div
                key={`hero-poster-${currentIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
              >
                <LazyImage
                  src={itemPoster}
                  alt="Hero Background"
                  priority={true}
                  blurAmount={20}
                  style={{
                    width: '100%',
                    height: '100%',
                    filter: 'blur(20px)',
                    transform: 'scale(1.1)'
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key={`hero-empty-${currentIndex}`}
                style={{ width: '100%', height: '100%', background: '#141414', position: 'absolute' }}
                id="heroImage"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
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
              {showTrending && (
                <div className={styles.trendingChip} id="trendingChip">
                  <TrendingUp size={16} />
                  <span id="trendingText">#{correctRank} Trending {itemType === 'movie' ? 'Movie' : 'Series'} Today</span>
                </div>
              )}
              {/* @ts-ignore */}
              {featuredItem.logo ? (
                 <img 
                    src={(featuredItem as any).logo} 
                    alt={itemTitle} 
                    className={styles.heroLogo}
                    style={{ maxHeight: '150px', maxWidth: '300px', marginBottom: '1rem', objectFit: 'contain' }} 
                 />
              ) : (
                 <h1 className={styles.heroTitle} id="heroTitle">{itemTitle}</h1>
              )}
              
              <p className={styles.heroDescription} id="heroDescription">{itemDesc}</p>
              <div className={styles.heroActions}>
                <a 
                   href={`/streaming/${profileId}/${itemType}/${itemId}`} 
                   onClick={handlePlay}
                   className={`${styles.btnHero} ${styles.btnPlay}`} 
                   id="heroPlayBtn"
                >
                  <Play size={24} fill="currentColor" />
                  {playButtonText}
                </a>
                <a 
                   href={`/streaming/${profileId}/${itemType}/${itemId}`} 
                   onClick={(e) => { e.preventDefault(); navigate(`/streaming/${profileId}/${itemType}/${itemId}`) }}
                   className={`${styles.btnHero} ${styles.btnInfo}`} 
                   style={{ background: 'rgba(255,255,255,0.3)', color: 'white' }}
                >
                    <Info size={24} />
                    More Info
                </a>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if items or key props change
  return (
    prevProps.items === nextProps.items &&
    prevProps.profileId === nextProps.profileId &&
    prevProps.showTrending === nextProps.showTrending &&
    prevProps.storageKey === nextProps.storageKey
  )
})
