import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Layout, Navbar, RatingBadge, LazyImage, StreamingRow, SkeletonRow, SkeletonCard } from '../../components'
import { MetaPreview } from '../../services/addons/types'
import { useAppearanceSettings } from '../../hooks/useAppearanceSettings'
import styles from '../../styles/Streaming.module.css'

interface CatalogSection {
  title: string
  items: MetaPreview[]
  seeAllUrl?: string
}

interface ExploreData {
  catalogs: CatalogSection[]
  items: MetaPreview[]
  filters: { types: string[], genres: string[] }
  history: any[]
  profile: any
}

export const StreamingExplore = () => {
  const { profileId } = useParams<{ profileId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showImdbRatings, showAgeRatings } = useAppearanceSettings()
  const [data, setData] = useState<ExploreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState<MetaPreview[]>([])
  const [skip, setSkip] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const type = searchParams.get('type') || ''
  const genre = searchParams.get('genre') || ''

  useEffect(() => {
    if (!profileId) {
      navigate('/profiles')
      return
    }
    loadInitialData()
  }, [profileId, type, genre])

  const loadInitialData = async () => {
    setLoading(true)
    setItems([])
    setSkip(0)
    setHasMore(true)
    try {
      // Fetch filters and dashboard data (which includes profile)
      const [filtersRes, dashboardRes] = await Promise.all([
        fetch(`/api/streaming/filters?profileId=${profileId}`),
        fetch(`/api/streaming/dashboard?profileId=${profileId}`)
      ])
      const filtersData = await filtersRes.json()
      const dashboardData = await dashboardRes.json()

      let fetchedItems: MetaPreview[] = []
      let catalogs: CatalogSection[] = []

      if (type || genre) {
        const catalogRes = await fetch(`/api/streaming/catalog?profileId=${profileId}&type=${type}&genre=${genre}&skip=0`)
        const catalogData = await catalogRes.json()
        fetchedItems = catalogData.items || []
      } else {
        // If no filters, use catalogs from dashboard
        catalogs = dashboardData.catalogs || []
      }

      setData({
        filters: filtersData.filters,
        items: fetchedItems,
        catalogs,
        history: [],
        profile: dashboardData.profile || {}
      })
      setItems(fetchedItems)
      setSkip(fetchedItems.length)
      if (fetchedItems.length < 20) setHasMore(false)

    } catch (err) {
      console.error(err)
      setError('Failed to load content')
    } finally {
      setLoading(false)
    }
  }

  const loadMore = async () => {
    if (loadingMore || !hasMore || (!type && !genre)) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/streaming/catalog?profileId=${profileId}&type=${type}&genre=${genre}&skip=${skip}`)
      const newData = await res.json()
      
      if (newData.items && newData.items.length > 0) {
        setItems(prev => {
            const existingIds = new Set(prev.map(i => i.id))
            const uniqueNewItems = newData.items.filter((i: MetaPreview) => !existingIds.has(i.id))
            return [...prev, ...uniqueNewItems]
        })
        setSkip(prev => prev + newData.items.length)
        if (newData.items.length < 20) setHasMore(false)
      } else {
        setHasMore(false)
      }
    } catch (e) {
      console.error('Failed to load more', e)
    } finally {
      setLoadingMore(false)
    }
  }

  // Infinite scroll handler
  useEffect(() => {
    const handleScroll = () => {
      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
        loadMore()
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [loadingMore, hasMore, skip, type, genre])

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (value) {
      newParams.set(key, value)
    } else {
      newParams.delete(key)
    }
    setSearchParams(newParams)
  }

  if (loading) {
    return (
      <Layout title="Explore" showHeader={false} showFooter={false}>
        <Navbar profileId={parseInt(profileId!)} activePage="explore" />
        <div className={`${styles.streamingLayout} ${styles.streamingLayoutNoHero}`}>
          <div className={styles.contentContainer} style={{ marginTop: '0' }}>
            <div style={{ padding: '0 60px', marginBottom: '30px' }}>
              <h1 style={{ fontSize: '3rem', fontWeight: '800', margin: 0 }}>Explore</h1>
            </div>
            {/* Skeleton filter tabs */}
            <div style={{ padding: '0 60px', marginBottom: '40px', display: 'flex', gap: '16px' }}>
              <div style={{ width: '120px', height: '44px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', position: 'relative', overflow: 'hidden' }}>
                <div className={styles.skeletonShimmer} />
              </div>
              <div style={{ width: '120px', height: '44px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', position: 'relative', overflow: 'hidden' }}>
                <div className={styles.skeletonShimmer} />
              </div>
            </div>
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#141414', color: 'white' }}>
        {error || 'Error loading explore'}
      </div>
    )
  }

  const { filters, catalogs } = data

  return (
    <Layout title="Explore" showHeader={false} showFooter={false}>
      <Navbar profileId={parseInt(profileId!)} activePage="explore" profile={data.profile} />
      
      <div className={`${styles.streamingLayout} ${styles.streamingLayoutNoHero}`}>
        <div className={styles.contentContainer} style={{ marginTop: '0' }}>
          
          <div style={{ padding: '0 60px', marginBottom: '30px' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: '800', margin: 0 }}>Explore</h1>
          </div>

          {/* Filters Section */}
          <div className="filters-section" style={{ padding: '0 60px', marginBottom: '40px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <select 
              className="filter-select" 
              value={type} 
              onChange={(e) => updateFilter('type', e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '1rem',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="" style={{ color: '#000' }}>All Types</option>
              {filters.types.map(t => (
                <option key={t} value={t} style={{ color: '#000' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>

            <select 
              className="filter-select" 
              value={genre} 
              onChange={(e) => updateFilter('genre', e.target.value)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '1rem',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="" style={{ color: '#000' }}>All Genres</option>
              {filters.genres.map(g => (
                <option key={g} value={g} style={{ color: '#000' }}>{g}</option>
              ))}
            </select>
          </div>

          {/* Filtered Results Grid */}
          {items.length > 0 ? (
             <div className={styles.contentRow}>
               <div className={styles.rowHeader}>
                 <h2 className={styles.rowTitle}>
                   {genre ? `${genre} ` : ''}
                   {type ? (type === 'movie' ? 'Movies' : 'Series') : 'Results'}
                 </h2>
               </div>
                <div className={styles.mediaGrid}>
                 {items.map(item => (
                   <a key={item.id} href={`/streaming/${profileId}/${item.type}/${item.id}`} className={styles.mediaCard}>
                     <div className={styles.posterContainer}>
                       {item.poster ? (
                           <LazyImage src={item.poster} alt={item.name} className={styles.posterImage} />
                         ) : (
                           <div className="flex items-center justify-center bg-gray-800 text-gray-400 w-full h-full p-2 text-center text-sm">{item.name}</div>
                         )}
                         <div className={styles.badgesContainer}>
                           {showImdbRatings && item.imdbRating && (
                             <RatingBadge rating={parseFloat(item.imdbRating)} />
                           )}
                           {/* @ts-ignore */}
                           {showAgeRatings && (item.certification || item.rating || item.contentRating) && (
                             <span className={styles.ageRatingBadge}>
                               {/* @ts-ignore */}
                               {item.certification || item.rating || item.contentRating}
                             </span>
                           )}
                         </div>
                         <div className={styles.cardOverlay}>
                           <div className={styles.cardTitle}>{item.name}</div>
                         </div>
                       </div>
                     </a>
                   )
                 )}
               </div>
               {loadingMore && <div className="text-center p-5 text-gray-500">Loading more...</div>}
             </div>
          ) : (
            /* Default Catalogs View (if no filters or no results) */
            <>
              {catalogs.length === 0 && (type || genre) ? (
                <div className="loading" style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No results found for these filters.</div>
              ) : (
                catalogs.map((section, idx) => (
                  <StreamingRow
                    key={idx}
                    title={section.title}
                    items={section.items}
                    profileId={profileId!}
                    showImdbRatings={showImdbRatings}
                    showAgeRatings={showAgeRatings}
                    seeAllUrl={section.seeAllUrl}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}