import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Layout, Navbar, RatingBadge, LazyImage, LoadingSpinner } from '../../components'
import { MetaPreview } from '../../services/addons/types'
import styles from '../../styles/Streaming.module.css'

interface CatalogResponse {
  items: MetaPreview[]
  hasMore: boolean
}

const fetchCatalog = async ({ pageParam = 0, queryKey }: any) => {
  const [_, profileId, manifestUrl, type, id] = queryKey
  const res = await fetch(
    `/api/streaming/catalog?profileId=${profileId}&manifestUrl=${encodeURIComponent(manifestUrl)}&type=${type}&id=${id}&skip=${pageParam}`
  )
  if (!res.ok) throw new Error('Failed to load catalog')
  const data = await res.json()
  return {
    items: data.items || [],
    title: data.title,
    hasMore: data.items && data.items.length >= 20 // Assuming 20 is the limit
  }
}

export const StreamingCatalog = () => {
  const { profileId, manifestUrl, type, id } = useParams<{ profileId: string, manifestUrl: string, type: string, id: string }>()
  const navigate = useNavigate()
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [profile, setProfile] = useState<any>(null)

  // Fetch profile for navbar avatar
  useEffect(() => {
    if (profileId) {
      fetch(`/api/streaming/dashboard?profileId=${profileId}`)
        .then(res => res.json())
        .then(data => setProfile(data.profile))
        .catch(console.error)
    }
  }, [profileId])

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteQuery({
    queryKey: ['catalog', profileId, manifestUrl, type, id],
    queryFn: fetchCatalog,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined
      return allPages.reduce((acc, page) => acc + page.items.length, 0)
    },
    initialPageParam: 0,
    enabled: !!profileId && !!manifestUrl && !!type && !!id
  })

  useEffect(() => {
    if (!profileId || !manifestUrl || !type || !id) {
      navigate('/profiles')
    }
  }, [profileId, manifestUrl, type, id, navigate])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.5 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-red-500 mb-4">Failed to load catalog</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // Dedup items
  const allItems = data?.pages.reduce((acc: MetaPreview[], page) => {
    const existingIds = new Set(acc.map(i => i.id))
    const uniqueNew = page.items.filter((i: MetaPreview) => !existingIds.has(i.id))
    return [...acc, ...uniqueNew]
  }, []) || []

  // Get title from first page if available, otherwise construct fallback
  const firstPageTitle = data?.pages[0]?.title
  const title = firstPageTitle || `${type === 'movie' ? 'Movies' : 'Series'} - ${id}`
  const showImdbRatings = true

  return (
    <Layout title={title} showHeader={false} showFooter={false}>
      <Navbar profileId={parseInt(profileId!)} profile={profile} />
      
      <button onClick={() => navigate(-1)} className={styles.backBtn}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
        Back
      </button>

      <div 
        className={`${styles.streamingLayout} ${styles.streamingLayoutNoHero}`}
      >
        <div className={styles.contentContainer}>
          <div className={styles.rowHeader}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#fff', margin: 0 }}>{title}</h1>
          </div>
          
          {allItems.length === 0 ? (
            <div className="p-10 text-center text-gray-500">No items found in this catalog.</div>
          ) : (
            <div className={styles.mediaGrid}>
              {allItems.map((item, index) => (
                <a 
                  key={`${item.id}-${index}`}
                  href={`/streaming/${profileId}/${item.type}/${item.id}`} 
                  className={styles.mediaCard}
                >
                  <div className={styles.posterContainer}>
                    {item.poster ? (
                      <LazyImage src={item.poster} alt={item.name} className={styles.posterImage} />
                    ) : (
                      <div className="flex items-center justify-center bg-gray-800 text-gray-400 w-full h-full p-2 text-center text-sm">{item.name}</div>
                    )}
                    {showImdbRatings && item.imdbRating && (
                      <RatingBadge rating={parseFloat(item.imdbRating)} />
                    )}
                    <div className={styles.cardOverlay}>
                      <div className={styles.cardTitle}>{item.name}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
          
          {/* Infinite scroll trigger */}
          <div ref={loadMoreRef} className="h-20 flex items-center justify-center w-full">
            {isFetchingNextPage && (
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}